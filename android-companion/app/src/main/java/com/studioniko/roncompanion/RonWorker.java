package com.studioniko.roncompanion;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

/** Deferrable recovery: minimum 15 min; never claims continuous execution. */
public final class RonWorker extends Worker {
    private static final String UNIQUE="ron-fallback-cycle";
    public RonWorker(@NonNull Context context,@NonNull WorkerParameters params){super(context,params);}
    @NonNull @Override public Result doWork(){
        if(!RonStore.active(getApplicationContext()))return Result.success();
        RonCycle.run(getApplicationContext());
        return Result.success();
    }
    static void schedule(Context c){
        Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest work=new PeriodicWorkRequest.Builder(RonWorker.class,15,TimeUnit.MINUTES)
                .setConstraints(constraints).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(UNIQUE,ExistingPeriodicWorkPolicy.KEEP,work);
    }
    static void cancel(Context c){WorkManager.getInstance(c).cancelUniqueWork(UNIQUE);}
}
