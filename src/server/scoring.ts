import { cache } from "react";
import { DateTime } from "luxon";
import { and, eq, isNull, like, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  userActivities,
  userActivityConfig,
  activityScores,
  activityOutcomes,
  reputationDaily,
  groupMembers,
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
  joiningScore,
  fineFor,
  CONSTANTS,
  START_SCORE,
  LOGIC_VERSION,
  type Checkin,
  type ScheduleConfig,
  type DayReason,
} from "@/domain";
import { resolveUserTimezone } from "./config";
import { acceptedTypes, sharesFor, fineRuleFor, ownerMoneyToggleAsOf } from "./sharing";
import { moneyOnFor } from "./app-config";
import { writeFines, type OutcomeRow } from "./ledger";
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

export interface OutcomeWrite extends OutcomeRow {
  graceUsed: boolean;
  rulesVersion: number | null;
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
 * Where a scope's running score stood when it was last closed, so the next day
 * can be built on it instead of on a replay of everything before it.
 *
 * `idleDays` is not stored, because it is derivable: it is the run of days
 * ending at `day` on which nothing was scheduled. `resumePointFor` counts it
 * back off the stored rows.
 */
export interface ResumePoint {
  /** The first day to compute. Everything before it is taken as already stored. */
  day: string;
  /** "global" or a groupId, to where that scope's score stood the day before. */
  scores: Map<string, { score: number; idleDays: number }>;
}

const scopeKey = (groupId: string | null) => groupId ?? "global";

/**
 * Recompute closed periods for a user, without writing.
 *
 * The write path and `bun run verify` both come through here, so verify uses
 * the same effective-dated lookups and never reports history as drift after a
 * config change (invariant 5).
 *
 * WITHOUT `resume` it computes from the beginning, whatever range was asked
 * for, because reputation is a running score: day D depends on D-1, so a replay
 * that starts halfway would start from the wrong number and every day after it
 * would be wrong. `from` and `to` narrow what is RETURNED, never what is
 * computed. That is what "rebuildable by replaying daily deltas from the join
 * date" means, and it is what `verify` relies on.
 *
 * WITH `resume` it starts from a day whose score is already stored, which is
 * the accounting move of carrying an opening balance rather than re-reading the
 * whole book. `closeOutstanding` passes one; verify never does, and that
 * asymmetry is the point: the cheap path is checked nightly against the
 * expensive one.
 */
export async function recomputeUser(
  userId: string,
  opts: { from?: string; to?: string; resume?: ResumePoint } = {},
): Promise<{
  scores: ScoreRow[];
  outcomes: OutcomeWrite[];
  reputation: ReputationRow[];
}> {
  const tracked = await trackedTypes(userId);
  if (tracked.length === 0) return { scores: [], outcomes: [], reputation: [] };

  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );

  const startedOn = tracked.map((t) => t.startedOn).sort()[0];

  // The first day the running score is computed for.
  const dayFrom = opts.resume && opts.resume.day > startedOn ? opts.resume.day : startedOn;

