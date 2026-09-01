import { DateTime } from "luxon";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  activities,
  groupMembers,
  activityScores,
  activityOutcomes,
  userApprovals,
} from "@/db/schema";
import {
  periodStart,
  getActivityType,
  scoreChain,
  type Checkin,
  type ChainPeriod,
} from "@/domain";
import {
  resolveUserTimezone,
  resolveUserSleepConfigRow,
  resolveActivityRules,
} from "./config";
import { writeFines } from "./ledger";
import { now } from "@/lib/clock";

function nextDay(d: string): string {
  return DateTime.fromISO(d, { zone: "utc" }).plus({ days: 1 }).toFormat("yyyy-MM-dd");
}
function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  let d = DateTime.fromISO(from, { zone: "utc" });
  const end = DateTime.fromISO(to, { zone: "utc" });
  while (d <= end) {
    out.push(d.toFormat("yyyy-MM-dd"));
    d = d.plus({ days: 1 });
  }
  return out;
}

interface Membership {
  activityId: string;
  joinedAt: string;
  leftAt: string | null;
}

async function memberships(userId: string): Promise<Membership[]> {
  return db
    .select({
      activityId: activities.id,
      joinedAt: groupMembers.joinedAt,
      leftAt: groupMembers.leftAt,
    })
    .from(groupMembers)
    .innerJoin(
      activities,
      and(
        eq(activities.groupId, groupMembers.groupId),
        eq(activities.typeKey, "sleep"),
        isNull(activities.archivedAt),
      ),
    )
    .where(eq(groupMembers.userId, userId));
}

// The last period whose windows have all closed for this user; only closed
// periods are scorable. A skipped cron run must not lose a night, so callers
// score every unscored date up to here, not just yesterday.
export async function lastClosedPeriod(userId: string): Promise<string> {
  const nowDate = await now();
  const tz = await resolveUserTimezone(userId, nowDate.toISOString().slice(0, 10));
  const candidate = periodStart(nowDate, tz);
  const { config } = await resolveUserSleepConfigRow(userId, candidate);
  const wins = getActivityType("sleep").windows(config, candidate, tz);
  const maxClose = Math.max(...wins.map((w) => w.closesAt.getTime()));
  return maxClose < nowDate.getTime()
    ? candidate
    : DateTime.fromISO(candidate, { zone: "utc" }).minus({ days: 1 }).toFormat("yyyy-MM-dd");
}

export interface ScoreRow {
  userId: string;
  typeKey: string;
  periodStart: string;
  periodEnd: string;
  passed: boolean;
  detail: Record<string, unknown>;
  userConfigVersion: number;
}
export interface OutcomeRow {
  activityId: string;
  userId: string;
  typeKey: string;
  periodStart: string;
  graceUsed: boolean;
  streakAfter: number;
  fineAmount: number;
  currency: string;
  rulesVersion: number;
}

