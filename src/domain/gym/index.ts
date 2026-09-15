import { z } from "zod";
import { DateTime } from "luxon";
import type {
  ActivityType,
  CheckinStep,
  CheckinWindow,
  EvaluateInput,
} from "../types";
import type { Schedule } from "../schedule";
import { countPass } from "../pass";

// The gym activity type. Sleep and Gym are the two shapes in the catalog:
// sleep is a windowed day, gym is a weekly minimum with no windows at all. If
// the engine can score both, the remaining ten are configuration.
//
// This module is the only place that knows a gym period counts sessions.
// Everything outside consumes { passed, detail } (invariant 6).

// Nothing of its own. How many sessions the week needs is the schedule's
// `perWeek`, which the engine already owns and draws with one control. This
// used to mirror it as `sessionsPerWeek` so a module could be evaluated
// without a schedule beside it, and the mirror was the bug: one number written
// twice, from one control, with nothing keeping the two in step.
export const gymConfigSchema = z.object({}).strict();

export type GymConfig = z.infer<typeof gymConfigSchema>;

// A session carries nothing but the fact it happened. The photo lives in the
// evidence table, not here.
const gymEvidenceSchema = z.object({}).strict();
export type GymEvidence = z.infer<typeof gymEvidenceSchema>;

export const GYM_STEP = "session";

/** What a gym week asks for when the schedule is not the "any N a week" shape. */
const DEFAULT_PER_WEEK = 3;

/**
 * How many days at the gym this week needs.
 *
 * The schedule is the only place this lives now. A gym schedule is "any N a
 * week" by construction, so the other shape is not a target and the module
 * falls back to its own default rather than inventing one from a day list.
 */
function needed(schedule: Schedule): number {
  return schedule.kind === "minimum" ? schedule.perWeek : DEFAULT_PER_WEEK;
}

/**
 * The calendar days a session was recorded on, in the user's zone.
 *
 * At most one session counts per day: two presses on a Tuesday are one day at
 * the gym, and without that a single enthusiastic day would pass a whole week.
 * `evaluate`, `hint` and `countsNow` all need the same answer, so the rule
 * lives here rather than three times over.
 */
function sessionDays(
  checkins: { step: string; at: Date }[],
  timezone: string,
): Set<string> {
  return new Set(
    checkins
      .filter((c) => c.step === GYM_STEP)
      .map((c) => DateTime.fromJSDate(c.at, { zone: timezone }).toFormat("yyyy-MM-dd")),
  );
}

export const gymActivity: ActivityType<GymConfig, GymEvidence> = {
  key: "gym",
  name: "Gym",
  description: "Sessions counted over a week",
  icon: "gym",

  defaults: {
    schedule: { kind: "minimum", perWeek: 3 },
    dayBoundary: "midnight",
    config: {},
  },

  configSchema: gymConfigSchema,
  evidenceSchema: gymEvidenceSchema,

  // Always required, live. A gym session is the easiest thing in the catalog to
  // claim and not do.
  evidence: {
    level: "required",
    source: "live",
    detail: "Live camera, on every session.",
  },
  // A session requires a live photo, so pressing the button opens a camera and
  // the kind has to say so. It said "tap", which is what office is: one press
  // and nothing to attach. Home reads this to label the control, so gym offered
  // "Check in" and then opened a viewfinder.
  checkin: { kind: "camera" },
  chart: {
    kind: "weekly",
    heading: "SESSIONS A WEEK",
    valueField: "sessions",
    targetField: "required",
  },
  // Nothing of its own. "Any 3 a week" is the engine's schedule, drawn by the
  // day picker, so a second control here would be the same number twice.
  summary() {
    // No numbers of its own. How many days a week is the schedule's, and the
    // engine says that half.
    return "a session at the gym";
  },

  fields() {
    return [];
  },

  // No windows. A session counts whenever it happens, so the step spans the
  // whole day rather than pretending to a schedule nobody set.
  steps(): CheckinStep[] {
    // The period is a WEEK, and the point of the type is several sessions in
    // it, so the step repeats. Without this the engine's one-arrival-per-period
    // guard allowed exactly one gym session a week through the UI, however many
    // the config asked for. `countsNow` is what limits it to one a day; this
    // says the week is not done after the first.
    return [
      { key: GYM_STEP, label: "Session", open: "00:00", close: "23:59", repeats: true },
    ];
  },

  windows(_config, periodStart, timezone): CheckinWindow[] {
    const opensAt = DateTime.fromISO(periodStart, { zone: timezone }).startOf("day");
    // A weekly period runs Monday to Sunday, so the window is the whole week.
    return [
      {
        step: GYM_STEP,
        label: "Session",
        opensAt: opensAt.toJSDate(),
        closesAt: opensAt.plus({ days: 7 }).toJSDate(),
      },
    ];
  },

  // Days at the gym this week, which is what the module counts. One a day,
  // however many times you press.
  hint(input) {
    const days = sessionDays(input.checkins, input.timezone);
    const need = needed(input.schedule);
    const today = DateTime.now().setZone(input.timezone).toFormat("yyyy-MM-dd");
    // A met week says so with the count: "4 of 3 this week", which is what the
    // mock draws and what the tick beside it already means. It used to add
    // "Done.", which read as an instruction to stop next to a button offering
    // another day.
    if (days.size >= need) return `${days.size} of ${need} this week.`;
    // Still short, and today is spent: no tick, no button, so the line is the
    // only thing that can say why.
    if (days.has(today)) {
      return `${days.size} of ${need} this week. Today is logged.`;
    }
    return `${days.size} of ${need} this week.`;
  },

  // One session a day counts, so once today is logged another press changes
  // nothing and Home stops offering the button. Without this the dashboard
  // invited a press that `evaluate` would throw away.
  countsNow(input) {
    const today = DateTime.now().setZone(input.timezone).toFormat("yyyy-MM-dd");
    return !sessionDays(input.checkins, input.timezone).has(today);
  },

  evaluate(input: EvaluateInput<GymConfig, GymEvidence>) {
    const days = [...sessionDays(input.checkins, input.timezone)].sort();
    const result = countPass(
      days.map((d) => ({ step: GYM_STEP, at: new Date(d) })),
      { min: needed(input.schedule) },
    );

    return {
      passed: result.passed,
      detail: { sessions: result.count, days, required: needed(input.schedule) },
    };
  },

  // A session day is a streak day, whether or not the week goes on to meet its
  // minimum. Days add as they happen (decision 77), and the week is judged at
  // week end; the engine does that judging, this only says which days counted.
  daysDone(input: EvaluateInput<GymConfig, GymEvidence>) {
    return [...sessionDays(input.checkins, input.timezone)].sort();
  },
};
