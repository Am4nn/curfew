import { DateTime } from "luxon";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityScores } from "@/db/schema";
import { streakOver, graceLeft, graceMonth, type StreakDay } from "@/domain";
import { getUserActivity } from "./activities";
import { scoreUser } from "./scoring";
import { now } from "@/lib/clock";

// A user's standing in one activity: the streak, the best it has ever been, and
// how much grace is left this month.
//
// Read through `standingFor`, which closes any period that has ended and not
// been scored before answering. That is the lazy close: nothing is ever wrong
// because a job was late, and it goes through the same `scoreUser` the cron
// calls, so there is one implementation and two callers.

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
  await scoreUser(userId);

  const rows = await db
    .select({
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
    })
    .from(activityScores)
    .where(and(eq(activityScores.userId, userId), eq(activityScores.typeKey, typeKey)))
    .orderBy(activityScores.periodStart);

  const days: StreakDay[] = rows.map((r) => ({ date: r.periodStart, done: r.passed }));
  const result = streakOver(days, activity.schedule.schedule, activity.schedule.grace);

  const today = DateTime.fromJSDate(await now(), { zone: "utc" }).toFormat("yyyy-MM-dd");
  return {
    typeKey,
    streak: result.current,
    best: result.best,
    graceLeft: graceLeft(result, graceMonth(today), activity.schedule.grace),
    gracePerMonth: activity.schedule.grace,
  };
}
