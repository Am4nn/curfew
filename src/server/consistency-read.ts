import { and, eq, gte, inArray, like, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { activityScores, events } from "@/db/schema";
import {
  consistency,
  periodStart,
  periodUnit,
  WINDOW_PERIODS,
  type Consistency,
  type ConsistencyPeriod,
} from "@/domain";
import type { UserActivity } from "./activities";

// What `consistency()` needs, read out of the database (1.56).
//
// It lives beside `standingsFor` rather than inside it because the domain
// function is pure and this is the only impure half: three batched queries,
// no per-activity round trips. Home draws seven rows and the shape it replaced
// would have issued fourteen.
//
// NOTHING IS STORED. Every input is already in `activity_scores` and `events`,
// so invariant 1 holds, there is no migration, and `verify` has nothing new to
// diff.

/**
 * How far back to read scored periods.
 *
 * Thirty periods, and a period can be a week: Gym needs 210 days to have
 * thirty of them, so this is that plus room for weeks nothing was scheduled
 * in. A daily type reads thirty rows out of it and ignores the rest.
 */
const LOOKBACK_DAYS = 260;

function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: "utc" }).plus({ days }).toFormat("yyyy-MM-dd");
}

/**
 * Minutes past midnight, in the member's own zone.
 *
 * The zone matters and UTC would be wrong in the way that is hardest to see: a
 * 7 AM press in Kolkata is 01:30 UTC, and a cue read in UTC would describe a
 * habit nobody has.
 */
function minuteOfDay(at: Date, timezone: string): number {
  const t = DateTime.fromJSDate(at, { zone: timezone });
  return t.hour * 60 + t.minute;
}

/**
 * How far back the trend looks.
 *
 * A week, per 1.55. Against yesterday the arrow would point somewhere new most
 * days, which is noise rather than signal; a week is long enough that a change
 * of direction means something happened.
 */
const TREND_PERIODS = 7;

export interface Established extends Consistency {
  /** Against the same number `TREND_PERIODS` ago. */
  trend: "up" | "down" | "flat";
}

/**
 * Every tracked activity's consistency, or null for one that carries a streak.
 *
 * `measure` decides which, and this does not: the caller passes only the
 * activities it wants an answer for.
 */
export async function consistencyFor(
  userId: string,
  activities: UserActivity[],
  timezone: string,
  today: string,
): Promise<Map<string, Established | null>> {
  const out = new Map<string, Established | null>();
  if (activities.length === 0) return out;

  const keys = activities.map((a) => a.typeKey);
  const from = addDays(today, -LOOKBACK_DAYS);

  const [scored, lifetime, presses] = await Promise.all([
    db
      .select({
        typeKey: activityScores.typeKey,
        periodStart: activityScores.periodStart,
        passed: activityScores.passed,
        paused: activityScores.paused,
      })
      .from(activityScores)
      .where(
        and(
          eq(activityScores.userId, userId),
          inArray(activityScores.typeKey, keys),
          gte(activityScores.periodStart, from),
        ),
      ),

    // Lifetime, not the window (see `consistency`): somebody who did this for
    // a year, stopped and came back does not restart at zero maturity.
    db
      .select({
        typeKey: activityScores.typeKey,
        passed: sql<number>`count(*)::int`,
      })
      .from(activityScores)
      .where(
        and(
          eq(activityScores.userId, userId),
          inArray(activityScores.typeKey, keys),
          eq(activityScores.passed, true),
          eq(activityScores.paused, false),
        ),
      )
      .groupBy(activityScores.typeKey),

    db
      .select({ type: events.type, occurredAt: events.occurredAt })
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          like(events.type, "checkin.%"),
          gte(events.occurredAt, new Date(`${from}T00:00:00Z`)),
        ),
      ),
  ]);

  const everPassed = new Map(lifetime.map((r) => [r.typeKey, r.passed]));

  for (const activity of activities) {
    const spec = {
      unit: periodUnit(activity.schedule.schedule),
      boundary: activity.schedule.dayBoundary,
    };

    // THE FIRST press of a period, not the last, and the activities review is
    // why. For a counted type the cue is the first repetition: water's eighth
    // glass at 9 PM says when somebody finished, and the first at 7 AM says
    // when they start. The last press is a deadline, not a habit.
    const firstPress = new Map<string, Date>();
    for (const press of presses) {
      if (!press.type.startsWith(`checkin.${activity.typeKey}.`)) continue;
      const period = periodStart(press.occurredAt, timezone, spec);
      const held = firstPress.get(period);
      if (!held || press.occurredAt < held) firstPress.set(period, press.occurredAt);
    }

    // PAUSED PERIODS LEAVE THE DENOMINATOR ENTIRELY (1.55). An away day is one
    // somebody told Curfew not to judge, so counting it as a miss is the
    // opposite of what declaring it is for.
    //
    // A SETTLING period stays. It is a real repetition: settling holds
    // REPUTATION still and never the behaviour (1.44).
    const window: ConsistencyPeriod[] = scored
      .filter((r) => r.typeKey === activity.typeKey && !r.paused)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      .slice(-WINDOW_PERIODS)
      .map((r) => {
        const at = firstPress.get(r.periodStart);
        return {
          passed: r.passed,
          minuteOfDay: at ? minuteOfDay(at, timezone) : null,
        };
      });

    const lifetimePassed = everPassed.get(activity.typeKey) ?? 0;
    const nowN = consistency({ window, lifetimePassed });
    if (!nowN) {
      out.set(activity.typeKey, null);
      continue;
    }

    // The same function on the same data, ending a week earlier. Both the
    // window and the lifetime have to move back, or the older number would be
    // computed with maturity it had not earned yet and every arrow would point
    // down.
    const older = window.slice(0, -TREND_PERIODS);
    const dropped = window.slice(-TREND_PERIODS).filter((p) => p.passed).length;
    const then = consistency({
      window: older,
      lifetimePassed: Math.max(0, lifetimePassed - dropped),
    });

    const delta = then === null ? 0 : nowN.percent - then.percent;
    out.set(activity.typeKey, {
      ...nowN,
      trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    });
  }

  return out;
}
