import { DateTime } from "luxon";
import { and, eq, gte, inArray, isNull, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  activityScores,
  userApprovals,
  userActivities,
  groups,
  groupMembers,
  activityOutcomes,
} from "@/db/schema";
import { getActivityType } from "@/domain";
import { moneyOnFor } from "./app-config";
import { ownerMoneyToggle } from "./sharing";
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

function average(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((s, v) => s + v, 0) / nums.length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** A type's name and icon, or the raw key if it is no longer registered. */
function typeLabel(typeKey: string): { name: string; icon: string } {
  try {
    const t = getActivityType(typeKey);
    return { name: t.name, icon: t.icon };
  } catch {
    return { name: typeKey, icon: "" };
  }
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

/**
 * The one-line read on the check-ins-a-day chart: last 7 days average against
 * the 7 before it, and whether Saturday and Sunday sit measurably below the
 * weekdays in that same window. Computed, not written by hand.
 */
export function checkinsTrendCaption(points: Point[]): string {
  if (points.length < 14) return "Not enough history yet.";

  const last7 = points.slice(-7);
  const prior7 = points.slice(-14, -7);
  const recentAvg = average(last7.map((p) => p.value));
  const priorAvg = average(prior7.map((p) => p.value));
  const change = priorAvg === 0 ? 0 : (recentAvg - priorAvg) / priorAvg;

  const trend = change > 0.05 ? "Rising." : change < -0.05 ? "Falling." : "Flat.";

  const window = points.slice(-14);
  const weekday: number[] = [];
  const weekend: number[] = [];
  for (const p of window) {
    const dow = DateTime.fromISO(p.date, { zone: "utc" }).weekday; // 1=Mon..7=Sun
    (dow === 6 || dow === 7 ? weekend : weekday).push(p.value);
  }
  const weekdayAvg = average(weekday);
  const weekendAvg = average(weekend);
  const weekendDip = weekday.length > 0 && weekend.length > 0 && weekendAvg < weekdayAvg * 0.9;

  return weekendDip ? `${trend} Weekends are the dips.` : trend;
}

export interface TopStats {
  checkedInToday: number;
  pctOfApproved: number;
  silent7Days: number;
}

/** Checked in today, that as a share of approved users, and who has gone quiet. */
export async function topStats(): Promise<TopStats> {
  const todayStart = await startInstant(1);
  const sevenDaysAgo = await startInstant(7);

  const [[todayRow], approved, recent] = await Promise.all([
    db
      .select({ n: sql<number>`count(distinct ${events.userId})` })
      .from(events)
      .where(and(like(events.type, "checkin.%"), gte(events.occurredAt, todayStart))),
    db
      .select({ userId: userApprovals.userId })
      .from(userApprovals)
      .where(eq(userApprovals.status, "approved")),
    db
      .selectDistinct({ userId: events.userId })
      .from(events)
      .where(and(like(events.type, "checkin.%"), gte(events.occurredAt, sevenDaysAgo))),
  ]);

  const checkedInToday = Number(todayRow?.n ?? 0);
  const approvedCount = approved.length;
  const recentIds = new Set(recent.map((r) => r.userId).filter((id): id is string => id !== null));
  const silent7Days = approved.filter((a) => !recentIds.has(a.userId)).length;

  return {
    checkedInToday,
    pctOfApproved: approvedCount === 0 ? 0 : Math.round((checkedInToday / approvedCount) * 100),
    silent7Days,
  };
}

export interface TypeRate {
  typeKey: string;
  name: string;
  icon: string;
  percent: number;
}

/** Pass rate per activity type, across every user, worst last. */
export async function passRateByType(): Promise<TypeRate[]> {
  const rows = await db
    .select({
      typeKey: activityScores.typeKey,
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(case when ${activityScores.passed} then 1 else 0 end)`,
    })
    .from(activityScores)
    .groupBy(activityScores.typeKey);

  return rows
    .map((r) => {
      const { name, icon } = typeLabel(r.typeKey);
      const percent = Number(r.total) === 0 ? 0 : Math.round((Number(r.passed) / Number(r.total)) * 100);
      return { typeKey: r.typeKey, name, icon, percent };
    })
    .sort((a, b) => b.percent - a.percent);
}

/**
 * The callout under "what people actually hold": names the worst-passing
 * type, and only connects it to abandonment when that type is genuinely near
 * the top of the abandonment list too. No connection is forced.
 */
export function worstTypeCallout(rates: TypeRate[], abandonment: AbandonRate[]): string | null {
  if (rates.length === 0) return null;
  const worst = rates[rates.length - 1];
  const abandonRank = abandonment.findIndex((a) => a.typeKey === worst.typeKey);
  const isTopAbandoned = abandonRank >= 0 && abandonRank < 2;
  if (isTopAbandoned) {
    return `${worst.name} is the type people add and then stop hitting. Worth asking whether its defaults are wrong.`;
  }
  return `${worst.name} has the lowest pass rate, at ${worst.percent}%.`;
}

export interface AbandonRate {
  typeKey: string;
  name: string;
  percent: number;
}

/**
 * Per type: of the users who ever turned it on, the share whose earliest
 * enable was followed by a disable within 14 days. Reads only the switch
 * (enabled/effective_at), never the settings it configures.
 */
export async function abandonmentByType(): Promise<AbandonRate[]> {
  const rows = await db
    .select({
      userId: userActivities.userId,
      typeKey: userActivities.typeKey,
      enabled: userActivities.enabled,
      effectiveAt: userActivities.effectiveAt,
    })
    .from(userActivities)
    .orderBy(userActivities.userId, userActivities.typeKey, userActivities.effectiveAt);

  const byUserType = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.userId}|${r.typeKey}`;
    const arr = byUserType.get(k);
    if (arr) arr.push(r);
    else byUserType.set(k, [r]);
  }

  const started = new Map<string, Set<string>>(); // typeKey -> userIds
  const abandoned = new Map<string, Set<string>>();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  for (const [key, arr] of byUserType) {
    const [userId, typeKey] = key.split("|");
    const firstEnable = arr.find((r) => r.enabled);
    if (!firstEnable) continue;

    const startedSet = started.get(typeKey) ?? new Set<string>();
    startedSet.add(userId);
    started.set(typeKey, startedSet);

    const disabledWithin = arr.find(
      (r) =>
        !r.enabled &&
        r.effectiveAt.getTime() > firstEnable.effectiveAt.getTime() &&
        r.effectiveAt.getTime() - firstEnable.effectiveAt.getTime() <= FOURTEEN_DAYS_MS,
    );
    if (disabledWithin) {
      const abandonedSet = abandoned.get(typeKey) ?? new Set<string>();
      abandonedSet.add(userId);
      abandoned.set(typeKey, abandonedSet);
    }
  }

  const out: AbandonRate[] = [];
  for (const [typeKey, startedSet] of started) {
    const abandonedCount = abandoned.get(typeKey)?.size ?? 0;
    const { name } = typeLabel(typeKey);
    out.push({
      typeKey,
      name,
      percent: startedSet.size === 0 ? 0 : Math.round((abandonedCount / startedSet.size) * 100),
    });
  }
  return out.sort((a, b) => b.percent - a.percent);
}

export interface GroupsSummary {
  activeThisWeek: { count: number; of: number };
  dormantAMonth: number;
  trackingMoney: { count: number; of: number };
  medianSize: number;
}

/**
 * Four counted facts about groups: recent activity, dormancy, whether money
 * is genuinely on (app-wide switch, admin override, owner toggle, same
 * resolution as the group hub), and typical size.
 */
export async function groupsSummary(): Promise<GroupsSummary> {
  const allGroups = await db.select({ id: groups.id }).from(groups).where(isNull(groups.archivedAt));
  const total = allGroups.length;
  if (total === 0) {
    return {
      activeThisWeek: { count: 0, of: 0 },
      dormantAMonth: 0,
      trackingMoney: { count: 0, of: 0 },
      medianSize: 0,
    };
  }
  const ids = allGroups.map((g) => g.id);

  const [weekActive, monthActive, memberCounts] = await Promise.all([
    db
      .selectDistinct({ groupId: activityOutcomes.groupId })
      .from(activityOutcomes)
      .where(and(inArray(activityOutcomes.groupId, ids), gte(activityOutcomes.periodStart, await startDate(7)))),
    db
      .selectDistinct({ groupId: activityOutcomes.groupId })
      .from(activityOutcomes)
      .where(and(inArray(activityOutcomes.groupId, ids), gte(activityOutcomes.periodStart, await startDate(30)))),
    db
      .select({ groupId: groupMembers.groupId, n: sql<number>`count(*)` })
      .from(groupMembers)
      .where(and(inArray(groupMembers.groupId, ids), isNull(groupMembers.leftAt)))
      .groupBy(groupMembers.groupId),
  ]);

  const monthActiveIds = new Set(monthActive.map((r) => r.groupId));
  const dormantAMonth = total - monthActiveIds.size;

  // No batch form of "is money genuinely on" exists (it resolves three
  // append-only, effective-dated sources per group), so this is one pair of
  // queries per group rather than a single aggregate one. Fine at admin scale;
  // would need a batched resolver if the group count grows large.
  const now = new Date();
  const moneyOn = await Promise.all(
    ids.map(async (id) => moneyOnFor(id, await ownerMoneyToggle(id), now)),
  );
  const moneyOnCount = moneyOn.filter(Boolean).length;

  const sizeByGroup = new Map(memberCounts.map((m) => [m.groupId, Number(m.n)]));
  const sizes = ids.map((id) => sizeByGroup.get(id) ?? 0);

  return {
    activeThisWeek: { count: weekActive.length, of: total },
    dormantAMonth,
    trackingMoney: { count: moneyOnCount, of: total },
    medianSize: median(sizes),
  };
}
