import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  activityScores,
  activityOutcomes,
  reputationDaily,
  userActivities,
  ledgerEntries,
  finePostings,
} from "@/db/schema";
import { recomputeUser, type OutcomeWrite } from "./scoring";

export interface Drift {
  kind: "score" | "reputation" | "outcome" | "ledger";
  userId: string;
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
 *
 * Four kinds, and the last two are why this exists at all. Scores and
 * reputation are a diff: recompute the number, compare it. Outcomes are the
 * same. The ledger is not diffable, because money is append-only and a
 * correction is another row rather than an edit, so it is checked as
 * PROPERTIES instead: does the fine that was charged match the fine that is
 * owed, do its shares sum to it, did everyone paid actually pass.
 *
 * Money was the one part with legal weight and no verification at all, which
 * is how a fine could be charged at 750 for a 500 miss without anything
 * noticing.
 */
export async function verifyUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<Drift[]> {
  const { scores, reputation, outcomes } = await recomputeUser(userId, opts);
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
        drift.push({ kind: "score", userId, key, field: "*", stored: null, computed: c.passed });
        continue;
      }
      if (s.passed !== c.passed) {
        drift.push({
          kind: "score",
          userId,
          key,
          field: "passed",
          stored: s.passed,
          computed: c.passed,
        });
      }
      if (s.settling !== c.settling) {
        drift.push({
          kind: "score",
          userId,
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
          gte(reputationDaily.day, days[0]),
          lte(reputationDaily.day, days[days.length - 1]),
        ),
      );
    // A user has one global score and one per group, so the day alone is not a
    // key. Comparing without the scope diffs a group's row against the global.
    const scope = (groupId: string | null, day: string) => `${groupId ?? "global"}|${day}`;
    const byScope = new Map(stored.map((r) => [scope(r.groupId, r.day), r]));

    for (const c of reputation) {
      const key = scope(c.groupId, c.day);
      const s = byScope.get(key);
      if (!s) {
        drift.push({
          kind: "reputation",
          userId,
          key,
          field: "*",
          stored: null,
          computed: c.score,
        });
        continue;
      }
      // Stored as numeric, so compare the numbers rather than their spelling.
      if (Math.abs(Number(s.score) - Number(c.score)) > 0.001) {
        drift.push({
          kind: "reputation",
          userId,
          key,
          field: "score",
          stored: s.score,
          computed: c.score,
        });
      }
      if (s.reason !== c.reason) {
        drift.push({
          kind: "reputation",
          userId,
          key,
          field: "reason",
          stored: s.reason,
          computed: c.reason,
        });
      }
    }
  }

  drift.push(...(await verifyOutcomes(userId, outcomes)));
  drift.push(...(await verifyLedger(userId, outcomes)));

  return drift;
}

/** The per-group consequence of a period: did it count, and what did it cost. */
async function verifyOutcomes(
  userId: string,
  computed: OutcomeWrite[],
): Promise<Drift[]> {
  if (computed.length === 0) return [];
  const drift: Drift[] = [];

  const periods = computed.map((o) => o.periodStart).sort();
  const stored = await db
    .select()
    .from(activityOutcomes)
    .where(
      and(
        eq(activityOutcomes.userId, userId),
        gte(activityOutcomes.periodStart, periods[0]),
        lte(activityOutcomes.periodStart, periods[periods.length - 1]),
      ),
    );
  const key = (o: { groupId: string; typeKey: string; periodStart: string }) =>
    `${o.groupId}|${o.typeKey}|${o.periodStart}`;
  const byKey = new Map(stored.map((s) => [key(s), s]));

  for (const c of computed) {
    const s = byKey.get(key(c));
    if (!s) {
      drift.push({
        kind: "outcome",
        userId,
        key: key(c),
        field: "*",
        stored: null,
        computed: c.passed,
      });
      continue;
    }
    const fields: [string, unknown, unknown][] = [
      ["passed", s.passed, c.passed],
      ["fineAmount", s.fineAmount, c.fineAmount],
      ["currency", s.currency, c.currency],
      ["rulesVersion", s.rulesVersion, c.rulesVersion],
    ];
    for (const [field, was, now] of fields) {
      if (was !== now) {
        drift.push({ kind: "outcome", userId, key: key(c), field, stored: was, computed: now });
      }
    }
  }

  return drift;
}

