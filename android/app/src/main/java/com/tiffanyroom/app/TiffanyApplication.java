package com.tiffanyroom.app;
import android.app.Application;
public final class TiffanyApplication extends Application {
    @Override public void onCreate() { super.onCreate(); PushSupport.cached(this); }
}