// Recompute scores and outcomes from events for [from..to], WITHOUT writing.
// Both the writing path (scoreUser) and the read-only diff (/verify) go through
// here, so verify uses the exact same effective-dated lookups and never flags
// history as drift after a config change (invariant 5).
export async function recomputeUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ scores: ScoreRow[]; outcomes: OutcomeRow[] }> {
  const mships = await memberships(userId);
  if (mships.length === 0) return { scores: [], outcomes: [] };

  const to = opts.to ?? (await lastClosedPeriod(userId));
  const earliest = mships
    .map((m) => m.joinedAt)
    .reduce((a, b) => (a < b ? a : b));
  const from = opts.from ?? earliest;
  if (from > to) return { scores: [], outcomes: [] };

  const periods = dayList(from, to);
  const sleep = getActivityType("sleep");

  // All of this user's sleep check-ins in range, grouped by period.
  const rows = await db
    .select({
      type: events.type,
      occurredAt: events.occurredAt,
      period: sql<string>`${events.payload}->>'period_start'`,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, "checkin.sleep.%"),
        sql`${events.payload}->>'period_start' between ${from} and ${to}`,
      ),
    );
  const byPeriod = new Map<string, Checkin<Record<string, never>>[]>();
  for (const r of rows) {
    const step = r.type.split(".").pop()!;
    const list = byPeriod.get(r.period) ?? [];
    list.push({ step, at: r.occurredAt });
    byPeriod.set(r.period, list);
  }

  const scores: ScoreRow[] = [];
  const passedByPeriod = new Map<string, boolean>();
  for (const p of periods) {
    const tz = await resolveUserTimezone(userId, p);
    const { config, version } = await resolveUserSleepConfigRow(userId, p);
    const { passed, detail } = sleep.evaluate({
      periodStart: p,
      timezone: tz,
      config,
      checkins: byPeriod.get(p) ?? [],
    });
    passedByPeriod.set(p, passed);
    scores.push({
      userId,
      typeKey: "sleep",
      periodStart: p,
      periodEnd: nextDay(p),
      passed,
      detail,
      userConfigVersion: version,
    });
  }

  const outcomes: OutcomeRow[] = [];
  for (const m of mships) {
    const memberPeriods = periods.filter(
      (p) => p >= m.joinedAt && (m.leftAt === null || p < m.leftAt),
    );
    const chainInput: ChainPeriod[] = [];
    const meta = new Map<string, { rulesVersion: number; currency: string }>();
    for (const p of memberPeriods) {
      const r = await resolveActivityRules(m.activityId, p);
      meta.set(p, { rulesVersion: r.version, currency: r.currency });
      chainInput.push({
        periodStart: p,
        passed: passedByPeriod.get(p)!,
        gracePerMonth: r.gracePerMonth,
        rules: {
          fineMode: r.fineMode,
          fineAmount: r.fineAmount,
          fineStep: r.fineStep,
          fineCap: r.fineCap,
        },
      });
    }
    for (const o of scoreChain(chainInput)) {
      const mm = meta.get(o.periodStart)!;
      outcomes.push({
        activityId: m.activityId,
        userId,
        typeKey: "sleep",
        periodStart: o.periodStart,
        graceUsed: o.graceUsed,
        streakAfter: o.streakAfter,
        fineAmount: o.fineAmount,
        currency: mm.currency,
        rulesVersion: mm.rulesVersion,
      });
    }
  }

  return { scores, outcomes };
}

// Idempotent write. Recompute then upsert; safe to run twice.
export async function scoreUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ scores: number; outcomes: number; fines: number }> {
  const { scores, outcomes } = await recomputeUser(userId, opts);

  if (scores.length > 0) {
    await db
      .insert(activityScores)
      .values(scores)
      .onConflictDoUpdate({
        target: [activityScores.userId, activityScores.typeKey, activityScores.periodStart],
        set: {
          periodEnd: sql`excluded.period_end`,
          passed: sql`excluded.passed`,
          detail: sql`excluded.detail`,
          userConfigVersion: sql`excluded.user_config_version`,
          computedAt: sql`now()`,
        },
      });
  }

  if (outcomes.length > 0) {
    await db
      .insert(activityOutcomes)
      .values(outcomes)
      .onConflictDoUpdate({
        target: [
          activityOutcomes.activityId,
          activityOutcomes.userId,
          activityOutcomes.periodStart,
        ],
        set: {
          typeKey: sql`excluded.type_key`,
          graceUsed: sql`excluded.grace_used`,
          streakAfter: sql`excluded.streak_after`,
          fineAmount: sql`excluded.fine_amount`,
          currency: sql`excluded.currency`,
          rulesVersion: sql`excluded.rules_version`,
          computedAt: sql`now()`,
        },
      });
  }

  // Fines are written from the outcomes in the same idempotent pass, so the
  // daily cron does everything. The ledger unique index prevents duplicates.
  const fines = await writeFines(outcomes);

  return { scores: scores.length, outcomes: outcomes.length, fines };
}

// Score every user who belongs to a group. Used by the cron and the CLI.
export async function scoreAll(
  opts: { from?: string } = {},
): Promise<{ users: number }> {
  // Skip disabled users: their memberships are already marked left, and they
  // cannot check in, so there is nothing to score.
  const users = await db
    .selectDistinct({ userId: groupMembers.userId })
    .from(groupMembers)
    .leftJoin(userApprovals, eq(userApprovals.userId, groupMembers.userId))
    .where(isNull(userApprovals.disabledAt));
  for (const u of users) {
    await scoreUser(u.userId, { from: opts.from });
  }
  return { users: users.length };
}
