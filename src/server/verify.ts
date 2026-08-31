import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { activityScores, activityOutcomes, groupMembers } from "@/db/schema";
import { recomputeUser } from "./scoring";

export interface Drift {
  kind: "score" | "outcome";
  key: string;
  field: string;
  stored: unknown;
  computed: unknown;
}

// Recompute [from..to] from events and diff against what is stored. Uses the
// same effective-dated lookups as scoring (via recomputeUser), so a past config
// change is not reported as drift. Read-only.
export async function verifyUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<Drift[]> {
  const { scores, outcomes } = await recomputeUser(userId, opts);
  const drift: Drift[] = [];
  if (scores.length === 0 && outcomes.length === 0) return drift;

  const periods = scores.map((s) => s.periodStart).sort();
  const lo = periods[0];
  const hi = periods[periods.length - 1];

  const storedScores = await db
    .select()
    .from(activityScores)
    .where(
      and(
        eq(activityScores.userId, userId),
        gte(activityScores.periodStart, lo),
        lte(activityScores.periodStart, hi),
      ),
    );
  const storedScoreByKey = new Map(
    storedScores.map((s) => [`${s.typeKey}|${s.periodStart}`, s]),
  );

  for (const c of scores) {
    const key = `${c.typeKey}|${c.periodStart}`;
    const s = storedScoreByKey.get(key);
    if (!s) {
      drift.push({ kind: "score", key, field: "*", stored: null, computed: c.passed });
      continue;
    }
    if (s.passed !== c.passed) {
      drift.push({ kind: "score", key, field: "passed", stored: s.passed, computed: c.passed });
    }
  }

  const storedOutcomes = await db
    .select()
    .from(activityOutcomes)
    .where(
      and(
        eq(activityOutcomes.userId, userId),
        gte(activityOutcomes.periodStart, lo),
        lte(activityOutcomes.periodStart, hi),
      ),
    );
  const storedOutcomeByKey = new Map(
    storedOutcomes.map((o) => [`${o.activityId}|${o.periodStart}`, o]),
  );

  for (const c of outcomes) {
    const key = `${c.activityId}|${c.periodStart}`;
    const o = storedOutcomeByKey.get(key);
    if (!o) {
      drift.push({ kind: "outcome", key, field: "*", stored: null, computed: c.streakAfter });
      continue;
    }
    if (o.streakAfter !== c.streakAfter)
      drift.push({ kind: "outcome", key, field: "streak_after", stored: o.streakAfter, computed: c.streakAfter });
    if (o.graceUsed !== c.graceUsed)
      drift.push({ kind: "outcome", key, field: "grace_used", stored: o.graceUsed, computed: c.graceUsed });
    if (o.fineAmount !== c.fineAmount)
      drift.push({ kind: "outcome", key, field: "fine_amount", stored: o.fineAmount, computed: c.fineAmount });
  }

  return drift;
}

export async function verifyAll(
  opts: { from?: string; to?: string } = {},
): Promise<Drift[]> {
  const users = await db
    .selectDistinct({ userId: groupMembers.userId })
    .from(groupMembers);
  const all: Drift[] = [];
  for (const u of users) {
    all.push(...(await verifyUser(u.userId, opts)));
  }
  return all;
}
