import { DateTime } from "luxon";
import { and, eq, gte, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, activityScores, ledgerEntries, balances, users } from "@/db/schema";
import { resolveUserTimezone } from "./config";

export interface Point {
  date: string; // yyyy-MM-dd
  value: number;
}

function startDate(days: number): string {
  return DateTime.utc().minus({ days: days - 1 }).toFormat("yyyy-MM-dd");
}
function startInstant(days: number): Date {
  return DateTime.utc().minus({ days: days - 1 }).startOf("day").toJSDate();
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
function fill(rows: { d: string; n: number }[], days: number): Point[] {
  const from = startDate(days);
  const map = new Map(rows.map((r) => [r.d, Number(r.n)]));
  return dayList(from, days).map((date) => ({ date, value: map.get(date) ?? 0 }));
}

// Daily count of check-in events (any step), by server-clock date.
export async function checkinsPerDay(days = 30): Promise<Point[]> {
  const dexpr = sql<string>`to_char(${events.occurredAt}::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ d: dexpr, n: sql<number>`count(*)` })
    .from(events)
    .where(and(like(events.type, "checkin.%"), gte(events.occurredAt, startInstant(days))))
    .groupBy(dexpr);
  return fill(rows, days);
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
    .where(gte(activityScores.periodStart, startDate(days)))
    .groupBy(activityScores.periodStart)
    .orderBy(activityScores.periodStart);
  return rows.map((r) => ({
    date: r.d,
    value: Number(r.total) === 0 ? 0 : Math.round((Number(r.passed) / Number(r.total)) * 100),
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
    .where(and(eq(ledgerEntries.kind, "fine"), gte(ledgerEntries.periodStart, startDate(days))))
    .groupBy(ledgerEntries.periodStart);
  return fill(rows, days);
}

// Average wake time (minutes after local midnight) per period, across users.
export async function wakeTrend(days = 30): Promise<Point[]> {
  const from = startDate(days);
  const rows = await db
    .select({
      userId: events.userId,
      at: events.occurredAt,
      period: sql<string>`${events.payload}->>'period_start'`,
    })
    .from(events)
    .where(and(eq(events.type, "checkin.sleep.wake"), gte(events.occurredAt, startInstant(days))));

  const tzByUser = new Map<string, string>();
  async function tzOf(userId: string): Promise<string> {
    let tz = tzByUser.get(userId);
    if (!tz) {
      tz = await resolveUserTimezone(userId, DateTime.utc().toFormat("yyyy-MM-dd"));
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
