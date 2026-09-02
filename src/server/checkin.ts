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
  type CheckinKind,
  type ConfigField,
  type EvidenceRule,
} from "@/domain";
import { getUserActivity } from "./activities";
import { resolveUserTimezone } from "./config";
import { recordEvent } from "./events";
import { rateLimit } from "./ratelimit";
import { now } from "@/lib/clock";

// The check-in path, one implementation for all twelve types.
//
// Nothing here knows what a type means (invariant 6). The engine asks the
// module for its steps and its windows, prints the module's own words, and
// stores whatever its evidenceSchema accepts. Every sentence on the screen that
// is specific to a type comes from the type.
//
// Invariant 9: nothing in this file writes on a read. getCheckinState is a
// query. The only writer is performCheckin, and it is only ever reached from a
// POST.

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
  /** Is this step's window open at the moment this was read? */
  open: boolean;
  /** How many check-ins this step already has this period. */
  count: number;
  repeats: boolean;
  fields: ConfigField[];
  prompt: string | null;
  aside: string | null;
  consequence: string | null;
  /** The module's own line under the fields, for what is recorded so far. */
  hint: string | null;
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
    return {
      key: step.key,
      label: step.label,
      opensLabel: window ? label(window.opensAt, timezone) : "",
      closesLabel: window ? label(window.closesAt, timezone) : "",
      open: window ? instant >= window.opensAt && instant <= window.closesAt : false,
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
    // A line of your own, for your own record. Optional everywhere, never
    // scored, and never read by the admin console.
    note: z.string().trim().max(200).optional(),
    evidence: z.unknown().optional(),
  })
  .strict();

export type CheckinInput = z.infer<typeof checkinInputSchema>;

export type CheckinResult =
  | { ok: true; step: string; atLabel: string }
  | {
      ok: false;
      reason:
        | "untracked"
        | "unscheduled"
        | "unknown_step"
        | "closed"
        | "invalid"
        | "duplicate"
        | "rate_limited";
      message: string;
    };

// Abuse ceilings, not quotas (decision 92). 50 a period clears eight glasses of
// water several times over; 20 a minute stops a button that has got stuck.
const PER_PERIOD = 50;
const PER_MINUTE = 20;

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

  const activity = await getUserActivity(userId, input.typeKey);
  if (!activity || !activity.enabled) {
    return {
      ok: false,
      reason: "untracked",
      message: "You are not tracking this activity.",
    };
  }

  const type = getActivityType(input.typeKey);
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

  const step = type
    .steps(activity.config, period)
    .find((s) => s.key === input.step);
  const window = type
    .windows(activity.config, period, timezone)
    .find((w) => w.step === input.step);
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
      note: input.note && input.note !== "" ? input.note : undefined,
      evidence: evidence.data,
    },
    ignoreConflict: true,
  });

  // No row means the unique index matched: this exact press is already
  // recorded. Replaying it changed nothing, which is the point.
  if (!row) {
    return { ok: false, reason: "duplicate", message: "Already recorded." };
  }

  return { ok: true, step: input.step, atLabel: label(row.occurredAt, timezone) };
}
