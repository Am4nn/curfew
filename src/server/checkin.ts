import { z } from "zod";
import { DateTime } from "luxon";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import {
  getActivityType,
  periodStart,
  periodUnit,
  isScheduledDay,
  weekdayOf,
  type Checkin,
  type CheckinStep,
  type CheckinWindow,
  type CheckinKind,
  type ConfigField,
  type EvidenceRule,
  daysDoneIn,
} from "@/domain";
import { getUserActivity } from "./activities";
import { resolveUserTimezone } from "./config";
import { recordEvent } from "./events";
import { rateLimit } from "./ratelimit";
import { pendingFor, confirmEvidence } from "./evidence";
import { bumpStreak } from "./streak";
import { now } from "@/lib/clock";

// The check-in path, one implementation for all twelve types. Nothing here
// knows what a type means (invariant 6): the module supplies its steps, its
// windows, its words and its evidence shape.
//
// getCheckinState is a query. The only writer is performCheckin, reached only
// from a POST (invariant 9).

const TIME = "h:mm a"; // 12-hour with AM or PM (CLAUDE.md voice).

function label(at: Date, timezone: string): string {
  return DateTime.fromJSDate(at, { zone: timezone }).toFormat(TIME);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface RecordedCheckin {
  step: string;
  /** ISO, so the whole state crosses to a client component unchanged. */
  at: string;
  atLabel: string;
  evidence: Record<string, unknown>;
}

export interface CheckinStepView {
  key: string;
  label: string;
  opensLabel: string;
  closesLabel: string;
  /**
   * Is this step's window open AND would another press count?
   *
   * The two are separate below, because collapsing them here made the check-in
   * screen say "No window is open" about a gym session on a Tuesday evening,
   * when the window was open all week and the real answer was that Tuesday was
   * already logged.
   */
  open: boolean;
  /** Is the clock inside this step's window? */
  inWindow: boolean;
  /** Would another press of it change anything? The module decides. */
  counts: boolean;
  /** How many check-ins this step already has this period. */
  count: number;
  repeats: boolean;
  fields: ConfigField[];
  prompt: string | null;
  aside: string | null;
  consequence: string | null;
  /** The module's own line under the fields, for what is recorded so far. */
  hint: string | null;
  /** `hint` as it would read after one more press of this step. */
  nextHint: string | null;
}

export interface ActivityCheckinState {
  typeKey: string;
  name: string;
  kind: CheckinKind;
  evidence: EvidenceRule;
  period: string;
  timezone: string;
  /** The module's config, carried so the client can ask it for a live hint. */
  config: unknown;
  /** False on a day this activity is not scheduled for. */
  scheduled: boolean;
  /** Whether the period passes on what is recorded so far. */
  passed: boolean;
  nowLabel: string;
  steps: CheckinStepView[];
  recorded: RecordedCheckin[];
}

/** Everything recorded for one type in one period, in the module's own shape. */
async function recordedFor(
  userId: string,
  typeKey: string,
  period: string,
): Promise<{ rows: RecordedCheckin[]; checkins: Checkin<unknown>[] }> {
  const rows = await db
    .select({
      type: events.type,
      occurredAt: events.occurredAt,
      payload: events.payload,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, `checkin.${typeKey}.%`),
        sql`${events.payload}->>'period_start' = ${period}`,
      ),
    )
    .orderBy(events.occurredAt);

  const checkins: Checkin<unknown>[] = [];
  const out: RecordedCheckin[] = [];
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const step = String(payload.step ?? row.type.split(".").pop());
    const evidence = (payload.evidence ?? {}) as Record<string, unknown>;
    checkins.push({ step, at: row.occurredAt, evidence });
    out.push({ step, at: row.occurredAt.toISOString(), atLabel: "", evidence });
  }
  return { rows: out, checkins };
}

/**
 * Everything the check-in screen needs for one type, or null when the user does
 * not track it.
 */
