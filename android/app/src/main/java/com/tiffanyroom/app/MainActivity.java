package com.tiffanyroom.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;

public final class MainActivity extends Activity {
    private WebView web;
    private LinearLayout failure;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable foregroundPoll = new Runnable() {
        @Override public void run() {
            Monitor.EXECUTOR.submit(() -> Monitor.check(MainActivity.this));
            handler.postDelayed(this, 60000);
        }
    };
    private static final Set<String> EXTERNAL_HOSTS = new HashSet<>(Arrays.asList("www.sooplive.com", "play.sooplive.co.kr", "vod.sooplive.co.kr", "www.youtube.com", "m.youtube.com", "youtu.be"));

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Monitor.channel(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(248,248,252));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(16),0,dp(10),0);
        TextView title = new TextView(this);
        title.setText("t.   티파니룸"); title.setTextSize(18); title.setTextColor(Color.rgb(102,76,131));
        toolbar.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));
        title.setGravity(Gravity.CENTER_VERTICAL);
        Button menu = new Button(this); menu.setText("알림 설정"); menu.setTextSize(12);
        menu.setOnClickListener(v -> showSettings()); toolbar.addView(menu);
        root.addView(toolbar);
        FrameLayout content = new FrameLayout(this);
        root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString()+" TiffanyRoomAndroid/1.0");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !navigateInside(request.getUrl());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { failure.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) failure.setVisibility(View.VISIBLE);
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) failure.setVisibility(View.VISIBLE);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message result) {
                if (!userGesture) return false;
                WebView temporary = new WebView(MainActivity.this);
                temporary.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        Uri uri = request.getUrl();
                        if (isSite(uri)) web.loadUrl(uri.toString()); else openExternal(uri);
                        v.post(v::destroy); return true;
                    }
                });
                ((WebView.WebViewTransport)result.obj).setWebView(temporary);
                result.sendToTarget(); return true;
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,length) -> {
            Uri uri=Uri.parse(url);
            if (isSite(uri)) startBrowser(uri);
        });
        content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        failure = new LinearLayout(this);
        failure.setOrientation(LinearLayout.VERTICAL); failure.setGravity(Gravity.CENTER);
        failure.setPadding(dp(30),dp(30),dp(30),dp(30)); failure.setBackgroundColor(Color.rgb(248,248,252));
        TextView message = new TextView(this);
        message.setText("사이트에 연결하지 못했어요.\n인터넷 연결을 확인하고 다시 시도해주세요.");
        message.setGravity(Gravity.CENTER); message.setTextSize(15); message.setTextColor(Color.rgb(125,102,148));
        Button retry = new Button(this); retry.setText("다시 연결");
        retry.setOnClickListener(v -> { failure.setVisibility(View.GONE); web.loadUrl(Monitor.SITE); });
        failure.addView(message); failure.addView(retry); failure.setVisibility(View.GONE);
        content.addView(failure,new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        if (state == null || web.restoreState(state) == null) web.loadUrl(Monitor.SITE);
        PollJobService.schedule(this);
    }
    private int dp(int value) { return (int)(value*getResources().getDisplayMetrics().density); }
    private boolean isSite(Uri uri) { return "https".equals(uri.getScheme()) && "tiffany-room.onrender.com".equals(uri.getHost()) && (uri.getPort()==-1 || uri.getPort()==443) && uri.getUserInfo()==null; }
    private boolean navigateInside(Uri uri) { if (isSite(uri)) return true; openExternal(uri); return false; }
    private void openExternal(Uri uri) {
        if ("https".equals(uri.getScheme()) && EXTERNAL_HOSTS.contains(uri.getHost()) && uri.getUserInfo()==null) startBrowser(uri);
        else Toast.makeText(this,"이 주소는 앱에서 열 수 없어요.",Toast.LENGTH_SHORT).show();
    }
    private void startBrowser(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this,"주소를 열 브라우저가 없어요.",Toast.LENGTH_SHORT).show(); }
    }
    private void setNotifications(boolean enabled) {
        Monitor.prefs(this).edit().putBoolean("enabled",enabled).apply();
        PollJobService.schedule(this);
        if (PushSupport.available()) {
            PushSupport.setEnabled(this,enabled,error -> runOnUiThread(() -> {
                if(isFinishing()||isDestroyed())return;
                if(error!=null)new AlertDialog.Builder(this).setTitle("앱 푸시 연결 대기").setMessage(error).setPositiveButton("확인",null).show();
                else Toast.makeText(this,enabled?"서버 푸시 알림을 연결했어요.":"푸시 알림을 껐어요.",Toast.LENGTH_LONG).show();
            }));
        } else if (enabled) Monitor.EXECUTOR.submit(() -> Monitor.check(this));
        if(!PushSupport.available())Toast.makeText(this,enabled?"알림을 켰어요. 첫 조회 이후 새 소식부터 알려드려요.":"앱 알림을 껐어요.",Toast.LENGTH_LONG).show();
    }
    private void enableNotifications() {
        if (Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},421); return;
        }
        if (!Monitor.permission(this)) {
            startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())); return;
        }
        setNotifications(true);
    }
    private void showSettings() {
        String info="앱을 보는 동안 1분마다, 닫아두면 최소 15분 주기로 새 소식을 확인해요. 절전·배터리 정책에 따라 더 늦을 수 있어요.\n\n실시간 알림은 기존 디스코드를 함께 사용해주세요. 알림을 누르면 방송·영상이 열리고, 휴대폰 화면을 강제로 켜거나 방송을 자동 실행하지 않아요.\n\n최초 조회는 기준점으로만 저장합니다. 앱 삭제 시 설정과 기록이 삭제돼요.";
        if(PushSupport.available())info="서버가 1분마다 방송과 유튜브를 확인하고 새 소식이 있으면 Firebase 푸시를 보내요. 폰에서 15분마다 조회하는 방식은 사용하지 않아요.\n\n통신·절전 모드에 따라 알림이 늦을 수 있어요. 앱 강제 종료 상태에서는 다시 앱을 열어야 할 수 있어요. 최초 서버 조회에서는 기존 방송·영상을 알리지 않습니다.\n\n푸시를 켜면 알림 전달용 기기 토큰을 티파니룸 서버와 Firebase에 등록해요. 끄면 등록 해제를 시도합니다. 알림을 누르면 방송이나 영상이 열려요.";
        new AlertDialog.Builder(this).setTitle("티파니룸 알림")
            .setMessage(info+"\n\n현재: "+(Monitor.enabled(this)?"앱 알림 켜짐":"앱 알림 꺼짐"))
            .setPositiveButton(Monitor.enabled(this)?"알림 끄기":"알림 켜기",(d,w)->{if(Monitor.enabled(this))setNotifications(false);else enableNotifications();})
            .setNeutralButton("테스트 알림",(d,w)->{
                if(Monitor.enabled(this)&&Monitor.permission(this)) {
                    if(PushSupport.available())PushSupport.test(this,error->runOnUiThread(()->Toast.makeText(this,error==null?"서버에 테스트 푸시를 요청했어요. 알림 도착을 확인해주세요.":error,Toast.LENGTH_LONG).show()));
                    else Monitor.test(this);
                }
                else Toast.makeText(this,"먼저 앱 알림을 켜고 권한을 허용해주세요.",Toast.LENGTH_LONG).show();
            }).setNegativeButton("닫기",null).show();
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==421 && results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED)setNotifications(true);
        else if(request==421)Toast.makeText(this,"권한이 없어 알림을 켜지 않았어요.",Toast.LENGTH_LONG).show();
    }
    @Override protected void onResume(){super.onResume();handler.removeCallbacks(foregroundPoll);handler.post(foregroundPoll);}
    @Override protected void onPause(){handler.removeCallbacks(foregroundPoll);super.onPause();}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);web.saveState(state);}
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){handler.removeCallbacks(foregroundPoll);web.destroy();super.onDestroy();}
}
