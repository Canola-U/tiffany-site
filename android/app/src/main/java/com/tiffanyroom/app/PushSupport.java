package com.tiffanyroom.app;
import android.content.Context;

final class PushSupport {
    interface Callback { void done(String error); }
    static boolean available() {
        try { Class.forName("com.tiffanyroom.app.FirebaseBridge"); return true; }
        catch(ClassNotFoundException e) { return false; }
    }
    static void cached(Context context) {
        if(!available())return;
        try { Class.forName("com.tiffanyroom.app.FirebaseBridge").getMethod("cached",Context.class).invoke(null,context); }
        catch(Exception ignored) { }
    }
    static void test(Context context,Callback callback) {
        try { Class.forName("com.tiffanyroom.app.FirebaseBridge").getMethod("test",Context.class,Callback.class).invoke(null,context,callback); }
        catch(Exception e) { callback.done("테스트 푸시를 요청하지 못했어요."); }
    }
    static void setEnabled(Context context,boolean enabled,Callback callback) {
        try { Class.forName("com.tiffanyroom.app.FirebaseBridge").getMethod("setEnabled",Context.class,boolean.class,Callback.class).invoke(null,context,enabled,callback); }
        catch(Exception e) { callback.done("앱 푸시 연결을 시작하지 못했어요."); }
    }
}