export async function getCheckinState(
  userId: string,
  typeKey: string,
): Promise<ActivityCheckinState | null> {
  const activity = await getUserActivity(userId, typeKey);
  if (!activity || !activity.enabled) return null;

  const type = getActivityType(typeKey);
  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );
  const period = periodStart(instant, timezone, {
    unit: periodUnit(activity.schedule.schedule),
    boundary: activity.schedule.dayBoundary,
  });

  const { rows, checkins } = await recordedFor(userId, typeKey, period);
  for (const row of rows) row.atLabel = label(new Date(row.at), timezone);

  const steps = type.steps(activity.config, period);
  const windows = type.windows(activity.config, period, timezone);
  const evaluated = type.evaluate({
    periodStart: period,
    timezone,
    config: activity.config,
    checkins,
  });

  const views: CheckinStepView[] = steps.map((step) => {
    const window = windows.find((w) => w.step === step.key);
    const mine = checkins.filter((c) => c.step === step.key);
    const inWindow = window
      ? instant >= window.opensAt && instant <= window.closesAt
      : false;
    const counts =
      type.countsNow?.({
        periodStart: period,
        timezone,
        config: activity.config,
        checkins,
        step: step.key,
        pending: null,
      }) ?? true;
    return {
      key: step.key,
      label: step.label,
      opensLabel: window ? label(window.opensAt, timezone) : "",
      closesLabel: window ? label(window.closesAt, timezone) : "",
      // Open means the window is open AND another press would count. Gym's
      // window is the whole week, but only one session a day counts, so a
      // Tuesday evening press after a Tuesday morning one is not "open".
      open: inWindow && counts,
      inWindow,
      counts,
      count: mine.length,
      repeats: step.repeats ?? false,
      fields: step.fields ?? [],
      prompt: step.prompt ?? null,
      aside: step.aside ?? null,
      consequence: step.consequence ?? null,
      hint:
        type.hint?.({
          periodStart: period,
          timezone,
          config: activity.config,
          checkins,
          step: step.key,
          pending: null,
        }) ?? null,
      // The same line, as it would read if one more press of this step had
      // landed. Home shows it the instant the tick is pressed, instead of
      // leaving the old count on screen until the round trip returns.
      //
      // The engine only asks the question. The module writes both sentences
      // from the same code, so nothing here learns what a glass or a meal is
      // (invariant 6), and a type that has no hint gets null for both.
      nextHint:
        type.hint?.({
          periodStart: period,
          timezone,
          config: activity.config,
          checkins: [...checkins, { step: step.key, at: instant }],
          step: step.key,
          pending: null,
        }) ?? null,
    };
  });

  return {
    typeKey,
    name: type.name,
    kind: type.checkin.kind,
    evidence: type.evidence,
    period,
    timezone,
    config: activity.config,
    scheduled: isScheduledDay(activity.schedule.schedule, weekdayOf(period)),
    passed: evaluated.passed,
    nowLabel: label(instant, timezone),
    steps: views,
    recorded: rows,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// The press carries its own key. Uniqueness in the database is on that key, so
// a retried or replayed request records nothing, while a second deliberate
// press records a second check-in.
export const checkinInputSchema = z
  .object({
    typeKey: z.string().min(1).max(40),
    step: z.string().min(1).max(40),
    idem: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "expected an idempotency key"),
    /** The object key returned when the photo's upload URL was issued. */
    evidenceKey: z.string().min(1).max(300).optional(),
    evidence: z.unknown().optional(),
  })
  .strict();

export type CheckinInput = z.infer<typeof checkinInputSchema>;

export type CheckinFailure =
  | "untracked"
  | "unscheduled"
  | "unknown_step"
  | "closed"
  | "invalid"
  | "duplicate"
  | "rate_limited"
  | "no_photo"
  | "already_counted";

export type CheckinResult =
  | { ok: true; step: string; atLabel: string }
  | { ok: false; reason: CheckinFailure; message: string };

// Abuse ceilings, not quotas (decision 92). 50 a period clears eight glasses of
// water several times over; 20 a minute stops a button that has got stuck.
const PER_PERIOD = 50;
const PER_MINUTE = 20;

