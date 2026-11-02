package com.tiffanyroom.app;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

final class UpdatePlanner {
    static final class LivePlan {
        final String next;
        final boolean notify;
        LivePlan(String next, boolean notify) { this.next=next; this.notify=notify; }
    }
    static LivePlan live(String previous, String state, String id) {
        if ("offline".equals(state)) return new LivePlan("offline", false);
        if ("live".equals(state) && id.matches("[0-9]+")) return new LivePlan(id, previous != null && !previous.equals(id));
        return new LivePlan(previous, false);
    }
    static final class Video {
        final String id, title, published;
        Video(String id, String title, String published) { this.id=id; this.title=title; this.published=published; }
    }
    static final class VideoPlan {
        final Video newest;
        final List<Video> updates;
        VideoPlan(Video newest, List<Video> updates) { this.newest=newest; this.updates=updates; }
    }
    static VideoPlan videos(String previous, String previousDate, List<Video> source) {
        List<Video> videos=new ArrayList<>(),updates=new ArrayList<>();
        for(Video video:source) if(video.id.matches("[A-Za-z0-9_-]{11}")) videos.add(video);
        if(videos.isEmpty()) return new VideoPlan(null,updates);
        int lastIndex=-1;
        for(int i=0;i<videos.size();i++) if(videos.get(i).id.equals(previous)) lastIndex=i;
        if(previous!=null) {
            for(int i=videos.size()-1;i>=0;i--) {
                Video video=videos.get(i);
                boolean fresh=lastIndex>=0?i<lastIndex:newer(video.published,previousDate);
                if(fresh) updates.add(video);
            }
        }
        return new VideoPlan(videos.get(0),updates);
    }
    private static boolean newer(String a,String b) {
        try { return Instant.parse(a).isAfter(Instant.parse(b)); } catch(Exception e) { return false; }
    }
}
