import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { activityScores, reputationDaily, userActivities } from "@/db/schema";
import { recomputeUser } from "./scoring";

export interface Drift {
  kind: "score" | "reputation";
  key: string;
  field: string;
  stored: unknown;
  computed: unknown;
}

/**
 * Recompute a range from events and diff it against what is stored.
 *
 * Goes through the same `recomputeUser` the scorer writes from, so it uses the
 * same effective-dated lookups and never reports a past config change as drift
 * (invariant 5). Read-only.
 */
export async function verifyUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<Drift[]> {
  const { scores, reputation } = await recomputeUser(userId, opts);
  const drift: Drift[] = [];
  if (scores.length === 0 && reputation.length === 0) return drift;

  if (scores.length > 0) {
    const periods = scores.map((s) => s.periodStart).sort();
    const lo = periods[0];
    const hi = periods[periods.length - 1];

    const stored = await db
      .select()
      .from(activityScores)
      .where(
        and(
          eq(activityScores.userId, userId),
          gte(activityScores.periodStart, lo),
          lte(activityScores.periodStart, hi),
        ),
      );
    const byKey = new Map(stored.map((s) => [`${s.typeKey}|${s.periodStart}`, s]));

    for (const c of scores) {
      const key = `${c.typeKey}|${c.periodStart}`;
      const s = byKey.get(key);
      if (!s) {
        drift.push({ kind: "score", key, field: "*", stored: null, computed: c.passed });
        continue;
      }
      if (s.passed !== c.passed) {
        drift.push({ kind: "score", key, field: "passed", stored: s.passed, computed: c.passed });
      }
      if (s.settling !== c.settling) {
        drift.push({
          kind: "score",
          key,
          field: "settling",
          stored: s.settling,
          computed: c.settling,
        });
      }
    }
  }

  if (reputation.length > 0) {
    const days = reputation.map((r) => r.day).sort();
    const stored = await db
      .select()
      .from(reputationDaily)
      .where(
        and(
          eq(reputationDaily.userId, userId),
          isNull(reputationDaily.groupId),
          gte(reputationDaily.day, days[0]),
          lte(reputationDaily.day, days[days.length - 1]),
        ),
      );
    const byDay = new Map(stored.map((r) => [r.day, r]));

    for (const c of reputation) {
      const s = byDay.get(c.day);
      if (!s) {
        drift.push({ kind: "reputation", key: c.day, field: "*", stored: null, computed: c.score });
        continue;
      }
      // Stored as numeric, so compare the numbers rather than their spelling.
      if (Math.abs(Number(s.score) - Number(c.score)) > 0.001) {
        drift.push({
          kind: "reputation",
          key: c.day,
          field: "score",
          stored: s.score,
          computed: c.score,
        });
      }
      if (s.reason !== c.reason) {
        drift.push({
          kind: "reputation",
          key: c.day,
          field: "reason",
          stored: s.reason,
          computed: c.reason,
        });
      }
    }
  }

  return drift;
}

export async function verifyAll(
  opts: { from?: string; to?: string } = {},
): Promise<Drift[]> {
  const users = await db.selectDistinct({ userId: userActivities.userId }).from(userActivities);
  const all: Drift[] = [];
  for (const u of users) {
    all.push(...(await verifyUser(u.userId, opts)));
  }
  return all;
}
