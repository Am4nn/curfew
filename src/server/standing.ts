import { cache } from "react";
import { DateTime } from "luxon";
import { listUserActivities } from "./activities";
import { closeOutstanding } from "./scoring";
import { allStreaks, closeStreaks, rebuildStreak } from "./streak";
import { consistencyFor, type Established } from "./consistency-read";
import { timezoneHistory } from "./config";
import { getActivityType, measureOf } from "@/domain";
import { now } from "@/lib/clock";

// A user's standing in one activity: the streak and the best it has ever been.
//
// Grace used to be here too, as a per-activity allowance with a per-activity
// count of what was left. It is one pool for the account now (item 19), so it
// is a property of the person rather than of the activity and lives in
// `restore.ts`.
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
  /**
   * The run is over on the arithmetic but still recoverable. See StreakState.
   *
   * A weekly streak holds its number when a week comes short, so `streak` above
   * being positive no longer means the run is alive. Every surface that draws a
   * flame has to ask this as well, or a dead run gets a live one.
   */
  grey: boolean;
  /**
   * How established this is (1.49, 1.56), or NULL for a type that carries a
   * streak, or for one with nothing scheduled yet.
   *
   * A surface does not choose between this and `streak`: it asks `measureOf`
   * and draws whichever the ACTIVITY declares. Both are carried here because
   * `activity_streaks` keeps being written for every type, so putting the
   * demotion back is one commit rather than a migration.
   */
  consistency: Established | null;
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

    const instant = await now();
    const timezone = (await timezoneHistory(userId)).at(instant);
    const today = DateTime.fromJSDate(instant, { zone: timezone }).toFormat("yyyy-MM-dd");

    // Only the types that carry one. A `streak` type is not asked, which keeps
    // the read off the six abstinences and out of the query for a written
    // condition somebody marked avoid.
    const wantConsistency = activities.filter(
      (a) => measureOf(getActivityType(a.typeKey), a.config) === "consistency",
    );

    const [stored, established] = await Promise.all([
      allStreaks(userId),
      consistencyFor(userId, wantConsistency, timezone, today),
    ]);

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
        grey: s.grey,
        consistency: established.get(activity.typeKey) ?? null,
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
