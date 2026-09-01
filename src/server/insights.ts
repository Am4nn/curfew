import { DateTime } from "luxon";
import { and, eq, gte, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, activityScores, ledgerEntries, balances, users } from "@/db/schema";
import { resolveUserTimezone } from "./config";
import { nowUTC } from "@/lib/clock";

export interface Point {
  date: string; // yyyy-MM-dd
  value: number;
}

async function startDate(days: number): Promise<string> {
  return (await nowUTC()).minus({ days: days - 1 }).toFormat("yyyy-MM-dd");
}
async function startInstant(days: number): Promise<Date> {
  return (await nowUTC()).minus({ days: days - 1 }).startOf("day").toJSDate();
}
function dayList(from: string, days: number): string[] {
  const out: string[] = [];
  let d = DateTime.fromISO(from, { zone: "utc" });
  for (let i = 0; i < days; i++) {
    out.push(d.toFormat("yyyy-MM-dd"));
    d = d.plus({ days: 1 });
  }
  return out;
}
// Fill missing days with zero so a bar chart has a slot per day.
function fill(rows: { d: string; n: number }[], from: string, days: number): Point[] {
  const map = new Map(rows.map((r) => [r.d, Number(r.n)]));
  return dayList(from, days).map((date) => ({ date, value: map.get(date) ?? 0 }));
}

// Daily count of check-in events (any step), by server-clock date.
export async function checkinsPerDay(days = 30): Promise<Point[]> {
  const dexpr = sql<string>`to_char(${events.occurredAt}::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ d: dexpr, n: sql<number>`count(*)` })
    .from(events)
    .where(and(like(events.type, "checkin.%"), gte(events.occurredAt, await startInstant(days))))
    .groupBy(dexpr);
  return fill(rows, await startDate(days), days);
}

// Pass rate per period, as a percentage. Only days that were scored appear.
export async function passRateOverTime(days = 30): Promise<Point[]> {
  const rows = await db
    .select({
      d: activityScores.periodStart,
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(case when ${activityScores.passed} then 1 else 0 end)`,
    })
    .from(activityScores)
    .where(gte(activityScores.periodStart, await startDate(days)))
    .groupBy(activityScores.periodStart)
    .orderBy(activityScores.periodStart);
  return rows.map((r) => ({
    date: r.d,
    value: Number(r.total) === 0 ? 0 : Math.round((Number(r.passed) / Number(r.total)) * 100),
  }));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Pass rate by weekday (Mon..Sun), as a percentage, across users. A longer
// window than the other charts so each weekday has enough scored periods.
// Weekday comes from the period, resolved in that period's own boundary.
export async function passRateByWeekday(days = 84): Promise<Point[]> {
  const rows = await db
    .select({ periodStart: activityScores.periodStart, passed: activityScores.passed })
    .from(activityScores)
    .where(gte(activityScores.periodStart, await startDate(days)));
  const agg = WEEKDAYS.map(() => ({ pass: 0, total: 0 }));
  for (const r of rows) {
    const idx = DateTime.fromISO(r.periodStart).weekday - 1; // 1=Mon..7=Sun
    agg[idx].total += 1;
    if (r.passed) agg[idx].pass += 1;
  }
  return WEEKDAYS.map((label, i) => ({
    date: label,
    value: agg[i].total === 0 ? 0 : Math.round((agg[i].pass / agg[i].total) * 100),
  }));
}

// Total fines per period, in minor units.
export async function finesPerDay(days = 30): Promise<Point[]> {
  const rows = await db
    .select({
      d: sql<string>`${ledgerEntries.periodStart}`,
      n: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)`,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.kind, "fine"), gte(ledgerEntries.periodStart, await startDate(days))))
    .groupBy(ledgerEntries.periodStart);
  return fill(rows, await startDate(days), days);
}

// Average wake time (minutes after local midnight) per period, across users.
export async function wakeTrend(days = 30): Promise<Point[]> {
  const from = await startDate(days);
  const rows = await db
    .select({
      userId: events.userId,
      at: events.occurredAt,
      period: sql<string>`${events.payload}->>'period_start'`,
    })
    .from(events)
    .where(and(eq(events.type, "checkin.sleep.wake"), gte(events.occurredAt, await startInstant(days))));

  const tzByUser = new Map<string, string>();
  async function tzOf(userId: string): Promise<string> {
    let tz = tzByUser.get(userId);
    if (!tz) {
      tz = await resolveUserTimezone(userId, (await nowUTC()).toFormat("yyyy-MM-dd"));
      tzByUser.set(userId, tz);
    }
    return tz;
  }

  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (!r.userId || !r.period || r.period < from) continue;
    const tz = await tzOf(r.userId);
    const local = DateTime.fromJSDate(r.at, { zone: tz });
    const minutes = local.hour * 60 + local.minute;
    const a = acc.get(r.period) ?? { sum: 0, n: 0 };
    a.sum += minutes;
    a.n += 1;
    acc.set(r.period, a);
  }
  return [...acc.entries()]
    .map(([date, a]) => ({ date, value: Math.round(a.sum / a.n) }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

export interface BalanceBar {
  name: string;
  netOwed: number; // positive = owes
  currency: string;
}

// Net owed per user across all groups (positive means they owe).
export async function outstandingBalances(): Promise<BalanceBar[]> {
  const rows = await db
    .select({
      name: users.name,
      currency: balances.currency,
      net: sql<number>`sum(${balances.netOwed})`,
    })
    .from(balances)
    .innerJoin(users, eq(users.id, balances.userId))
    .groupBy(users.name, balances.currency);
  return rows
    .map((r) => ({ name: r.name, currency: r.currency ?? "INR", netOwed: Number(r.net) }))
    .filter((b) => b.netOwed !== 0)
    .sort((a, b) => b.netOwed - a.netOwed);
}
