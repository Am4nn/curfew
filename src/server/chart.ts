import { DateTime } from "luxon";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { events, groupMembers, users } from "@/db/schema";
import { resolveUserTimezone } from "./config";

export interface WakePoint {
  dayIndex: number; // 0..days-1 within the window
  minutes: number; // minutes after local midnight
}
export interface WakeSeries {
  userId: string;
  name: string;
  points: WakePoint[];
}
export interface WakeChart {
  days: number;
  startDate: string;
  series: WakeSeries[];
  hasData: boolean;
}

// Actual wake times over the last N days for a group's members, each in their
// own timezone. Descriptive only: PRD says the chart never ranks anyone.
export async function getWakeChart(groupId: string, days = 30): Promise<WakeChart> {
  const start = DateTime.utc().minus({ days: days - 1 }).toFormat("yyyy-MM-dd");

  const members = await db
    .select({ userId: groupMembers.userId, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));

  const uniq = new Map(members.map((m) => [m.userId, m.name]));
  if (uniq.size === 0) return { days, startDate: start, series: [], hasData: false };

  const rows = await db
    .select({
      userId: events.userId,
      occurredAt: events.occurredAt,
    })
    .from(events)
    .where(
      and(
        eq(events.type, "checkin.sleep.wake"),
        inArray(events.userId, [...uniq.keys()]),
        gte(events.occurredAt, new Date(`${start}T00:00:00Z`)),
      ),
    );

  const tzByUser = new Map<string, string>();
  for (const uid of uniq.keys()) {
    tzByUser.set(uid, await resolveUserTimezone(uid, DateTime.utc().toFormat("yyyy-MM-dd")));
  }

  const byUser = new Map<string, WakePoint[]>();
  const startDt = DateTime.fromISO(start, { zone: "utc" });
  for (const r of rows) {
    if (!r.userId) continue;
    const tz = tzByUser.get(r.userId) ?? "Asia/Kolkata";
    const local = DateTime.fromJSDate(r.occurredAt, { zone: tz });
    const dayIndex = Math.floor(local.startOf("day").diff(startDt, "days").days);
    if (dayIndex < 0 || dayIndex >= days) continue;
    const minutes = local.hour * 60 + local.minute;
    const list = byUser.get(r.userId) ?? [];
    list.push({ dayIndex, minutes });
    byUser.set(r.userId, list);
  }

  const series: WakeSeries[] = [...uniq.entries()].map(([userId, name]) => ({
    userId,
    name,
    points: (byUser.get(userId) ?? []).sort((a, b) => a.dayIndex - b.dayIndex),
  }));

  return { days, startDate: start, series, hasData: series.some((s) => s.points.length > 0) };
}
