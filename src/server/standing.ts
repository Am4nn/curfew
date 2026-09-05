import { DateTime } from "luxon";
import { graceLeft, graceMonth } from "@/domain";
import { getUserActivity } from "./activities";
import { closeOutstanding } from "./scoring";
import { closeStreak, readStreak, rebuildStreak } from "./streak";
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
// `closeOutstanding` still runs first, because a day that ended has to be
// accounted for before the number is read, and it is request-scoped, so a
// screen asking for six streaks closes the user once. `closeStreak` then does
// nothing at all unless a period has closed since it last looked.

export interface Standing {
  typeKey: string;
  streak: number;
  best: number;
  graceLeft: number;
  gracePerMonth: number;
}

export async function standingFor(
  userId: string,
  typeKey: string,
): Promise<Standing | null> {
  const activity = await getUserActivity(userId, typeKey);
  if (!activity) return null;

  // Close anything outstanding first. Idempotent, so a read during the nightly
  // job simply agrees with it.
  await closeOutstanding(userId);
  await closeStreak(userId, typeKey);

  // Missing means this type has never been counted: a first check-in that
  // predates the counter, or a rebuilt database. Build it rather than report
  // zero, which would be a wrong number rather than an absent one.
  const stored = (await readStreak(userId, typeKey)) ?? (await rebuildStreak(userId, typeKey));
  if (!stored) return null;

  const today = DateTime.fromJSDate(await now(), { zone: "utc" }).toFormat("yyyy-MM-dd");
  return {
    typeKey,
    streak: stored.current,
    best: stored.best,
    graceLeft: graceLeft(
      { current: stored.current, best: stored.best, graceSpent: stored.graceSpent },
      graceMonth(today),
      activity.schedule.grace,
    ),
    gracePerMonth: activity.schedule.grace,
  };
}
