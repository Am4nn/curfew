import { DateTime } from "luxon";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { activityScores } from "@/db/schema";
import { getActivityType, graceMonth, type ChartSpec } from "@/domain";
import { listUserActivities } from "./activities";
import { standingFor } from "./standing";
import { scoreUser } from "./scoring";
import { resolveUserTimezone } from "./config";
import { now } from "@/lib/clock";

// Personal stats. Everything here is counted from `activity_scores`, which is
// derived from check-in events alone (invariant 2): no sessions, no last_seen,
// nothing ambient.

export interface Overview {
  perfectDays: number;
  daysInMonth: number;
  passRate: number;
  longestStreak: number;
  graceLeft: number;
  /** Eight weeks of days, each 0..1 of what was scheduled, -1 for the future. */
  heatmap: number[][];
  byActivity: {
    typeKey: string;
    name: string;
    icon: string;
    percent: number;
    streak: number;
  }[];
}

export async function overviewFor(userId: string): Promise<Overview> {
  await scoreUser(userId);

  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );
  const today = DateTime.fromJSDate(instant, { zone: timezone });
  const monthStart = today.startOf("month");
  const from = today.minus({ days: 55 }).toFormat("yyyy-MM-dd");

  const rows = await db
    .select({
      typeKey: activityScores.typeKey,
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
    })
    .from(activityScores)
    .where(and(eq(activityScores.userId, userId), gte(activityScores.periodStart, from)))
    .orderBy(activityScores.periodStart);

  // A day's completion: how much of what was scheduled was done.
  const byDay = new Map<string, { done: number; of: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.periodStart) ?? { done: 0, of: 0 };
    cur.of += 1;
    if (r.passed) cur.done += 1;
    byDay.set(r.periodStart, cur);
  }

  const thisMonth = [...byDay.entries()].filter(
    ([day]) => day >= monthStart.toFormat("yyyy-MM-dd"),
  );
  const perfectDays = thisMonth.filter(([, v]) => v.of > 0 && v.done === v.of).length;

  const last30 = rows.filter(
    (r) => r.periodStart >= today.minus({ days: 29 }).toFormat("yyyy-MM-dd"),
  );
  const passRate =
    last30.length === 0
      ? 0
      : Math.round((last30.filter((r) => r.passed).length / last30.length) * 100);

  // Eight weeks ending on this week, Monday first.
  const gridStart = today.startOf("week").minus({ weeks: 7 });
  const heatmap: number[][] = [];
  for (let w = 0; w < 8; w += 1) {
    const week: number[] = [];
    for (let d = 0; d < 7; d += 1) {
      const day = gridStart.plus({ weeks: w, days: d });
      if (day > today) {
        week.push(-1);
        continue;
      }
      const v = byDay.get(day.toFormat("yyyy-MM-dd"));
      week.push(v && v.of > 0 ? v.done / v.of : 0);
    }
    heatmap.push(week);
  }

  const mine = (await listUserActivities(userId)).filter((a) => a.enabled);
  const byActivity: Overview["byActivity"] = [];
  let longestStreak = 0;
  let graceLeft = 0;

  for (const a of mine) {
    const type = getActivityType(a.typeKey);
    const its = last30.filter((r) => r.typeKey === a.typeKey);
    const standing = await standingFor(userId, a.typeKey);
    if (standing) {
      longestStreak = Math.max(longestStreak, standing.streak);
      graceLeft += standing.graceLeft;
    }
    byActivity.push({
      typeKey: a.typeKey,
      name: type.name,
      icon: type.icon,
      percent:
        its.length === 0
          ? 0
          : Math.round((its.filter((r) => r.passed).length / its.length) * 100),
      streak: standing?.streak ?? 0,
    });
  }
  byActivity.sort((a, b) => b.percent - a.percent);

  return {
    perfectDays,
    daysInMonth: today.daysInMonth ?? 30,
    passRate,
    longestStreak,
    graceLeft,
    heatmap,
    byActivity,
  };
}

export interface ActivityChart {
  typeKey: string;
  name: string;
  icon: string;
  /** The module's own chart declaration: kind, heading, and its own fields. */
  spec: ChartSpec;
  /** Oldest first. `detail` is the module's own, printed by nobody. */
  points: { periodStart: string; passed: boolean; detail: Record<string, unknown> }[];
  graceMonthLabel: string;
  /** The three figures under every chart, whatever its kind. */
  streak: number;
  best: number;
  graceLeft: number;
  /** The user's other tracked activities, for the picker at the top. */
  others: { typeKey: string; name: string; icon: string }[];
}

/**
 * One activity's history, for the chart its module named.
 *
 * The engine draws four kinds and the module says which (invariant 6). The
 * detail travels as it is; only the chart for that kind reads it.
 */
export async function chartFor(
  userId: string,
  typeKey: string,
): Promise<ActivityChart | null> {
  const all = (await listUserActivities(userId)).filter((a) => a.enabled);
  const mine = all.find((a) => a.typeKey === typeKey);
  if (!mine) return null;

  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );
  const today = DateTime.fromJSDate(instant, { zone: timezone });
  const type = getActivityType(typeKey);
  // A weekly period needs a longer window to draw the same number of bars: ten
  // weeks against thirty days, as the two mocks show.
  const window = type.chart.kind === "weekly" ? 69 : 29;
  const from = today.minus({ days: window }).toFormat("yyyy-MM-dd");

  const rows = await db
    .select({
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
      detail: activityScores.detail,
    })
    .from(activityScores)
    .where(
      and(
        eq(activityScores.userId, userId),
        eq(activityScores.typeKey, typeKey),
        gte(activityScores.periodStart, from),
      ),
    )
    .orderBy(activityScores.periodStart);

  const standing = await standingFor(userId, typeKey);
  return {
    typeKey,
    name: type.name,
    icon: type.icon,
    spec: type.chart,
    points: rows.map((r) => ({
      periodStart: r.periodStart,
      passed: r.passed,
      detail: (r.detail ?? {}) as Record<string, unknown>,
    })),
    graceMonthLabel: graceMonth(today.toFormat("yyyy-MM-dd")),
    streak: standing?.streak ?? 0,
    best: standing?.best ?? 0,
    graceLeft: standing?.graceLeft ?? 0,
    others: all
      .filter((a) => a.typeKey !== typeKey)
      .map((a) => {
        const t = getActivityType(a.typeKey);
        return { typeKey: a.typeKey, name: t.name, icon: t.icon };
      }),
  };
}
