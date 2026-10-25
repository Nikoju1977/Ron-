package com.studioniko.roncompanion;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Opt-in user-visible service. Not a guarantee against OEM/OS termination. */
public final class RonService extends Service {
    static final String ACTION_START="ron.start",ACTION_STOP="ron.stop";
    private static final String CHANNEL="ron-ongoing-v1";
    private static final int NOTICE_ID=221;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private ExecutorService queue;
    private boolean stopped=false;
    private final Runnable cycle=new Runnable(){
        @Override public void run(){
            if(stopped)return;
            if(!RonStore.active(RonService.this)){shutdown();return;}
            if(queue!=null)queue.execute(()->RonCycle.run(getApplicationContext()));
            handler.postDelayed(this,60_000);
        }
    };
    @Override public void onCreate(){super.onCreate();queue=Executors.newSingleThreadExecutor();}
    private void notice(){
        NotificationManager nm=getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"RON : autonomie visible",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open=PendingIntent.getActivity(this,10,new Intent(this,MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent stop=new Intent(this,RonService.class).setAction(ACTION_STOP);
        PendingIntent stopAction=PendingIntent.getService(this,11,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(this,CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .setContentTitle("RON · Missions autonomes")
                .setContentText("Exécution locale encadrée · toucher pour contrôler")
                .setOngoing(true).setContentIntent(open)
                .addAction(new Notification.Action.Builder(
                    android.R.drawable.ic_media_pause,"Arrêter RON",stopAction).build())
                .build();
        if(Build.VERSION.SDK_INT>=34)startForeground(NOTICE_ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTICE_ID,n);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null && ACTION_STOP.equals(intent.getAction())){
            shutdown();return START_NOT_STICKY;
        }
        if(!RonStore.active(this)){shutdown();return START_NOT_STICKY;}
        try{notice();}catch(RuntimeException e){
            // Platform may reject FGS if its policy or runtime permission disallows it.
            RonStore.active(this,false);
            RonWorker.cancel(this);
            stopped=true;stopSelf();return START_NOT_STICKY;
        }
        stopped=false;handler.removeCallbacks(cycle);handler.post(cycle);
        return START_STICKY;
    }
    private void shutdown(){
        RonStore.active(this,false);RonWorker.cancel(this);
        stopped=true;handler.removeCallbacks(cycle);
        stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
    }
    @Override public void onDestroy(){
        stopped=true;handler.removeCallbacks(cycle);
        if(queue!=null)queue.shutdownNow();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