/**
 * Everything a write needs about one step: tracked, scheduled today, the step
 * exists, its window is open. Both the check-in and the upload-URL request go
 * through here, so a photo can never be uploaded against a window a check-in
 * would be refused for.
 */
export type CheckinTarget =
  | {
      ok: true;
      type: ReturnType<typeof getActivityType>;
      config: unknown;
      period: string;
      timezone: string;
      instant: Date;
      step: CheckinStep;
      window: CheckinWindow;
    }
  | { ok: false; reason: CheckinFailure; message: string };

export async function resolveCheckinTarget(
  userId: string,
  typeKey: string,
  stepKey: string,
): Promise<CheckinTarget> {
  const activity = await getUserActivity(userId, typeKey);
  if (!activity || !activity.enabled) {
    return {
      ok: false,
      reason: "untracked",
      message: "You are not tracking this activity.",
    };
  }

  const type = getActivityType(typeKey);
  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );
  const period = periodStart(instant, timezone, {
    unit: periodUnit(activity.schedule.schedule),
    boundary: activity.schedule.dayBoundary,
  });

  if (!isScheduledDay(activity.schedule.schedule, weekdayOf(period))) {
    return {
      ok: false,
      reason: "unscheduled",
      message: "This activity is not scheduled today.",
    };
  }

  const step = type.steps(activity.config, period).find((s) => s.key === stepKey);
  const window = type
    .windows(activity.config, period, timezone)
    .find((w) => w.step === stepKey);
  if (!step || !window) {
    return { ok: false, reason: "unknown_step", message: "No such check-in." };
  }

  // The window is decided here, from the server clock and the resolved config.
  // A client that sends a step outside its window is refused (invariant 8).
  if (instant < window.opensAt || instant > window.closesAt) {
    return {
      ok: false,
      reason: "closed",
      message: `${step.label} closed ${label(window.closesAt, timezone)}.`,
    };
  }

  // The module's own answer to "would another press change anything?". Gym
  // counts one session a calendar day, so a second press on the same day is
  // refused here rather than recorded and silently thrown away by evaluate.
  const { checkins: recorded } = await recordedFor(userId, typeKey, period);
  const counts =
    type.countsNow?.({
      periodStart: period,
      timezone,
      config: activity.config,
      checkins: recorded,
      step: stepKey,
      pending: null,
    }) ?? true;
  if (!counts) {
    return {
      ok: false,
      reason: "already_counted",
      message: `${step.label} is already recorded for today.`,
    };
  }

  return {
    ok: true,
    type,
    config: activity.config,
    period,
    timezone,
    instant,
    step,
    window,
  };
}

