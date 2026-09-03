import { DateTime } from "luxon";
import { and, eq, isNull, like, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  userActivities,
  userActivityConfig,
  activityScores,
  reputationDaily,
  userApprovals,
} from "@/db/schema";
import {
  periodStart,
  periodUnit,
  isScheduledDay,
  weekdayOf,
  daysInPeriod,
  getActivityType,
  resolveAt,
  resolveConfig,
  scheduleConfigSchema,
  applyDay,
  ceilingFor,
  CONSTANTS,
  START_SCORE,
  type Checkin,
  type ScheduleConfig,
  type DayReason,
} from "@/domain";
import { resolveUserTimezone } from "./config";
import { now } from "@/lib/clock";

// Closing and scoring periods, then moving reputation. One pass, per user, for
// every type they track.
//
// Nothing here knows what a type means (invariant 6): the module says when its
// periods start, when its windows close, and whether one passed.
//
// Both the nightly job and the lazy close on read call `scoreUser`, so a late
// or missed run loses nothing and a read never sees a stale period.

const iso = (d: DateTime) => d.toFormat("yyyy-MM-dd");
const addDays = (date: string, n: number) =>
  iso(DateTime.fromISO(date, { zone: "utc" }).plus({ days: n }));

function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  let d = DateTime.fromISO(from, { zone: "utc" });
  const end = DateTime.fromISO(to, { zone: "utc" });
  while (d <= end) {
    out.push(iso(d));
    d = d.plus({ days: 1 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// What a user tracks, as it stood on each day
// ---------------------------------------------------------------------------

interface TrackedType {
  typeKey: string;
  /** The first day this type was ever switched on: the settling window's start. */
  startedOn: string;
  switches: { id: number; enabled: boolean; effectiveAt: Date }[];
  configs: {
    version: number;
    typeKey: string;
    effectiveFrom: string;
    config: unknown;
    scopeId: string | null;
  }[];
}

/** Everything needed to replay a user's activities over any range. */
async function trackedTypes(userId: string): Promise<TrackedType[]> {
  const [switches, configs] = await Promise.all([
    db
      .select({
        id: userActivities.id,
        typeKey: userActivities.typeKey,
        enabled: userActivities.enabled,
        effectiveAt: userActivities.effectiveAt,
      })
      .from(userActivities)
      .where(eq(userActivities.userId, userId)),
    db
      .select({
        version: userActivityConfig.version,
        typeKey: userActivityConfig.typeKey,
        effectiveFrom: userActivityConfig.effectiveFrom,
        config: userActivityConfig.config,
      })
      .from(userActivityConfig)
      .where(eq(userActivityConfig.userId, userId)),
  ]);

  const keys = [...new Set(switches.map((s) => s.typeKey))];
  return keys.map((typeKey) => {
    const mine = switches.filter((s) => s.typeKey === typeKey);
    const first = mine.reduce((a, b) => (a.effectiveAt < b.effectiveAt ? a : b));
    return {
      typeKey,
      startedOn: iso(DateTime.fromJSDate(first.effectiveAt, { zone: "utc" })),
      switches: mine,
      configs: configs
        .filter((c) => c.typeKey === typeKey)
        .map((c) => ({ ...c, scopeId: userId })),
    };
  });
}

/** Split a stored config blob into the engine's half and the module's. */
function split(raw: unknown): { schedule: ScheduleConfig; config: unknown } {
  const blob = (raw ?? {}) as Record<string, unknown>;
  return {
    schedule: scheduleConfigSchema.parse(blob.schedule),
    config: blob.config,
  };
}

/**
 * The last period of this type that has fully closed.
 *
 * A period is scorable only once every one of its windows has shut. Scoring a
 * night at 3 AM would fail a wake window nobody has reached yet.
 */
function lastClosedPeriodFor(
  typeKey: string,
  schedule: ScheduleConfig,
  config: unknown,
  timezone: string,
  instant: Date,
): string | null {
  const type = getActivityType(typeKey);
  const spec = {
    unit: periodUnit(schedule.schedule),
    boundary: schedule.dayBoundary,
  };
  let candidate = periodStart(instant, timezone, spec);

  // Walk back until one is closed. Two steps is always enough, but the loop
  // says so rather than assuming it.
  for (let i = 0; i < 3; i += 1) {
    const windows = type.windows(config, candidate, timezone);
    const shut = Math.max(...windows.map((w) => w.closesAt.getTime()));
    if (shut < instant.getTime()) return candidate;
    candidate = addDays(candidate, spec.unit === "week" ? -7 : -1);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export interface ScoreRow {
  userId: string;
  typeKey: string;
  periodStart: string;
  periodEnd: string;
  passed: boolean;
  detail: Record<string, unknown>;
  userConfigVersion: number;
  settling: boolean;
}

export interface ReputationRow {
  userId: string;
  groupId: string | null;
  day: string;
  score: string;
  delta: string;
  reason: DayReason;
  ceiling: string;
  completion: string | null;
}

/**
 * Recompute every closed period for a user, without writing.
 *
 * The write path and `bun run verify` both come through here, so verify uses
 * the same effective-dated lookups and never reports history as drift after a
 * config change (invariant 5).
 */
export async function recomputeUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ scores: ScoreRow[]; reputation: ReputationRow[] }> {
  const tracked = await trackedTypes(userId);
  if (tracked.length === 0) return { scores: [], reputation: [] };

  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );

  // ALWAYS compute from the beginning, whatever range was asked for.
  //
  // Reputation is a running score: day D depends on D-1, so a replay that
  // starts halfway would start from the wrong number and every day after it
  // would be wrong. `from` and `to` narrow what is RETURNED, never what is
  // computed. That is what "rebuildable by replaying daily deltas from the
  // join date" means, and it is why verify can be trusted.
  const from = tracked.map((t) => t.startedOn).sort()[0];

  // Every check-in in range, once, rather than a query per type per period.
  const checkins = await db
    .select({
      type: events.type,
      occurredAt: events.occurredAt,
      payload: events.payload,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, "checkin.%"),
        sql`${events.payload}->>'period_start' >= ${from}`,
      ),
    );

  const byTypePeriod = new Map<string, Checkin<unknown>[]>();
  for (const row of checkins) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const key = `${payload.type_key}|${payload.period_start}`;
    const list = byTypePeriod.get(key) ?? [];
    list.push({
      step: String(payload.step),
      at: row.occurredAt,
      evidence: payload.evidence,
    });
    byTypePeriod.set(key, list);
  }

  const scores: ScoreRow[] = [];
  // day -> the periods that concluded on it, for the reputation pass.
  const concluded = new Map<string, { passed: boolean; settling: boolean }[]>();

  for (const t of tracked) {
    const type = getActivityType(t.typeKey);
    const settlingEnds = addDays(t.startedOn, CONSTANTS.settlingDays);

    // Resolve today's config to learn the period shape, then walk back.
    const latest = resolveConfig(t.configs, iso(DateTime.fromJSDate(instant, { zone: timezone })));
    if (!latest) continue;
    const shape = split(latest.config);

    const to = lastClosedPeriodFor(
      t.typeKey,
      shape.schedule,
      shape.config,
      timezone,
      instant,
    );
    if (!to || from > to) continue;

    const unit = periodUnit(shape.schedule.schedule);
    // Weekly periods start on Mondays; daily ones on every day in range.
    const candidates = dayList(from, to).filter((d) =>
      unit === "week" ? weekdayOf(d) === 1 : true,
    );

    for (const period of candidates) {
      // The switch and the settings as they stood on that period.
      const enabled = resolveAt(
        t.switches,
        DateTime.fromISO(period, { zone: timezone }).endOf("day").toJSDate(),
      );
      if (!enabled?.enabled) continue;

      const row = resolveConfig(t.configs, period);
      if (!row) continue;
      const { schedule, config } = split(row.config);

      // A named-day schedule skips its unscheduled days entirely: they are not
      // a miss, they are not a period.
      if (unit === "day" && !isScheduledDay(schedule.schedule, weekdayOf(period))) {
        continue;
      }

      const { passed, detail } = type.evaluate({
        periodStart: period,
        timezone,
        config,
        checkins: byTypePeriod.get(`${t.typeKey}|${period}`) ?? [],
      });

      const settling = period < settlingEnds;
      const periodEnd = addDays(period, unit === "week" ? 7 : 1);
      scores.push({
        userId,
        typeKey: t.typeKey,
        periodStart: period,
        periodEnd,
        passed,
        detail,
        userConfigVersion: row.version,
        settling,
      });

      // A period lands on reputation the day it CONCLUDES, so a week counts
      // once, on its Sunday, rather than seven times.
      const concludesOn = unit === "week" ? daysInPeriod(period, "week").at(-1)! : period;
      const list = concluded.get(concludesOn) ?? [];
      list.push({ passed, settling });
      concluded.set(concludesOn, list);
    }
  }

  const reputation = replayGlobal(userId, from, concluded, instant, timezone);

  // Now narrow to what was asked for.
  const lo = opts.from;
  const hi = opts.to;
  return {
    scores: scores.filter(
      (s) => (!lo || s.periodStart >= lo) && (!hi || s.periodStart <= hi),
    ),
    reputation: reputation.filter(
      (r) => (!lo || r.day >= lo) && (!hi || r.day <= hi),
    ),
  };
}

/**
 * The global score: the same curve at full breadth (decision 53).
 *
 * It is per user and not per group, so it has no sharing to read and can be
 * computed now. Its only effect is to set the score someone starts a group on.
 */
function replayGlobal(
  userId: string,
  from: string,
  concluded: Map<string, { passed: boolean; settling: boolean }[]>,
  instant: Date,
  timezone: string,
): ReputationRow[] {
  const today = iso(DateTime.fromJSDate(instant, { zone: timezone }));
  const ceiling = ceilingFor(1);
  const rows: ReputationRow[] = [];

  let score = START_SCORE;
  let idleDays = 0;

  for (const day of dayList(from, today)) {
    const periods = concluded.get(day) ?? [];
    // A settling period is scored but does not move reputation (decision 54).
    const counting = periods.filter((p) => !p.settling);

    let completion: number | null = null;
    if (counting.length > 0) {
      completion = counting.filter((p) => p.passed).length / counting.length;
      idleDays = 0;
    } else {
      idleDays += 1;
    }

    const result = applyDay({ score, ceiling, completion, idleDays });
    score = result.score;
    rows.push({
      userId,
      groupId: null,
      day,
      score: result.score.toFixed(3),
      delta: result.delta.toFixed(3),
      reason: result.reason,
      ceiling: ceiling.toFixed(3),
      completion: completion === null ? null : completion.toFixed(3),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Idempotent: recompute, then upsert. Safe to run twice, or half. */
export async function scoreUser(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ scores: number; reputation: number }> {
  const { scores, reputation } = await recomputeUser(userId, opts);

  for (let i = 0; i < scores.length; i += 200) {
    await db
      .insert(activityScores)
      .values(scores.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [activityScores.userId, activityScores.typeKey, activityScores.periodStart],
        set: {
          periodEnd: sql`excluded.period_end`,
          passed: sql`excluded.passed`,
          detail: sql`excluded.detail`,
          userConfigVersion: sql`excluded.user_config_version`,
          settling: sql`excluded.settling`,
          computedAt: sql`now()`,
        },
      });
  }

  // Raw, because the unique index is on an expression (COALESCE over the
  // nullable group) and a conflict target has to name the same expression.
  for (let i = 0; i < reputation.length; i += 200) {
    const rows = reputation.slice(i, i + 200);
    const values = sql.join(
      rows.map(
        (r) =>
          sql`(${r.userId}, ${r.groupId}, ${r.day}::date, ${r.score}::numeric, ${r.delta}::numeric, ${r.reason}, ${r.ceiling}::numeric, ${r.completion}::numeric)`,
      ),
      sql`, `,
    );
    await db.execute(sql`
      INSERT INTO reputation_daily
        (user_id, group_id, day, score, delta, reason, ceiling, completion)
      VALUES ${values}
      ON CONFLICT (user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), day)
      DO UPDATE SET
        score = excluded.score,
        delta = excluded.delta,
        reason = excluded.reason,
        ceiling = excluded.ceiling,
        completion = excluded.completion,
        computed_at = now()
    `);
  }

  return { scores: scores.length, reputation: reputation.length };
}

/** Score every approved user who tracks anything. Used by the cron and the CLI. */
export async function scoreAll(
  opts: { from?: string } = {},
): Promise<{ users: number }> {
  const users = await db
    .selectDistinct({ userId: userActivities.userId })
    .from(userActivities)
    .leftJoin(userApprovals, eq(userApprovals.userId, userActivities.userId))
    .where(isNull(userApprovals.disabledAt));

  for (const u of users) {
    await scoreUser(u.userId, { from: opts.from });
  }
  return { users: users.length };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface TypeStanding {
  typeKey: string;
  streak: number;
  best: number;
  graceLeft: number;
}

/**
 * A user's global score, as last computed. Visible only to its owner
 * (decision 10), and never shown to anyone else.
 */
export async function globalScore(userId: string): Promise<number> {
  const [row] = await db
    .select({ score: reputationDaily.score })
    .from(reputationDaily)
    .where(and(eq(reputationDaily.userId, userId), isNull(reputationDaily.groupId)))
    .orderBy(sql`day desc`)
    .limit(1);
  return row ? Number(row.score) : START_SCORE;
}

/** Every scored period for one type, oldest first. */
export async function scoredDays(
  userId: string,
  typeKeys: string[],
): Promise<{ typeKey: string; periodStart: string; passed: boolean }[]> {
  if (typeKeys.length === 0) return [];
  return db
    .select({
      typeKey: activityScores.typeKey,
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
    })
    .from(activityScores)
    .where(
      and(eq(activityScores.userId, userId), inArray(activityScores.typeKey, typeKeys)),
    )
    .orderBy(activityScores.periodStart);
}
