import { cache } from "react";
import { DateTime } from "luxon";
import { graceLeft, graceMonth } from "@/domain";
import { listUserActivities } from "./activities";
import { closeOutstanding } from "./scoring";
import { allStreaks, closeStreaks, rebuildStreak } from "./streak";
import { now } from "@/lib/clock";

// A user's standing in one activity: the streak, the best it has ever been, and
// how much grace is left this month.
//
// It is a ROW READ. The streak lives in activity_streaks, the press moves it,
// and this reads it. It used to load every closed period for the type and walk
// them on every screen, which was both the slowest thing on Home and wrong for
// weekly types: the walk counts days and was handed one row per period, so
// three passed gym weeks came back as a streak of 1.
//
// Home asks for a standing per activity, so the work is done ONCE A REQUEST for
// the whole user rather than once per type. Closing, and reading the counters
// back, are each a single query however many activities are on the screen.

export interface Standing {
  typeKey: string;
  streak: number;
  best: number;
  graceLeft: number;
  gracePerMonth: number;
}

/**
 * Every tracked activity's standing, closed and read once.
 *
 * React's `cache` makes this per request, which is the right grain: closing is
 * idempotent, so doing it once is doing it enough, and six rows come back in
 * one query rather than six.
 */
export const standingsFor = cache(
  async (userId: string): Promise<Map<string, Standing>> => {
    const activities = (await listUserActivities(userId)).filter((a) => a.enabled);
    const out = new Map<string, Standing>();
    if (activities.length === 0) return out;

    // A day that ended has to be accounted for before the number is read. Both
    // of these do nothing at all when nothing has closed since the last look.
    await closeOutstanding(userId);
    await closeStreaks(userId);

    const stored = await allStreaks(userId);
    const today = DateTime.fromJSDate(await now(), { zone: "utc" }).toFormat("yyyy-MM-dd");

    for (const activity of activities) {
      // Missing means this type has never been counted: a first check-in that
      // predates the counter, or a rebuilt database. Build it rather than
      // report zero, which would be a wrong number rather than an absent one.
      const s =
        stored.get(activity.typeKey) ?? (await rebuildStreak(userId, activity.typeKey));
      if (!s) continue;
      out.set(activity.typeKey, {
        typeKey: activity.typeKey,
        streak: s.current,
        best: s.best,
        graceLeft: graceLeft(
          { current: s.current, best: s.best, graceSpent: s.graceSpent },
          graceMonth(today),
          activity.schedule.grace,
        ),
        gracePerMonth: activity.schedule.grace,
      });
    }
    return out;
  },
);

/** One activity's standing. Null when the user does not track it. */
export async function standingFor(
  userId: string,
  typeKey: string,
): Promise<Standing | null> {
  return (await standingsFor(userId)).get(typeKey) ?? null;
}
