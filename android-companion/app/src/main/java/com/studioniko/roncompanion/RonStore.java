package com.studioniko.roncompanion;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/** Device-private mission store. Native runtime is authoritative while active. */
public final class RonStore {
    private static final String PREFS="ron_companion_v1", KEY="missions_v1";
    private static final int MAX_MISSIONS=30, MAX_LOGS=80;
    private RonStore(){}
    static SharedPreferences preferences(Context c){return c.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    static String day(){return DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC).format(Instant.now());}
    static String stamp(){return Instant.now().toString();}
    static JSONObject state(Context c) {
        JSONObject result;
        try {result=new JSONObject(preferences(c).getString(KEY,"{}"));}catch(Exception ex){result=new JSONObject();}
        if(result.optJSONArray("missions")==null)put(result,"missions",new JSONArray());
        if(result.optJSONArray("log")==null)put(result,"log",new JSONArray());
        if(!day().equals(result.optString("day"))) {
            put(result,"day",day()); put(result,"cycles",0);put(result,"failures",0);
        }
        return result;
    }
    static void write(Context c,JSONObject s){preferences(c).edit().putString(KEY,s.toString()).commit();}
    static void put(JSONObject s,String key,Object v){try{s.put(key,v);}catch(Exception ignored){}}
    static boolean active(Context c){return preferences(c).getBoolean("active",false);}
    static void active(Context c,boolean enabled){preferences(c).edit().putBoolean("active",enabled).commit();}
    static String endpoint(Context c){return preferences(c).getString("endpoint","");}
    static String model(Context c){return preferences(c).getString("model","");}
    static void configure(Context c,String url,String model) {
        preferences(c).edit().putString("endpoint",url.trim()).putString("model",model.trim()).commit();
    }
    static long interval(Context c){return Math.max(60_000,Math.min(3_600_000,preferences(c).getLong("interval",120_000)));}
    static void interval(Context c,long ms){preferences(c).edit().putLong("interval",Math.max(60_000,Math.min(3_600_000,ms))).commit();}
    static void log(JSONObject s,String text) {
        JSONArray existing=s.optJSONArray("log"),newest=new JSONArray();
        if(existing!=null)for(int i=Math.max(0,existing.length()-MAX_LOGS+1);i<existing.length();i++)newest.put(existing.opt(i));
        JSONObject item=new JSONObject();put(item,"at",stamp());put(item,"message",clip(text,240));newest.put(item);
        put(s,"log",newest);
    }
    static String clip(String s,int max){return s==null?"":s.length()>max?s.substring(0,max):s;}
    static JSONObject cleanMission(JSONObject raw) {
        String id=clip(raw.optString("id"),100),title=clip(raw.optString("title").trim(),500);
        if(id.isEmpty()||title.isEmpty())return null;
        JSONObject result=new JSONObject();
        put(result,"id",id);put(result,"title",title);
        String st=raw.optString("status","active");
        put(result,"status",st.equals("done")||st.equals("waiting")||st.equals("active")?st:"active");
        put(result,"progress",Math.max(0,Math.min(100,raw.optInt("progress",0))));
        put(result,"nextStep",clip(raw.optString("nextStep"),500));
        put(result,"question",clip(raw.optString("question"),400));
        put(result,"selfCheck",clip(raw.optString("selfCheck"),400));
        put(result,"uncertainty",clip(raw.optString("uncertainty"),240));
        put(result,"stalls",Math.max(0,Math.min(3,raw.optInt("stalls",0))));
        String updated=raw.optString("updatedAt",stamp());
        try{Instant.parse(updated);}catch(Exception ignored){updated=stamp();}
        put(result,"updatedAt",updated);
        JSONArray notes=new JSONArray(),source=raw.optJSONArray("notes");
        if(source!=null)for(int i=Math.max(0,source.length()-10);i<source.length();i++)notes.put(clip(source.optString(i),900));
        put(result,"notes",notes);
        return result;
    }
    static JSONObject merge(Context c,JSONObject incoming) {
        synchronized(RonStore.class){
            JSONObject current=state(c);
            JSONArray ours=current.optJSONArray("missions"),external=incoming.optJSONArray("missions");
            if(external==null)return current;
            JSONArray merged=new JSONArray();
            for(int i=0;i<ours.length();i++){
                JSONObject mission=ours.optJSONObject(i);
                if(mission!=null){JSONObject clean=cleanMission(mission);if(clean!=null)merged.put(clean);}
            }
            for(int i=0;i<Math.min(MAX_MISSIONS,external.length());i++){
                JSONObject candidate=external.optJSONObject(i);
                if(candidate==null)continue;
                JSONObject entry=cleanMission(candidate);
                if(entry==null)continue;
                int duplicate=-1;
                for(int j=0;j<merged.length();j++){
                    if(entry.optString("id").equals(merged.optJSONObject(j).optString("id"))){duplicate=j;break;}
                }
                if(duplicate>=0){
                    if(entry.optString("updatedAt").compareTo(merged.optJSONObject(duplicate).optString("updatedAt"))>0)
                        putAt(merged,duplicate,entry);
                }else if(merged.length()<MAX_MISSIONS)merged.put(entry);
            }
            put(current,"missions",merged);
            // The web UI may pause missions, but cannot secretly start a native service.
            put(current,"paused",incoming.optBoolean("paused",current.optBoolean("paused")));
            write(c,current);
            return current;
        }
    }
    static void putAt(JSONArray array,int i,JSONObject value){try{array.put(i,value);}catch(Exception ignored){}}
    static void addMission(Context c,String title){
        synchronized(RonStore.class){
            String trimmed=clip(title.trim(),500);if(trimmed.isEmpty())return;
            JSONObject s=state(c);JSONArray a=s.optJSONArray("missions");if(a.length()>=MAX_MISSIONS)return;
            JSONObject m=new JSONObject();
            put(m,"id","android_"+System.currentTimeMillis()+"_"+a.length());
            put(m,"title",trimmed);put(m,"status","active");put(m,"progress",0);put(m,"nextStep","Analyse initiale");
            put(m,"updatedAt",stamp());put(m,"notes",new JSONArray());
            a.put(m);log(s,"Mission ajoutée : "+trimmed);write(c,s);
        }
    }
    static void pause(Context c,boolean paused){
        synchronized(RonStore.class){JSONObject s=state(c);put(s,"paused",paused);log(s,paused?"Missions en pause":"Missions reprises");write(c,s);}
    }
    static String summary(Context c) {
        synchronized(RonStore.class){
            JSONObject s=state(c);JSONArray a=s.optJSONArray("missions");int todo=0,waiting=0;
            for(int i=0;i<a.length();i++){JSONObject m=a.optJSONObject(i);if(m==null)continue;
                if("active".equals(m.optString("status")))todo++;if("waiting".equals(m.optString("status")))waiting++;}
            String msg="Actives : "+todo+" · Attente : "+waiting+" · Cycles UTC : "+s.optInt("cycles")+"/24";
            msg+="\nDernier état : "+s.optString("status","Aucun cycle exécuté");
            JSONArray log=s.optJSONArray("log");
            if(log.length()>0)msg+="\nJournal : "+log.optJSONObject(log.length()-1).optString("message");
            return msg;
        }
    }
    static JSONObject forWeb(Context c) {
        synchronized(RonStore.class){
            JSONObject s=state(c),out=new JSONObject();
            put(out,"missions",s.optJSONArray("missions"));put(out,"paused",s.optBoolean("paused"));
            put(out,"cycles",s.optInt("cycles"));put(out,"status",s.optString("status",""));
            return out;
        }
    }
}
