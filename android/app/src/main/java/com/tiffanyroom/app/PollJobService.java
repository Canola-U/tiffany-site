package com.tiffanyroom.app;

import android.app.job.*;
import android.content.*;
import java.util.concurrent.Future;

public final class PollJobService extends JobService {
    private static final int JOB_ID = 421;
    private Future<?> current;
    static void schedule(Context c) {
        JobScheduler scheduler = c.getSystemService(JobScheduler.class);
        if (!Monitor.enabled(c) || PushSupport.available()) { scheduler.cancel(JOB_ID); return; }
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(c, PollJobService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(15 * 60 * 1000L).setPersisted(true).build();
        scheduler.schedule(job);
    }
    @Override public boolean onStartJob(JobParameters params) {
        current = Monitor.EXECUTOR.submit(() -> {
            Monitor.check(this);
            if (!Thread.currentThread().isInterrupted()) jobFinished(params, false);
        });
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) {
        if (current != null) current.cancel(true);
        return Monitor.enabled(this);
    }
}
