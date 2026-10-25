package com.studioniko.roncompanion;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

/** One bounded, truthful autonomy cycle. No automatic paid API calls. */
public final class RonCycle {
    private static final AtomicBoolean BUSY=new AtomicBoolean(false);
    private RonCycle(){}
    public static boolean isAllowedEndpoint(String raw) {
        try {
            URI uri=new URI(raw.trim());
            if(!"http".equals(uri.getScheme())||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null)return false;
            int port=uri.getPort();if(port<1||port>65535)return false;
            String host=uri.getHost();if(host==null||!host.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}"))return false;
            String[] parts=host.split("\\.");int[] p=new int[4];
            for(int i=0;i<4;i++){p[i]=Integer.parseInt(parts[i]);if(p[i]>255)return false;}
            boolean local=p[0]==10||p[0]==127||(p[0]==192&&p[1]==168)||(p[0]==172&&p[1]>=16&&p[1]<=31);
            return local && (uri.getPath().isEmpty()||"/v1".equals(uri.getPath())||"/v1/".equals(uri.getPath()));
        }catch(Exception e){return false;}
    }
    static JSONObject nextMission(JSONObject s){
        JSONArray ms=s.optJSONArray("missions");
        if(ms==null)return null;
        for(int i=0;i<ms.length();i++){
            JSONObject m=ms.optJSONObject(i);
            if(m!=null&&"active".equals(m.optString("status")))return m;
        }
        return null;
    }
    static boolean due(Context c,JSONObject s,long now) {
        if(!RonStore.active(c)||s.optBoolean("paused",false)||s.optInt("cycles",0)>=24)return false;
        if(nextMission(s)==null)return false;
        long last=s.optLong("lastAttempt",0),backoff=Math.min(3_600_000L,60_000L << Math.min(5,s.optInt("failures",0)));
        return now>=last+Math.max(RonStore.interval(c),s.optInt("failures",0)>0?backoff:0);
    }
    public static void run(Context c){
        if(!BUSY.compareAndSet(false,true))return;
        try{runLocked(c.getApplicationContext());}finally{BUSY.set(false);}
    }
    private static void runLocked(Context c){
        JSONObject mission;String endpoint=RonStore.endpoint(c),model=RonStore.model(c);
        String id,at;
        synchronized(RonStore.class){
            JSONObject state=RonStore.state(c);long now=System.currentTimeMillis();
            if(!due(c,state,now))return;
            if(!isAllowedEndpoint(endpoint)||model.isEmpty()){
                RonStore.put(state,"status","Moteur LAN local non configuré");
                RonStore.write(c,state);return;
            }
            mission=nextMission(state);if(mission==null)return;
            id=mission.optString("id");at=mission.optString("updatedAt");
            RonStore.put(state,"lastAttempt",now);
            RonStore.put(state,"cycles",state.optInt("cycles",0)+1);
            RonStore.put(state,"status","Cycle en cours · "+RonStore.clip(mission.optString("title"),60));
            RonStore.write(c,state);
        }
        try{
            JSONObject result=askLocal(endpoint,model,mission);
            synchronized(RonStore.class){
                JSONObject s=RonStore.state(c);
                if(!RonStore.active(c)||s.optBoolean("paused"))return;
                JSONArray ms=s.optJSONArray("missions");JSONObject target=null;
                for(int i=0;i<ms.length();i++){
                    JSONObject q=ms.optJSONObject(i);if(q!=null&&id.equals(q.optString("id"))){target=q;break;}
                }
                if(target==null||!"active".equals(target.optString("status"))||!at.equals(target.optString("updatedAt")))return;
                int progress=Math.max(target.optInt("progress",0),Math.max(0,Math.min(100,result.optInt("progress",0))));
                String prev=target.optString("nextStep"),next=RonStore.clip(result.optString("next_step"),400);
                int stalls=(next.equalsIgnoreCase(prev)&&progress<=target.optInt("progress"))?target.optInt("stalls",0)+1:0;
                boolean waiting=result.optBoolean("needs_user",false)||"waiting".equals(result.optString("status"))||stalls>=3;
                String status=waiting?"waiting":("done".equals(result.optString("status"))?"done":"active");
                RonStore.put(target,"progress",progress);RonStore.put(target,"status",status);
                RonStore.put(target,"nextStep",next);RonStore.put(target,"stalls",stalls);
                RonStore.put(target,"question",waiting?RonStore.clip(result.optString("question",stalls>=3?"Aucune progression. Quelle décision prendre ?":"Précision nécessaire."),400):"");
                RonStore.put(target,"selfCheck",RonStore.clip(result.optString("self_check","Analyse réalisée, résultat à vérifier."),400));
                RonStore.put(target,"uncertainty",RonStore.clip(result.optString("uncertainty"),240));
                RonStore.put(target,"updatedAt",RonStore.stamp());
                JSONArray notes=target.optJSONArray("notes");if(notes==null){notes=new JSONArray();RonStore.put(target,"notes",notes);}
                String note=RonStore.clip(result.optString("private_note"),700);
                if(!note.isEmpty() && notes.length()<15)notes.put(note);
                RonStore.put(s,"failures",0);
                String summary=RonStore.clip(result.optString("summary",next),200);
                RonStore.put(s,"status",(waiting?"Décision requise : ":("done".equals(status)?"Terminée : ":"En cours : "))+summary);
                RonStore.log(s,"Cycle : "+summary);RonStore.write(c,s);
            }
        }catch(Exception e){
            synchronized(RonStore.class){
                JSONObject s=RonStore.state(c);
                RonStore.put(s,"failures",Math.min(8,s.optInt("failures",0)+1));
                RonStore.put(s,"status","Cycle impossible : "+RonStore.clip(e.getMessage(),100));
                RonStore.log(s,"Cycle impossible (nouvel essai espacé).");RonStore.write(c,s);
            }
        }
    }
    private static JSONObject askLocal(String endpoint,String model,JSONObject mission)throws Exception{
        if(!isAllowedEndpoint(endpoint))throw new SecurityException("Adresse hors réseau privé refusée");
        String base=endpoint.endsWith("/")?endpoint.substring(0,endpoint.length()-1):endpoint;
        if(!base.endsWith("/v1"))base+="/v1";
        URL url=new URL(base+"/chat/completions");
        // Only literal private IPv4 is permitted: no DNS rebinding or cloud credential leakage.
        HttpURLConnection conn=(HttpURLConnection)url.openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(5000);conn.setReadTimeout(18000);
        conn.setRequestMethod("POST");conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type","application/json; charset=utf-8");
        JSONObject body=new JSONObject();
        RonStore.put(body,"model",RonStore.clip(model,120));
        RonStore.put(body,"temperature",0.1);RonStore.put(body,"max_tokens",500);
        JSONArray messages=new JSONArray(),ms=new JSONObject(),user=new JSONObject();
        RonStore.put(ms,"role","system");
        RonStore.put(ms,"content","Tu es RON, agent de suivi local. Aucun accès à des outils, fichiers ou au monde extérieur. Ne prétends jamais avoir effectué une action. Évalue sincèrement la progression, signale le manque de preuves. Réponds strictement en JSON avec status(active|waiting|done), summary, next_step, needs_user, question, progress(0..100), private_note, self_check, uncertainty. Quand aucune avancée vérifiable n'est possible, demande une décision.");
        messages.put(ms);
        RonStore.put(user,"role","user");
        RonStore.put(user,"content","Responsabilité : "+mission.optString("title")+"\nÉtape précédente : "+mission.optString("nextStep")+"\nNotes : "+mission.optJSONArray("notes")+"\nIndique la prochaine étape honnête, sans inventer une réalisation.");
        messages.put(user);RonStore.put(body,"messages",messages);
        byte[] payload=body.toString().getBytes(StandardCharsets.UTF_8);
        if(payload.length>12000)throw new IllegalArgumentException("Mission trop volumineuse");
        try{
            try(OutputStream out=conn.getOutputStream()){out.write(payload);}
            int code=conn.getResponseCode();
            if(code!=200)throw new IllegalStateException("Moteur HTTP "+code);
            StringBuilder text=new StringBuilder();
            try(BufferedReader in=new BufferedReader(new InputStreamReader(conn.getInputStream(),StandardCharsets.UTF_8))){
                char[] buf=new char[2048];int n;
                while((n=in.read(buf))!=-1){text.append(buf,0,n);if(text.length()>65536)throw new IllegalArgumentException("Réponse trop longue");}
            }
            String content=new JSONObject(text.toString()).getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content").trim();
            int first=content.indexOf('{'),last=content.lastIndexOf('}');
            if(first<0||last<=first)throw new IllegalArgumentException("Réponse non structurée");
            return new JSONObject(content.substring(first,last+1));
        }finally{conn.disconnect();}
    }
}
