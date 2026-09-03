import { z } from "zod";
import { DateTime } from "luxon";
import type {
  ActivityType,
  CheckinStep,
  CheckinWindow,
  EvaluateInput,
} from "../types";
import { countPass } from "../pass";

// The gym activity type. Sleep and Gym are the two shapes in the catalog:
// sleep is a windowed day, gym is a weekly minimum with no windows at all. If
// the engine can score both, the remaining ten are configuration.
//
// This module is the only place that knows a gym period counts sessions.
// Everything outside consumes { passed, detail } (invariant 6).

export const gymConfigSchema = z
  .object({
    // How many sessions the week needs. The engine's schedule already carries
    // "any N per week"; this mirrors it so a module can be evaluated on its own
    // in a test without a schedule beside it. The configure screen writes both
    // from one control.
    sessionsPerWeek: z.number().int().min(1).max(7),
  })
  .strict();

export type GymConfig = z.infer<typeof gymConfigSchema>;

// A session carries nothing but the fact it happened. The photo lives in the
// evidence table, not here.
export const gymEvidenceSchema = z.object({}).strict();
export type GymEvidence = z.infer<typeof gymEvidenceSchema>;

export const GYM_STEP = "session";

export const gymActivity: ActivityType<GymConfig, GymEvidence> = {
  key: "gym",
  name: "Gym",
  description: "Sessions counted over a week",
  icon: "gym",

  defaults: {
    schedule: { kind: "minimum", perWeek: 3 },
    dayBoundary: "midnight",
    grace: 2,
    config: { sessionsPerWeek: 3 },
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
  checkin: { kind: "tap" },
  chart: "weekly",
  // Nothing of its own. "Any 3 a week" is the engine's schedule, drawn by the
  // day picker, so a second control here would be the same number twice.
  fields() {
    return [];
  },

  // No windows. A session counts whenever it happens, so the step spans the
  // whole day rather than pretending to a schedule nobody set.
  steps(): CheckinStep[] {
    return [{ key: GYM_STEP, label: "Session", open: "00:00", close: "23:59" }];
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

  evaluate(input: EvaluateInput<GymConfig, GymEvidence>) {
    // At most one session counts per calendar day. Two presses on a Tuesday are
    // one day at the gym, and without this a single enthusiastic day would pass
    // a whole week.
    const sessionDays = new Set(
      input.checkins
        .filter((c) => c.step === GYM_STEP)
        .map((c) =>
          DateTime.fromJSDate(c.at, { zone: input.timezone }).toFormat("yyyy-MM-dd"),
        ),
    );

    const days = [...sessionDays].sort();
    const result = countPass(
      days.map((d) => ({ step: GYM_STEP, at: new Date(d) })),
      { min: input.config.sessionsPerWeek },
    );

    return {
      passed: result.passed,
      detail: { sessions: result.count, days, required: input.config.sessionsPerWeek },
    };
  },
};
