import { DateTime } from "luxon";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, activityScores } from "@/db/schema";
import { resolveUserTimezone } from "./config";
import { nowUTC } from "@/lib/clock";

// Personal analytics for a member, over their own data only. Everything here is
// derivable from events and the scores rebuilt from them (invariant 1), and
// reads only checkin.* events (invariant 2). Scoped to one user id.

export interface StatPoint {
  date: string; // yyyy-MM-dd, or a weekday label
  value: number;
}
export interface PersonalStats {
  wakeRolling: StatPoint[]; // 7-sample trailing average wake minutes, per period
  weekdayPass: StatPoint[]; // pass % per weekday, Mon..Sun
  monthPassRate: number | null; // % of scored nights passed over the window, null if none
  hasWake: boolean;
  hasScores: boolean;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function startDate(days: number): Promise<string> {
  return (await nowUTC()).minus({ days: days - 1 }).toFormat("yyyy-MM-dd");
}
async function startInstant(days: number): Promise<Date> {
  return (await nowUTC()).minus({ days: days - 1 }).startOf("day").toJSDate();
}

// Rolling average of the user's own wake time (minutes after local midnight).
// The raw wake instant is the evidence; there is no wake-time column.
async function rollingWake(userId: string, days: number): Promise<StatPoint[]> {
  const from = await startDate(days);
  const rows = await db
    .select({ at: events.occurredAt, period: sql<string>`${events.payload}->>'period_start'` })
    .from(events)
    .where(
      and(
        eq(events.type, "checkin.sleep.wake"),
        eq(events.userId, userId),
        gte(events.occurredAt, await startInstant(days)),
      ),
    );
  const tz = await resolveUserTimezone(userId, (await nowUTC()).toFormat("yyyy-MM-dd"));
  const perPeriod = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (!r.period || r.period < from) continue;
    const local = DateTime.fromJSDate(r.at, { zone: tz });
    const minutes = local.hour * 60 + local.minute;
    const a = perPeriod.get(r.period) ?? { sum: 0, n: 0 };
    a.sum += minutes;
    a.n += 1;
    perPeriod.set(r.period, a);
  }
  const daily = [...perPeriod.entries()]
    .map(([date, a]) => ({ date, value: a.sum / a.n }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));

  const win: number[] = [];
  return daily.map((d) => {
    win.push(d.value);
    if (win.length > 7) win.shift();
    return { date: d.date, value: Math.round(win.reduce((s, v) => s + v, 0) / win.length) };
  });
}

// Pass rate per weekday from the user's own scores (group-independent: did they
// meet their own targets). Weekday comes from the period date.
async function weekdayPass(
  userId: string,
  days: number,
): Promise<{ points: StatPoint[]; has: boolean }> {
  const rows = await db
    .select({ periodStart: activityScores.periodStart, passed: activityScores.passed })
    .from(activityScores)
    .where(and(eq(activityScores.userId, userId), gte(activityScores.periodStart, await startDate(days))));
  const agg = WEEKDAYS.map(() => ({ pass: 0, total: 0 }));
  for (const r of rows) {
    const idx = DateTime.fromISO(r.periodStart).weekday - 1;
    agg[idx].total += 1;
    if (r.passed) agg[idx].pass += 1;
  }
  return {
    points: WEEKDAYS.map((label, i) => ({
      date: label,
      value: agg[i].total === 0 ? 0 : Math.round((agg[i].pass / agg[i].total) * 100),
    })),
    has: rows.length > 0,
  };
}

// Overall pass rate over the window: share of the user's own scored nights that
// passed. Group-independent, from activity_scores.
async function monthPassRate(userId: string, days: number): Promise<number | null> {
  const rows = await db
    .select({ passed: activityScores.passed })
    .from(activityScores)
    .where(
      and(
        eq(activityScores.userId, userId),
        eq(activityScores.typeKey, "sleep"),
        gte(activityScores.periodStart, await startDate(days)),
      ),
    );
  if (rows.length === 0) return null;
  const passed = rows.filter((r) => r.passed).length;
  return Math.round((passed / rows.length) * 100);
}

export async function getPersonalStats(userId: string, days = 30): Promise<PersonalStats> {
  const [wakeRolling, weekday, monthRate] = await Promise.all([
    rollingWake(userId, days),
    weekdayPass(userId, 84),
    monthPassRate(userId, days),
  ]);
  return {
    wakeRolling,
    weekdayPass: weekday.points,
    monthPassRate: monthRate,
    hasWake: wakeRolling.length > 0,
    hasScores: weekday.has,
  };
}