  // Periods are scanned from a week earlier than that, because a WEEK that
  // concludes on the first computed day began six days before it. Scanning from
  // `dayFrom` would miss that week entirely and the day would look empty.
  // Rescoring a few settled periods is idempotent and costs one module call
  // each.
  const from = dayFrom === startedOn ? startedOn : addDays(dayFrom, -7);

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
  // typeKey|period -> did it pass, for the per-group pass below.
  const byPeriod = new Map<string, { passed: boolean; concludesOn: string }>();

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
      byPeriod.set(`${t.typeKey}|${period}`, { passed, concludesOn });
    }
  }

  const reputation = replayGlobal(
    userId,
    dayFrom,
    concluded,
    instant,
    timezone,
    opts.resume,
  );
  const { outcomes, groupReputation } = await recomputeGroups(
    userId,
    dayFrom,
    scores,
    instant,
    timezone,
    reputation,
    opts.resume,
  );
  reputation.push(...groupReputation);

  // Now narrow to what was asked for.
  const lo = opts.from;
  const hi = opts.to;
  return {
    scores: scores.filter(
      (s) => (!lo || s.periodStart >= lo) && (!hi || s.periodStart <= hi),
    ),
    outcomes: outcomes.filter(
      (o) => (!lo || o.periodStart >= lo) && (!hi || o.periodStart <= hi),
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
  resume?: ResumePoint,
): ReputationRow[] {
  const today = iso(DateTime.fromJSDate(instant, { zone: timezone }));
  const ceiling = ceilingFor(1);
  const rows: ReputationRow[] = [];

  // The opening balance, or where everyone starts when there is not one.
  const opening = resume?.scores.get("global");
  let score = opening?.score ?? START_SCORE;
  let idleDays = opening?.idleDays ?? 0;

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

/**
 * The same periods, judged again in each group the user belongs to.
 *
 * A group only ever sees a type its member shares with it, so a private
 * activity produces no outcome, no fine and no movement anywhere. The
 * ceiling comes from breadth on the day, so un-sharing lowers what can be
 * climbed back to without touching what was already earned.
 */
async function recomputeGroups(
  userId: string,
  from: string,
  scores: ScoreRow[],
  instant: Date,
  timezone: string,
  globalSeries: ReputationRow[],
  resume?: ResumePoint,
): Promise<{ outcomes: OutcomeWrite[]; groupReputation: ReputationRow[] }> {
  // The global score on each day of this same replay. Read from here rather
  // than from `reputation_daily`, so a recompute is a pure function of events
  // and verify converges: reading the stored table would seed each run with
  // the previous run's output and the two could never agree.
  const globalOn = new Map(globalSeries.map((r) => [r.day, Number(r.score)]));
  const globalDays = globalSeries.map((r) => r.day);
  const memberships = await db
    .select({
      groupId: groupMembers.groupId,
      joinedAt: groupMembers.joinedAt,
      leftAt: groupMembers.leftAt,
    })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  // The global score on the day before `day`. Before the series begins, the
  // user had no history at all, so they start where everyone starts.
  const globalBefore = (day: string): number => {
    const wanted = addDays(day, -1);
    const exact = globalOn.get(wanted);
    if (exact !== undefined) return exact;
    let best: number | null = null;
    for (let i = 0; i < globalDays.length; i += 1) {
      if (globalDays[i] > wanted) break;
      best = globalOn.get(globalDays[i]) ?? best;
    }
    return best ?? START_SCORE;
  };

  const outcomes: OutcomeWrite[] = [];
  const groupReputation: ReputationRow[] = [];
  const today = iso(DateTime.fromJSDate(instant, { zone: timezone }));

  for (const m of memberships) {
    // A rejoin starts fresh (decision 17): the replay begins at the current
    // join date, never at an old number.
    const start = m.joinedAt > from ? m.joinedAt : from;
    const end = m.leftAt && m.leftAt < today ? m.leftAt : today;
    if (start > end) continue;

    // Whether this group even tracks money at all (decision 66's three-way
    // resolution: app-wide, admin override, owner toggle). A group with money
    // off must never accrue a fine for it, or ledger_entries carries debts a
    // switched-off group never agreed to.
    // Read once, resolved per day below: an owner turning money on today must
    // not make a period that closed last week read as though it had been on
    // (invariant 5).
    const ownerToggleAt = await ownerMoneyToggleAsOf(m.groupId);

    // Sharing and acceptance are resolved as they stood on each day, so a
    // change today never rewrites what a past period was judged against.
    const shareOn = async (day: string) => {
      const at = DateTime.fromISO(day, { zone: timezone }).endOf("day").toJSDate();
      const [accepted, shares] = await Promise.all([
        acceptedTypes(m.groupId, at),
        sharesFor(m.groupId, userId, at),
      ]);
      const sharedKeys = new Set(
        shares.filter((sh) => sh.shared).map((sh) => sh.typeKey),
      );
      const counted = accepted.filter((a) => sharedKeys.has(a.typeKey));
      return {
        shared: sharedKeys,
        breadth: accepted.length === 0 ? 1 : counted.length / accepted.length,
      };
    };

    // The score someone starts on, from their hidden global score AS IT STOOD
    // THE DAY THEY JOINED (invariant 5), not as it stands now. Reading the
    // latest value instead moves a group's starting point every time the
    // global score moves, which rewrites every day of that group's history
    // after the fact.
    //
    // A resumed replay opens on the balance this group's score already carried,
    // which has that joining score inside it already. Recomputing the joining
    // score here would throw away everything earned since.
    const opening = resume?.scores.get(scopeKey(m.groupId));
    let score = opening?.score ?? joiningScore(globalBefore(m.joinedAt));
    let idleDays = opening?.idleDays ?? 0;

    for (const day of dayList(start, end)) {
      const { shared, breadth } = await shareOn(day);
      const ceiling = ceilingFor(breadth);

      // Every period of a shared type that concluded today.
      const todays = scores.filter(
        (sc) =>
          shared.has(sc.typeKey) &&
          sc.periodStart >= m.joinedAt &&
          concludesOn(sc) === day,
      );

      const at = DateTime.fromISO(day, { zone: timezone }).endOf("day").toJSDate();
      const moneyOn = await moneyOnFor(m.groupId, ownerToggleAt(at), at);

      for (const sc of todays) {
        const rule = await fineRuleFor(m.groupId, sc.typeKey, sc.periodStart);
        // Grace protects the streak, never the fine (decision 5). A group
        // with money off never accrues one either, whatever the rule says.
        const fine = sc.passed || !moneyOn
          ? 0
          : fineFor({
              fineMode: rule.fineMode,
              fineAmount: rule.fineAmount,
              fineStep: rule.fineStep,
              fineCap: rule.fineCap,
            }, 0);
        outcomes.push({
          groupId: m.groupId,
          userId,
          typeKey: sc.typeKey,
          periodStart: sc.periodStart,
          passed: sc.passed,
          graceUsed: false,
          fineAmount: fine,
          currency: rule.currency,
          rulesVersion: rule.version,
        });
      }

      const counting = todays.filter((sc) => !sc.settling);
      let completion: number | null = null;
      if (counting.length > 0) {
        completion = counting.filter((sc) => sc.passed).length / counting.length;
        idleDays = 0;
      } else {
        idleDays += 1;
      }

      const result = applyDay({ score, ceiling, completion, idleDays });
      score = result.score;
      groupReputation.push({
        userId,
        groupId: m.groupId,
        day,
        score: result.score.toFixed(3),
        delta: result.delta.toFixed(3),
        reason: result.reason,
        ceiling: ceiling.toFixed(3),
        completion: completion === null ? null : completion.toFixed(3),
      });
    }
  }

  return { outcomes, groupReputation };
}

/** The day a period lands on: a week counts once, on its Sunday. */
function concludesOn(score: ScoreRow): string {
  return addDays(score.periodEnd, -1);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * The lazy close, at most once a request.
 *
 * Every screen that reads a streak or a pass rate has to close whatever periods
 * have ended since the last read, and `scoreUser` does that for the WHOLE user,
 * not for one type. Six screens ask for it once per tracked activity, so a
 * person with six activities paid for six full recomputes to draw one list.
 * Home took six seconds of which about five were the same work five more times.
 *
 * React's `cache` gives one result per request, which is exactly the shape of
 * the thing: closing is idempotent, so doing it once is doing it enough. Outside
 * a request (the nightly job, `bun run verify`, the scripts) there is nothing to
 * dedupe against and every call runs, which is what those want anyway.
 *
 * IT NEVER WRITES MONEY, and that is not an optimisation.
 *
 * A fine is split among the members who passed the same period, so it can only
 * be settled once every one of them has been scored. `scoreAll` does that in two
 * passes for exactly this reason. A read closes ONE user, so settling from here
 * splits among whoever happened to be scored already: the first reader's fine
 * went to one peer in full, and a later pass split the same fine among two and
 * inserted the second share beside the first, because the unique index is per
 * payer-payee pair rather than per fine. 500 charged as 750, which is invariant
 * 7 broken by a page load.
 *
 * It also resumes rather than replays. Reputation is a running score and the
 * running score is stored, one row a day, so the days already closed do not
 * need computing again to reach today. Where that is not safe, `resumePointFor`
 * declines to offer a resume point and this falls back to the full replay.
 */
export const closeOutstanding = cache(async (userId: string): Promise<void> => {
  await scoreUser(userId, { fines: false, resume: await resumePointFor(userId) });
});

/**
 * The opening balance to carry forward, or nothing when it cannot be trusted.
 *
 * Reads the last stored day for every scope the user has, and the run of idle
 * days behind it. Returns undefined, meaning "replay everything", in three
 * cases:
 *
 *   - **Nothing stored.** A new user, or a restored backup. There is no balance
 *     to open on.
 *   - **The maths has moved on.** A row written by an older `applyDay` is an
 *     input from rules that no longer apply, and every day built on it would
 *     inherit that. See LOGIC_VERSION.
 *   - **The scopes disagree on how far they got.** A group closed to Tuesday
 *     and the global score closed to Friday cannot share one resume day, and
 *     resuming the group from Friday would silently skip Wednesday and
 *     Thursday. Rare, and a full replay is the right answer when it happens.
 *
 * Deliberately NOT used by `verify`, which always replays from the beginning.
 * The cheap path is checked against the expensive one every night, and that
 * check is only worth anything while the two are computed differently.
 */
async function resumePointFor(userId: string): Promise<ResumePoint | undefined> {
  const rows = await db
    .select({
      groupId: reputationDaily.groupId,
      day: reputationDaily.day,
      score: reputationDaily.score,
      completion: reputationDaily.completion,
      logicVersion: reputationDaily.logicVersion,
    })
    .from(reputationDaily)
    .where(eq(reputationDaily.userId, userId))
    .orderBy(reputationDaily.day);
  if (rows.length === 0) return undefined;

  const byScope = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = scopeKey(r.groupId);
    const list = byScope.get(key) ?? [];
    list.push(r);
    byScope.set(key, list);
  }

  const scores = new Map<string, { score: number; idleDays: number }>();
  let closedThrough: string | null = null;

  for (const [key, days] of byScope) {
    const last = days[days.length - 1];
    if (last.logicVersion !== LOGIC_VERSION) return undefined;
    if (closedThrough === null) closedThrough = last.day;
    else if (closedThrough !== last.day) return undefined;

    // How long nothing has been scheduled, counted back off the stored rows.
    // It is not a column because it is not a fact, only a run length, and
    // applyDay is the only thing that wants it.
    let idleDays = 0;
    for (let i = days.length - 1; i >= 0 && days[i].completion === null; i -= 1) {
      idleDays += 1;
    }
    scores.set(key, { score: Number(last.score), idleDays });
  }

  if (closedThrough === null) return undefined;
  return { day: addDays(closedThrough, 1), scores };
}

/** Idempotent: recompute, then upsert. Safe to run twice, or half. */
export async function scoreUser(
  userId: string,
  opts: { from?: string; to?: string; fines?: boolean; resume?: ResumePoint } = {},
): Promise<{ scores: number; outcomes: number; fines: number; reputation: number }> {
  const { scores, outcomes, reputation } = await recomputeUser(userId, opts);

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

  for (let i = 0; i < outcomes.length; i += 200) {
    await db
      .insert(activityOutcomes)
      .values(outcomes.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [
          activityOutcomes.groupId,
          activityOutcomes.userId,
          activityOutcomes.typeKey,
          activityOutcomes.periodStart,
        ],
        set: {
          passed: sql`excluded.passed`,
          graceUsed: sql`excluded.grace_used`,
          fineAmount: sql`excluded.fine_amount`,
          currency: sql`excluded.currency`,
          rulesVersion: sql`excluded.rules_version`,
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
          sql`(${r.userId}, ${r.groupId}, ${r.day}::date, ${r.score}::numeric, ${r.delta}::numeric, ${r.reason}, ${r.ceiling}::numeric, ${r.completion}::numeric, ${LOGIC_VERSION})`,
      ),
      sql`, `,
    );
    await db.execute(sql`
      INSERT INTO reputation_daily
        (user_id, group_id, day, score, delta, reason, ceiling, completion, logic_version)
      VALUES ${values}
      ON CONFLICT (user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), day)
      DO UPDATE SET
        score = excluded.score,
        delta = excluded.delta,
        reason = excluded.reason,
        ceiling = excluded.ceiling,
        completion = excluded.completion,
        logic_version = excluded.logic_version,
        computed_at = now()
    `);
  }

  // Fines need every member's outcome for the period, not just this user's,
  // because the split goes to whoever else passed. The nightly job scores
  // everyone first and then settles, so it passes fines:false here.
  const fines =
    opts.fines === false ? 0 : await writeFines(await peersFor(outcomes));

  return {
    scores: scores.length,
    outcomes: outcomes.length,
    fines,
    reputation: reputation.length,
  };
}

/** Write any fines this user owes, from outcomes already stored. */
export async function settleFines(userId: string): Promise<number> {
  const mine = await db
    .select({
      groupId: activityOutcomes.groupId,
      userId: activityOutcomes.userId,
      typeKey: activityOutcomes.typeKey,
      periodStart: activityOutcomes.periodStart,
      passed: activityOutcomes.passed,
      graceUsed: activityOutcomes.graceUsed,
      fineAmount: activityOutcomes.fineAmount,
      currency: activityOutcomes.currency,
      rulesVersion: activityOutcomes.rulesVersion,
    })
    .from(activityOutcomes)
    .where(and(eq(activityOutcomes.userId, userId), eq(activityOutcomes.passed, false)));

  return writeFines(await peersFor(mine));
}

/**
 * Every stored outcome for the (group, type, period) triples this user just
 * missed, so a fine can be split among the members who passed.
 */
async function peersFor(mine: OutcomeWrite[]): Promise<OutcomeRow[]> {
  const missed = mine.filter((o) => !o.passed && o.fineAmount > 0);
  if (missed.length === 0) return [];

  const out: OutcomeRow[] = [];
  const seen = new Set<string>();
  for (const o of missed) {
    const key = `${o.groupId}|${o.typeKey}|${o.periodStart}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rows = await db
      .select({
        groupId: activityOutcomes.groupId,
        userId: activityOutcomes.userId,
        typeKey: activityOutcomes.typeKey,
        periodStart: activityOutcomes.periodStart,
        passed: activityOutcomes.passed,
        fineAmount: activityOutcomes.fineAmount,
        currency: activityOutcomes.currency,
      })
      .from(activityOutcomes)
      .where(
        and(
          eq(activityOutcomes.groupId, o.groupId),
          eq(activityOutcomes.typeKey, o.typeKey),
          eq(activityOutcomes.periodStart, o.periodStart),
        ),
      );
    out.push(...rows);
  }
  return out;
}

/** Score every approved user who tracks anything. Used by the cron and the CLI. */
export async function scoreAll(
  opts: { from?: string } = {},
): Promise<{ users: number; fines: number }> {
  const users = await db
    .selectDistinct({ userId: userActivities.userId })
    .from(userActivities)
    .leftJoin(userApprovals, eq(userApprovals.userId, userActivities.userId))
    .where(isNull(userApprovals.disabledAt));

  // Two passes. A fine is split among the members who PASSED the same period,
  // so it cannot be written until their outcomes exist. Scoring everyone first
  // means a fine lands the night it is due rather than the night after.
  for (const u of users) {
    await scoreUser(u.userId, { from: opts.from, fines: false });
  }
  let fines = 0;
  for (const u of users) {
    fines += await settleFines(u.userId);
  }
  return { users: users.length, fines };
}

/**
 * Rewrite activity_scores, activity_outcomes and reputation_daily for a
 * range, from events. The admin Ops "Rebuild" primitive: unlike `scoreAll`,
 * this never settles fines, so it never writes `ledger_entries` (invariant
 * 3), and it never touches `events` either, since `scoreUser` only reads
 * them. One pass, not two: there is no fines pass to sequence after.
 */
export async function rebuildAll(
  opts: { from?: string; to?: string } = {},
): Promise<{ users: number; scores: number; outcomes: number }> {
  const users = await db
    .selectDistinct({ userId: userActivities.userId })
    .from(userActivities)
    .leftJoin(userApprovals, eq(userApprovals.userId, userActivities.userId))
    .where(isNull(userApprovals.disabledAt));

  let scores = 0;
  let outcomes = 0;
  for (const u of users) {
    const result = await scoreUser(u.userId, { from: opts.from, to: opts.to, fines: false });
    scores += result.scores;
    outcomes += result.outcomes;
  }
  return { users: users.length, scores, outcomes };
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
