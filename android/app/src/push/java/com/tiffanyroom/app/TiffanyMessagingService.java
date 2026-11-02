package com.tiffanyroom.app;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
public final class TiffanyMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        if(Monitor.enabled(this))FirebaseBridge.register(this,token,error->{});
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String,String> data=message.getData();
        Monitor.remote(this,data.getOrDefault("eventKey",""),data.getOrDefault("title","티파니룸"),data.getOrDefault("body","새 소식이 도착했어요."),data.getOrDefault("url",""));
    }
}
