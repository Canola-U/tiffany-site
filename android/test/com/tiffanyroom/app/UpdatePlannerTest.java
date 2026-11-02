package com.tiffanyroom.app;
import java.util.*;
public final class UpdatePlannerTest {
    private static void check(boolean condition,String name) { if(!condition) throw new AssertionError(name); System.out.println("PASS: "+name); }
    public static void main(String[] args) {
        check(!UpdatePlanner.live(null,"live","123").notify,"first observation is a baseline");
        check(UpdatePlanner.live("offline","live","123").notify,"offline to live notifies");
        check(!UpdatePlanner.live("123","live","123").notify,"same broadcast does not duplicate");
        check(UpdatePlanner.live("123","unavailable","").next.equals("123"),"network errors preserve baseline");
        check(!UpdatePlanner.live("offline","live","javascript:bad").notify,"invalid broadcast ID is ignored");
        List<UpdatePlanner.Video> videos=Arrays.asList(new UpdatePlanner.Video("new22222222","second","2026-11-02T02:00:00Z"),new UpdatePlanner.Video("new11111111","first","2026-11-02T01:00:00Z"),new UpdatePlanner.Video("old00000000","old","2026-11-01T00:00:00Z"));
        check(UpdatePlanner.videos(null,"",videos).updates.isEmpty(),"initial feed does not alert old uploads");
        UpdatePlanner.VideoPlan fresh=UpdatePlanner.videos("old00000000","2026-11-01T00:00:00Z",videos);
        check(fresh.updates.size()==2 && fresh.updates.get(0).id.equals("new11111111"),"all new uploads alert oldest first");
        check(UpdatePlanner.videos("new22222222","2026-11-02T02:00:00Z",videos).updates.isEmpty(),"repeat feed does not duplicate");
        check(UpdatePlanner.videos("missing0000","2026-11-02T01:30:00Z",videos).updates.size()==1,"feed overflow uses publication timestamp");
        check(UpdatePlanner.videos(null,"",Arrays.asList(new UpdatePlanner.Video("bad","bad","bad"))).newest==null,"malformed video IDs are rejected");
    }
}
