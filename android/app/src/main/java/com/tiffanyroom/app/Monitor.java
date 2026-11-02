package com.tiffanyroom.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import org.json.*;
import java.net.*;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

final class Monitor {
    static final String SITE = "https://tiffany-room.onrender.com";
    static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final String CHANNEL = "tiffany_updates";
    private static final String PREFS = "tiffany_monitor";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static boolean enabled(Context c) { return prefs(c).getBoolean("enabled", false); }
    static boolean permission(Context c) {
        return (Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && c.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }
    static void channel(Context c) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "방송 시작 · 새 영상", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("방송과 유튜브의 새 소식을 알려드려요.");
        c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    static synchronized void check(Context context) {
        Context c = context.getApplicationContext();
        if (!enabled(c) || !permission(c) || PushSupport.available()) return;
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) new URL(SITE + "/api/status").openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            if (connection.getResponseCode() != 200) return;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                    if (output.size() > 524288) return;
                }
            }
            if (Thread.currentThread().isInterrupted() || !enabled(c)) return;
            JSONObject data = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            observe(c, data);
        } catch (Exception ignored) {
            // A failed request must never reset successful broadcast/video observations.
        } finally { if (connection != null) connection.disconnect(); }
    }
    private static void observe(Context c, JSONObject data) throws JSONException {
        SharedPreferences prefs = prefs(c);
        SharedPreferences.Editor next = prefs.edit();
        JSONObject live = data.optJSONObject("live");
        if (live != null) {
            String id=live.optString("id");
            UpdatePlanner.LivePlan plan=UpdatePlanner.live(prefs.getString("live",null),live.optString("state"),id);
            if(plan.notify) send(c,"live:"+id,"티파니 방송 시작!",live.optString("title","방송이 시작됐어요."),"https://play.sooplive.co.kr/w96idqb/"+id);
            if(plan.next!=null) next.putString("live",plan.next);
        }
        JSONObject youtube = data.optJSONObject("youtube");
        JSONArray videos = youtube == null ? null : youtube.optJSONArray("videos");
        if (youtube != null && youtube.optString("state").equals("connected") && videos != null) {
            List<UpdatePlanner.Video> source=new ArrayList<>();
            for(int i=0;i<videos.length();i++) {
                JSONObject v=videos.getJSONObject(i);
                source.add(new UpdatePlanner.Video(v.optString("id"),v.optString("title"),v.optString("published")));
            }
            UpdatePlanner.VideoPlan plan=UpdatePlanner.videos(prefs.getString("video",null),prefs.getString("published",""),source);
            for(UpdatePlanner.Video video:plan.updates) send(c,"video:"+video.id,"티파니 새 영상",video.title,"https://www.youtube.com/watch?v="+video.id);
            if(plan.newest!=null) {
                next.putString("video",plan.newest.id);
                next.putString("published",plan.newest.published);
            }
        }
        next.putLong("lastCheck",System.currentTimeMillis()).apply();
    }
    private static void send(Context c, String key, String title, String text, String url) {
        if (!enabled(c) || !permission(c)) return;
        channel(c);
        Intent target = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        PendingIntent pending = PendingIntent.getActivity(c, key.hashCode(), target, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification).setContentTitle(title)
            .setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(pending).setAutoCancel(true).setOnlyAlertOnce(true).build();
        c.getSystemService(NotificationManager.class).notify(key, 1, notification);
    }
    static synchronized void remote(Context c,String key,String title,String text,String url) {
        if(!enabled(c)||!permission(c)||!key.matches("(live:[0-9]+|youtube:[A-Za-z0-9_-]{11}|test:[A-Za-z0-9-]+)"))return;
        Uri parsed=Uri.parse(url);
        String host=parsed.getHost();
        if(!"https".equals(parsed.getScheme())||parsed.getUserInfo()!=null||!("play.sooplive.co.kr".equals(host)||"www.youtube.com".equals(host)))return;
        SharedPreferences preferences=prefs(c);
        String recent=preferences.getString("receivedPush", "");
        if(java.util.Arrays.asList(recent.split("\\n")).contains(key))return;
        send(c,key,title,text,url);
        String next=key+"\n"+recent;
        String[] keys=next.split("\\n");
        if(keys.length>200)next=String.join("\n",java.util.Arrays.copyOf(keys,200));
        preferences.edit().putString("receivedPush",next).apply();
    }
    static void test(Context c) { send(c, "test", "티파니룸 테스트 알림", "이 알림을 누르면 방송국이 열려요.", "https://www.sooplive.com/station/w96idqb"); }
}
