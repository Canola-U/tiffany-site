package com.tiffanyroom.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;

public final class FirebaseBridge {
    private static SharedPreferences preferences(Context context) { return context.getSharedPreferences("tiffany_push",Context.MODE_PRIVATE); }
    private static synchronized void initialize(Context context,JSONObject config) throws Exception {
        if(!FirebaseApp.getApps(context).isEmpty())return;
        FirebaseOptions options=new FirebaseOptions.Builder().setApplicationId(config.getString("appId")).setApiKey(config.getString("apiKey")).setProjectId(config.getString("projectId")).setGcmSenderId(config.getString("senderId")).build();
        FirebaseApp.initializeApp(context,options);
        FirebaseMessaging.getInstance().setAutoInitEnabled(Monitor.enabled(context));
    }
    public static void cached(Context context) {
        try {
            String saved=preferences(context).getString("config",null);
            if(saved!=null)initialize(context,new JSONObject(saved));
        } catch(Exception ignored) { }
    }
    private static JSONObject request(String endpoint,JSONObject body) throws Exception {
        HttpsURLConnection connection=(HttpsURLConnection)new URL(Monitor.SITE+endpoint).openConnection();
        connection.setConnectTimeout(10000);connection.setReadTimeout(15000);
        try {
            if(body!=null) {
                connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
                try(OutputStream output=connection.getOutputStream()){output.write(body.toString().getBytes(StandardCharsets.UTF_8));}
            }
            if(connection.getResponseCode()!=200)throw new IOException("Firebase 서버 연결 설정 또는 기기 등록을 확인해주세요.");
            ByteArrayOutputStream result=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()) {
                byte[] data=new byte[2048];int count;
                while((count=input.read(data))!=-1){result.write(data,0,count);if(result.size()>65536)throw new IOException("응답 크기 초과");}
            }
            return new JSONObject(result.toString("UTF-8"));
        } finally {connection.disconnect();}
    }
    static void register(Context context,String token,PushSupport.Callback callback) {
        Monitor.EXECUTOR.submit(()->{
            try {
                if(!Monitor.enabled(context))return;
                SharedPreferences saved=preferences(context);
                JSONObject input=new JSONObject().put("token",token);
                if(saved.contains("deviceId"))input.put("id",saved.getString("deviceId","")).put("secret",saved.getString("secret",""));
                JSONObject result=request("/api/push/devices",input);
                saved.edit().putString("deviceId",result.getString("id")).putString("secret",result.getString("secret")).apply();
                if(!Monitor.enabled(context)){setEnabled(context,false,callback);return;}
                callback.done(null);
            } catch(Exception e){callback.done("Firebase 설정 연결을 마친 뒤 알림을 껐다가 다시 켜주세요.");}
        });
    }
    public static void test(Context context,PushSupport.Callback callback) {
        Monitor.EXECUTOR.submit(()->{
            try {
                SharedPreferences saved=preferences(context);
                if(!saved.contains("deviceId")){callback.done("먼저 앱 알림 연결을 완료해주세요.");return;}
                request("/api/push/test",new JSONObject().put("id",saved.getString("deviceId","")).put("secret",saved.getString("secret","")));
                callback.done(null);
            }catch(Exception e){callback.done("테스트 푸시를 보내지 못했어요. Firebase 연결을 확인하고 1분 후 다시 시도해주세요.");}
        });
    }
    public static void setEnabled(Context context,boolean enabled,PushSupport.Callback callback) {
        Context app=context.getApplicationContext();
        Monitor.EXECUTOR.submit(()->{
            try {
                SharedPreferences saved=preferences(app);
                if(!enabled) {
                    if(!FirebaseApp.getApps(app).isEmpty()){FirebaseMessaging.getInstance().setAutoInitEnabled(false);FirebaseMessaging.getInstance().deleteToken();}
                    if(saved.contains("deviceId")) {
                        request("/api/push/unsubscribe",new JSONObject().put("id",saved.getString("deviceId","")).put("secret",saved.getString("secret","")));
                        saved.edit().remove("deviceId").remove("secret").apply();
                    }
                    callback.done(null);return;
                }
                JSONObject config=request("/api/push/config",null);
                saved.edit().putString("config",config.toString()).apply();initialize(app,config);
                FirebaseMessaging.getInstance().setAutoInitEnabled(true);
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
                    if(task.isSuccessful())register(app,task.getResult(),callback);
                    else callback.done("Google Play 서비스와 인터넷 연결을 확인하고 다시 켜주세요.");
                });
            } catch(Exception e){callback.done("서버의 Firebase 연결이 아직 준비되지 않았어요. 설정 후 알림을 다시 켜주세요.");}
        });
    }
}