export async function performCheckin(
  userId: string,
  sessionId: string | null,
  raw: unknown,
): Promise<CheckinResult> {
  const parsed = checkinInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "That check-in was malformed." };
  }
  const input = parsed.data;

  const target = await resolveCheckinTarget(userId, input.typeKey, input.step);
  if (!target.ok) return target;
  const { type, config, period, timezone, step } = target;

  // The check-in is the callback: the upload came first, this confirms it. A
  // required photo that is missing means no check-in at all, which is what
  // makes a Gym streak mean the same thing for everyone in a group.
  const needsPhoto =
    type.evidence.level === "required" &&
    (type.evidence.steps === undefined || type.evidence.steps.includes(input.step));

  type Photo = NonNullable<Awaited<ReturnType<typeof pendingFor>>>;
  let photo: Photo | null = null;
  if (input.evidenceKey) {
    photo = await pendingFor(userId, input.idem);
    if (!photo || photo.objectKey !== input.evidenceKey) {
      return {
        ok: false,
        reason: "invalid",
        message: "That photo does not belong to this check-in.",
      };
    }
  }
  if (needsPhoto && !photo) {
    return {
      ok: false,
      reason: "no_photo",
      message: `${step.label} needs a photo.`,
    };
  }

  const evidence = type.evidenceSchema.safeParse(input.evidence ?? {});
  if (!evidence.success) {
    return {
      ok: false,
      reason: "invalid",
      message: evidence.error.issues[0]?.message ?? "That is not a valid entry.",
    };
  }

  // A step that does not repeat keeps the guarantee the old index gave: one
  // arrival at the office, one gym session a day, one of each sleep window.
  if (!step.repeats) {
    const { checkins } = await recordedFor(userId, input.typeKey, period);
    if (checkins.some((c) => c.step === input.step)) {
      return {
        ok: false,
        reason: "duplicate",
        message: `${step.label} is already recorded.`,
      };
    }
  }

  const [burst, perPeriod] = await Promise.all([
    rateLimit({
      key: `checkin:${userId}:${input.typeKey}`,
      limit: PER_MINUTE,
      windowSeconds: 60,
    }),
    rateLimit({
      key: `checkin:${userId}:${input.typeKey}:${period}`,
      limit: PER_PERIOD,
      // Long enough to cover any period. The counter can roll once inside a
      // week, which is acceptable for a ceiling nobody honest ever meets.
      windowSeconds: 172_800,
    }),
  ]);
  if (!burst.ok || !perPeriod.ok) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "Too many check-ins at once. Wait a moment.",
    };
  }

  const row = await recordEvent({
    userId,
    sessionId,
    type: `checkin.${input.typeKey}.${input.step}`,
    payload: {
      type_key: input.typeKey,
      step: input.step,
      period_start: period,
      idem: input.idem,
      evidence_key: photo?.objectKey,
      evidence: evidence.data,
    },
    ignoreConflict: true,
  });

  // No row means the unique index matched: this exact press is already
  // recorded. Replaying it changed nothing, which is the point.
  if (!row) {
    return { ok: false, reason: "duplicate", message: "Already recorded." };
  }

  // The event is the truth, so it goes first. A failure here leaves the photo
  // unconfirmed and the sweep repairs it from the event.
  if (photo) await confirmEvidence(photo.id, row.occurredAt);

  // And the streak moves now, because a streak is a count of things you did and
  // this press is one of them. Nothing else in the app moves on a press: the
  // day's reputation is not a result until the day ends, and a fine cannot be
  // split until everyone else is scored.
  //
  // Not atomic with the event above, and it cannot be: this codebase has no
  // transactions available (`src/db/index.ts`, the Neon HTTP driver refuses
  // them). The event is the truth and the counter is a cache, so the failure
  // falls the right way. A crash here leaves the streak one behind until the
  // next close rebuilds it, and `verify` reports it in the meantime. The same
  // trade `confirmEvidence` takes one line above.
  await bumpForPress(userId, input.typeKey, period, timezone, config, row.occurredAt, input.step);

  return { ok: true, step: input.step, atLabel: label(row.occurredAt, timezone) };
}

/**
 * How much this press added to the streak: the days that count now, minus the
 * days that counted before it.
 *
 * Usually nothing or one. A fourth glass of an eight-glass day completes no
 * day and adds nothing; the eighth completes it and adds one. A gym session
 * adds a day, and a second session that evening adds nothing, because the
 * module counts at most one session a calendar day.
 *
 * The module decides, and the engine only subtracts (invariant 6).
 */
async function bumpForPress(
  userId: string,
  typeKey: string,
  period: string,
  timezone: string,
  config: unknown,
  at: Date,
  step: string,
): Promise<void> {
  const { checkins } = await recordedFor(userId, typeKey, period);
  const input = { periodStart: period, timezone, config, checkins };

  // The same period as it stood a moment ago: everything except the press that
  // just landed. Identified by its server timestamp, which is unique to it.
  const before = {
    ...input,
    checkins: checkins.filter((c) => !(c.step === step && c.at.getTime() === at.getTime())),
  };

  const had = new Set(daysDoneIn(typeKey, before));
  const gained = daysDoneIn(typeKey, input).filter((d) => !had.has(d));
  if (gained.length > 0) await bumpStreak(userId, typeKey, gained);
}
