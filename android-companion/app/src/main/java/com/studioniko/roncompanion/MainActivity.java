package com.studioniko.roncompanion;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.Collections;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Native opt-in controller and restricted same-site mission bridge. */
public final class MainActivity extends Activity {
    private static final String PAGE="https://nikoju1977.github.io/Ron-/ron-presence.html";
    private static final int NOTIFY_REQUEST=22,IMPORT_REQUEST=23,EXPORT_REQUEST=24;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private TextView status;private EditText endpoint,model,mission,interval;
    private ScrollView dashboard;private WebView page;
    private boolean webOpen=false,live=false;
    private final Runnable refresh=new Runnable(){
        @Override public void run(){
            if(!live)return;
            status.setText((RonStore.active(MainActivity.this)?"Service demandé : actif":"Service : arrêté")
                +"\n"+RonStore.summary(MainActivity.this));
            if(webOpen)pushToWeb();
            handler.postDelayed(this,8000);
        }
    };
    private TextView text(String value,int size){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
        t.setPadding(14,13,14,13);t.setTextColor(0xffd8f5ee);return t;
    }
    private EditText input(String hint,String initial){
        EditText e=new EditText(this);e.setSingleLine(true);e.setTextColor(0xfff5fbfb);e.setHintTextColor(0xff98b2b9);
        e.setTextSize(15);e.setHint(hint);e.setText(initial);e.setPadding(14,10,14,10);return e;
    }
    private Button button(String label,Runnable action){
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setOnClickListener(v->action.run());return b;
    }
    private boolean allowed(String raw){
        try{
            Uri u=Uri.parse(raw);
            return "https".equals(u.getScheme())&&"nikoju1977.github.io".equals(u.getHost())
                && (u.getPath()!=null&&u.getPath().startsWith("/Ron-/"));
        }catch(Exception e){return false;}
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xff061522);
        TextView title=text("RON · COMPAGNON ANDROID",22);root.addView(title);
        LinearLayout tabs=new LinearLayout(this);
        tabs.addView(button("Contrôles",()->showWeb(false)),new LinearLayout.LayoutParams(0,-2,1));
        tabs.addView(button("RON intégré",()->showWeb(true)),new LinearLayout.LayoutParams(0,-2,1));
        root.addView(tabs);
        dashboard=new ScrollView(this);LinearLayout inside=new LinearLayout(this);inside.setOrientation(LinearLayout.VERTICAL);
        inside.setPadding(12,0,12,18);dashboard.addView(inside);
        inside.addView(text("Service visible et volontaire. Les cycles exigent un moteur compatible OpenAI sur le réseau local (Wi-Fi/ordinateur). Aucun micro, GPS ni compte cloud n'est utilisé.",14));
        endpoint=input("Adresse LAN : http://192.168.1.2:11434/v1",RonStore.endpoint(this));
        inside.addView(endpoint);
        model=input("Modèle local (ex. qwen3:4b)",RonStore.model(this));inside.addView(model);
        interval=input("Intervalle en minutes (1 à 60)",String.valueOf(RonStore.interval(this)/60000));inside.addView(interval);
        inside.addView(button("Enregistrer le moteur local",this::configure));
        LinearLayout actions=new LinearLayout(this);
        actions.addView(button("Démarrer",this::startResident),new LinearLayout.LayoutParams(0,-2,1));
        actions.addView(button("Arrêter",this::stopResident),new LinearLayout.LayoutParams(0,-2,1));
        inside.addView(actions);
        inside.addView(button("Pause / reprendre les missions",()->{
            JSONObject s=RonStore.state(this);RonStore.pause(this,!s.optBoolean("paused"));updateUI();
        }));
        mission=input("Nouvelle mission pour RON","");inside.addView(mission);
        inside.addView(button("Ajouter la mission",()->{
            String t=mission.getText().toString().trim();
            if(!t.isEmpty()){RonStore.addMission(this,t);mission.setText("");updateUI();}
        }));
        inside.addView(button("Importer des missions DOTS (.json)",()->pickFile(true)));
        inside.addView(button("Exporter les missions (.json)",()->pickFile(false)));
        status=text("",14);inside.addView(status);
        inside.addView(text("Le service de premier plan affiche une notification Arrêter. En cas de suspension par Android, WorkManager tentera une reprise différée (au moins 15 min). Aucun fonctionnement continu n'est garanti ; aucun démarrage caché.",13));
        root.addView(dashboard,new LinearLayout.LayoutParams(-1,0,1));
        page=new WebView(this);page.setVisibility(View.GONE);
        WebSettings settings=page.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Origin-scoped, main-frame-only bridge; no native methods exposed to iframes.
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
            WebViewCompat.addWebMessageListener(page,"RonNative",
                Collections.singleton("https://nikoju1977.github.io"),
                (view,message,origin,isMainFrame,reply)->{
                    if(!isMainFrame||!"https".equals(origin.getScheme())
                        ||!"nikoju1977.github.io".equals(origin.getHost())||!allowed(view.getUrl()))return;
                    String payload=message.getData();
                    if(payload==null||payload.length()>262144)return;
                    try{RonStore.merge(MainActivity.this,new JSONObject(payload));updateUI();}
                    catch(Exception ignored){}
                });
        }
        page.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){
                if(allowed(request.getUrl().toString()))return false;
                if(request.isForMainFrame()){
                    Intent i=new Intent(Intent.ACTION_VIEW,request.getUrl());
                    try{startActivity(i);}catch(Exception ignored){}
                }
                return true;
            }
            @Override public void onPageFinished(WebView v,String url){if(allowed(url))pushToWeb();}
        });
        root.addView(page,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);updateUI();
    }
    private void showWeb(boolean yes){
        webOpen=yes;dashboard.setVisibility(yes?View.GONE:View.VISIBLE);
        page.setVisibility(yes?View.VISIBLE:View.GONE);
        if(yes){
            if(page.getUrl()==null)page.loadUrl(PAGE);
            else pushToWeb();
        }
        updateUI();
    }
    private void configure(){
        String uri=endpoint.getText().toString().trim();
        String m=model.getText().toString().trim();
        if(!RonCycle.isAllowedEndpoint(uri)||m.isEmpty()||m.length()>120){
            status.setText("Adresse refusée : uniquement HTTP vers une adresse IPv4 privée avec port, chemin /v1. Aucun fournisseur cloud autorisé.");return;
        }
        try{
            long minutes=Long.parseLong(interval.getText().toString().trim());
            RonStore.interval(this,minutes*60000);
        }catch(Exception ignored){RonStore.interval(this,120000);}
        RonStore.configure(this,uri,m);updateUI();
    }
    private void startResident(){
        configure();
        if(!RonCycle.isAllowedEndpoint(RonStore.endpoint(this))||RonStore.model(this).isEmpty())return;
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFY_REQUEST);return;
        }
        startWithPermission();
    }
    private void startWithPermission(){
        RonStore.active(this,true);
        try{
            startForegroundService(new Intent(this,RonService.class).setAction(RonService.ACTION_START));
            RonWorker.schedule(this);
            status.setText("Service demandé. Vérifie la notification permanente.");
        }catch(RuntimeException e){
            RonStore.active(this,false);status.setText("Android a refusé le service : "+e.getClass().getSimpleName());
        }
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==NOTIFY_REQUEST){
            if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startWithPermission();
            else status.setText("Permission de notification refusée : service résident non démarré.");
        }
    }
    private void stopResident(){
        RonStore.active(this,false);RonWorker.cancel(this);
        try{startService(new Intent(this,RonService.class).setAction(RonService.ACTION_STOP));}
        catch(RuntimeException ignored){}
        updateUI();
    }
    private void updateUI(){if(status!=null)status.setText((RonStore.active(this)?"Résident : demandé":"Résident : arrêté")+"\n"+RonStore.summary(this));}
    private void pickFile(boolean importing){
        Intent i=new Intent(importing?Intent.ACTION_OPEN_DOCUMENT:Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");
        if(!importing)i.putExtra(Intent.EXTRA_TITLE,"ron-dots-missions.json");
        startActivityForResult(i,importing?IMPORT_REQUEST:EXPORT_REQUEST);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        try{
            if(request==IMPORT_REQUEST){
                StringBuilder text=new StringBuilder();
                try(InputStream in=getContentResolver().openInputStream(uri)){
                    if(in==null)throw new IllegalArgumentException("Fichier inaccessible");
                    byte[] buf=new byte[2048];int n;
                    while((n=in.read(buf))!=-1){text.append(new String(buf,0,n,StandardCharsets.UTF_8));
                        if(text.length()>65536)throw new IllegalArgumentException("Fichier trop volumineux");}
                }
                RonStore.merge(this,new JSONObject(text.toString()));
                updateUI();pushToWeb();
            }else if(request==EXPORT_REQUEST){
                try(OutputStream out=getContentResolver().openOutputStream(uri)){
                    if(out==null)throw new IllegalArgumentException("Destination inaccessible");
                    out.write(RonStore.forWeb(this).toString(2).getBytes(StandardCharsets.UTF_8));
                }
            }
        }catch(Exception e){status.setText("Import/export impossible : "+e.getMessage());}
    }
    private void pushToWeb(){
        if(!webOpen||page==null||!allowed(page.getUrl()))return;
        String json=JSONObject.quote(RonStore.forWeb(this).toString());
        page.evaluateJavascript("window.RONAndroid&&window.RONAndroid.applyState("+json+")",null);
    }
    @Override protected void onResume(){
        super.onResume();live=true;handler.removeCallbacks(refresh);handler.post(refresh);
        if(page!=null)page.onResume();
    }
    @Override protected void onPause(){
        live=false;handler.removeCallbacks(refresh);
        if(page!=null)page.onPause();
        super.onPause();
    }
    @Override protected void onDestroy(){
        if(page!=null){page.destroy();}
        super.onDestroy();
    }
}