/**
 * Money, checked as properties rather than diffed.
 *
 * `ledger_entries` is append-only (invariant 3), so a wrong row is never
 * rewritten and "recompute and compare" is the wrong question to ask of it.
 * What can be asked is whether what was charged still makes sense:
 *
 *   - the posting charges what the period actually owes (this catches a fine
 *     in a group whose money was off, and a fine written under rules that have
 *     since been resolved differently),
 *   - its shares sum EXACTLY to it (invariant 7),
 *   - everyone paid actually passed that period,
 *   - and neither half exists without the other.
 *
 * A posting with no shares is the one failure the write path can produce, since
 * it claims the posting before writing them and has no transaction to make the
 * two one. It reports here, and the posting keeps the amount so a person can
 * repair it.
 */
async function verifyLedger(
  userId: string,
  computed: OutcomeWrite[],
): Promise<Drift[]> {
  if (computed.length === 0) return [];
  const drift: Drift[] = [];

  const periods = computed.map((o) => o.periodStart).sort();
  const lo = periods[0];
  const hi = periods[periods.length - 1];
  const inRange = (t: typeof finePostings.periodStart | typeof ledgerEntries.periodStart) =>
    and(gte(t, lo), lte(t, hi));

  const [postings, fines] = await Promise.all([
    db
      .select()
      .from(finePostings)
      .where(and(eq(finePostings.fromUserId, userId), inRange(finePostings.periodStart))),
    db
      .select()
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.fromUserId, userId),
          eq(ledgerEntries.kind, "fine"),
          inRange(ledgerEntries.periodStart),
        ),
      ),
  ]);
  if (postings.length === 0 && fines.length === 0) return drift;

  const key = (o: { groupId: string; typeKey: string | null; periodStart: string | null }) =>
    `${o.groupId}|${o.typeKey}|${o.periodStart}`;
  const owed = new Map(computed.map((o) => [key(o), o]));

  // The shares, gathered under the posting they belong to.
  const shares = new Map<string, typeof fines>();
  for (const f of fines) {
    const list = shares.get(key(f)) ?? [];
    list.push(f);
    shares.set(key(f), list);
  }

  // Who else passed, so a payee can be checked against a real result. One read
  // over the whole range rather than one per posting.
  const groupIds = [...new Set(postings.map((p) => p.groupId))];
  const peers = new Map<string, boolean>();
  if (groupIds.length > 0) {
    const rows = await db
      .select({
        groupId: activityOutcomes.groupId,
        userId: activityOutcomes.userId,
        typeKey: activityOutcomes.typeKey,
        periodStart: activityOutcomes.periodStart,
        passed: activityOutcomes.passed,
      })
      .from(activityOutcomes)
      .where(
        and(
          inArray(activityOutcomes.groupId, groupIds),
          gte(activityOutcomes.periodStart, lo),
          lte(activityOutcomes.periodStart, hi),
        ),
      );
    for (const r of rows) peers.set(`${key(r)}|${r.userId}`, r.passed);
  }

  for (const p of postings) {
    const k = key(p);
    const should = owed.get(k);

    // Charged for a period that owes nothing, or a different amount than it
    // owes. Money switched off for the group lands here as a fine that should
    // be zero.
    if (!should || should.passed || should.fineAmount !== p.amount) {
      drift.push({
        kind: "ledger",
        userId,
        key: k,
        field: "fineAmount",
        stored: p.amount,
        computed: should && !should.passed ? should.fineAmount : 0,
      });
    }

    const mine = shares.get(k) ?? [];
    if (mine.length === 0) {
      // The write path claims a posting before writing its shares and has no
      // transaction to make that one step, so this is what a crash between
      // them looks like. An under-charge, and repairable.
      drift.push({
        kind: "ledger",
        userId,
        key: k,
        field: "shares",
        stored: 0,
        computed: p.amount,
      });
      continue;
    }

    const total = mine.reduce((sum, r) => sum + r.amount, 0);
    if (total !== p.amount) {
      drift.push({
        kind: "ledger",
        userId,
        key: k,
        field: "sharesSum",
        stored: total,
        computed: p.amount,
      });
    }

    for (const share of mine) {
      if (peers.get(`${k}|${share.toUserId}`) !== true) {
        drift.push({
          kind: "ledger",
          userId,
          key: `${k}|${share.toUserId}`,
          field: "payeePassed",
          stored: false,
          computed: true,
        });
      }
    }
  }

  // A share with nothing claiming it. Nothing writes this today; it would mean
  // a posting was deleted out from under the money.
  const posted = new Set(postings.map(key));
  for (const k of shares.keys()) {
    if (!posted.has(k)) {
      drift.push({
        kind: "ledger",
        userId,
        key: k,
        field: "posting",
        stored: null,
        computed: "a fine with no posting",
      });
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
