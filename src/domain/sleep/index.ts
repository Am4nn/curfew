import { z } from "zod";
import { DateTime } from "luxon";
import type { ActivityType, CheckinStep, EvaluateInput } from "../types";

// The sleep activity type. This module is the ONLY place that knows sleep has a
// night, a wake and a confirm step, and the only place `night_ok` and friends
// exist (invariant 6). Everything outside consumes { passed, detail }.

const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

export const sleepConfigSchema = z
  .object({
    night_open: HHMM,
    night_close: HHMM,
    wake_open: HHMM,
    wake_close: HHMM,
    confirm_open: HHMM,
    confirm_close: HHMM,
  })
  .strict();

export type SleepConfig = z.infer<typeof sleepConfigSchema>;

// The timestamp is the evidence for sleep, so the payload is empty.
export const sleepEvidenceSchema = z.object({}).strict();
export type SleepEvidence = z.infer<typeof sleepEvidenceSchema>;

const STEPS = [
  { key: "night", label: "Night", open: "night_open", close: "night_close" },
  { key: "wake", label: "Wake", open: "wake_open", close: "wake_close" },
  { key: "confirm", label: "Confirm", open: "confirm_open", close: "confirm_close" },
] as const;

// Absolute instant of a wall-clock "HH:mm" within a noon-to-noon period.
// The period starts at noon on `periodStart` and ends at noon the next day, so
// a time before noon (wake 06:00, confirm 07:30) lands on the following
// calendar day, while an evening time (night 22:00) stays on periodStart.
function instantWithin(
  periodStart: string,
  timezone: string,
  hhmm: string,
): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  const midnight = DateTime.fromISO(periodStart, { zone: timezone }).startOf("day");
  const day = h < 12 ? midnight.plus({ days: 1 }) : midnight;
  return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

function stepPassed(
  input: EvaluateInput<SleepConfig, SleepEvidence>,
  stepKey: string,
  openField: keyof SleepConfig,
  closeField: keyof SleepConfig,
): boolean {
  const open = instantWithin(input.periodStart, input.timezone, input.config[openField]).toMillis();
  const close = instantWithin(input.periodStart, input.timezone, input.config[closeField]).toMillis();
  return input.checkins.some((c) => {
    if (c.step !== stepKey) return false;
    const at = c.at.getTime();
    return at >= open && at <= close;
  });
}

export const sleepActivity: ActivityType<SleepConfig, SleepEvidence> = {
  key: "sleep",
  period: "day",
  userConfigSchema: sleepConfigSchema,
  evidenceSchema: sleepEvidenceSchema,

  steps(config: SleepConfig): CheckinStep[] {
    return STEPS.map((s) => ({
      key: s.key,
      label: s.label,
      open: config[s.open],
      close: config[s.close],
    }));
  },

  evaluate(input) {
    const night_ok = stepPassed(input, "night", "night_open", "night_close");
    const wake_ok = stepPassed(input, "wake", "wake_open", "wake_close");
    const confirm_ok = stepPassed(input, "confirm", "confirm_open", "confirm_close");
    return {
      passed: night_ok && wake_ok && confirm_ok,
      detail: { night_ok, wake_ok, confirm_ok },
    };
  },
};
