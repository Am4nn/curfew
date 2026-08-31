import { DateTime } from "luxon";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, activityScores, activityOutcomes, activities } from "@/db/schema";
import { resolveUserTimezone } from "./config";
import { listUserGroups } from "./groups";

// Personal analytics for a member, over their own data only. Everything here is
// derivable from events and the scores/outcomes rebuilt from them (invariant 1),
// and reads only checkin.* events (invariant 2). It is scoped to one user id;
// the streak series come from listUserGroups, itself the membership-scoped
// source (invariant 10), so a member never sees another group's numbers.

export interface StatPoint {
  date: string; // yyyy-MM-dd, or a weekday label
  value: number;
}
export interface GroupStreak {
  groupId: string;
  name: string;
  points: StatPoint[];
}
export interface PersonalStats {
  wakeRolling: StatPoint[]; // 7-sample trailing average wake minutes, per period
  weekdayPass: StatPoint[]; // pass % per weekday, Mon..Sun
  streaks: GroupStreak[];
  hasWake: boolean;
  hasScores: boolean;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startDate(days: number): string {
  return DateTime.utc().minus({ days: days - 1 }).toFormat("yyyy-MM-dd");
}
function startInstant(days: number): Date {
  return DateTime.utc().minus({ days: days - 1 }).startOf("day").toJSDate();
}

// Rolling average of the user's own wake time (minutes after local midnight).
// The raw wake instant is the evidence; there is no wake-time column.
async function rollingWake(userId: string, days: number): Promise<StatPoint[]> {
  const from = startDate(days);
  const rows = await db
    .select({ at: events.occurredAt, period: sql<string>`${events.payload}->>'period_start'` })
    .from(events)
    .where(
      and(
        eq(events.type, "checkin.sleep.wake"),
        eq(events.userId, userId),
        gte(events.occurredAt, startInstant(days)),
      ),
    );
  const tz = await resolveUserTimezone(userId, DateTime.utc().toFormat("yyyy-MM-dd"));
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
    .where(and(eq(activityScores.userId, userId), gte(activityScores.periodStart, startDate(days))));
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

// Streak over time per group the user belongs to.
async function groupStreaks(userId: string, days: number): Promise<GroupStreak[]> {
  const groups = await listUserGroups(userId);
  const from = startDate(days);
  const out: GroupStreak[] = [];
  for (const g of groups) {
    const [activity] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.groupId, g.groupId),
          eq(activities.typeKey, "sleep"),
          isNull(activities.archivedAt),
        ),
      );
    if (!activity) continue;
    const rows = await db
      .select({ periodStart: activityOutcomes.periodStart, streakAfter: activityOutcomes.streakAfter })
      .from(activityOutcomes)
      .where(
        and(
          eq(activityOutcomes.userId, userId),
          eq(activityOutcomes.activityId, activity.id),
          gte(activityOutcomes.periodStart, from),
        ),
      )
      .orderBy(activityOutcomes.periodStart);
    if (rows.length === 0) continue;
    out.push({
      groupId: g.groupId,
      name: g.name,
      points: rows.map((r) => ({ date: r.periodStart, value: r.streakAfter })),
    });
  }
  return out;
}

export async function getPersonalStats(userId: string, days = 30): Promise<PersonalStats> {
  const [wakeRolling, weekday, streaks] = await Promise.all([
    rollingWake(userId, days),
    weekdayPass(userId, 84),
    groupStreaks(userId, days),
  ]);
  return {
    wakeRolling,
    weekdayPass: weekday.points,
    streaks,
    hasWake: wakeRolling.length > 0,
    hasScores: weekday.has,
  };
}
