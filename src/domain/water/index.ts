import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { countPass } from "../pass";

// Water. The counter type: one press a glass, repeated through the day, showing
// progress against the target.
//
// No evidence at all. A photo of a glass proves nothing about drinking it, and
// the type says so rather than pretending otherwise.

export const WATER_STEP = "glass";

const waterConfigSchema = z
  .object({ glasses: z.number().int().min(1).max(30) })
  .strict();
export type WaterConfig = z.infer<typeof waterConfigSchema>;

const waterEvidenceSchema = z.object({}).strict();
export type WaterEvidence = z.infer<typeof waterEvidenceSchema>;

export const waterActivity: ActivityType<WaterConfig, WaterEvidence> = {
  key: "water",
  name: "Water",
  description: "Glasses through the day",
  icon: "water",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    // Half an hour between glasses. Eight of them is then spread over at least
    // three and a half hours, which is a day somebody drank water in rather
    // than a day somebody tapped a button eight times.
    minGap: 30,
    config: { glasses: 8 },
  },

  configSchema: waterConfigSchema,
  evidenceSchema: waterEvidenceSchema,

  evidence: {
    level: "none",
    source: "live",
    detail: "Nothing to photograph. This runs on your word.",
  },
  checkin: { kind: "counter" },
  chart: {
    kind: "numeric",
    heading: "GLASSES A DAY",
    valueField: "glasses",
    targetField: "target",
  },

  summary(config) {
    return `${config.glasses} ${config.glasses === 1 ? "glass" : "glasses"} of water`;
  },

  fields() {
    return [
      {
        kind: "number",
        key: "glasses",
        label: "Glasses a day",
        min: 1,
        max: 30,
        unit: "glasses",
      },
    ];
  },

  steps() {
    // The one step in the catalog that is meant to be pressed all day.
    return [
      { key: WATER_STEP, label: "Glass", open: "00:00", close: "23:59", repeats: true },
    ];
  },

  hint(input) {
    const glasses = input.checkins.filter((c) => c.step === WATER_STEP).length;
    return `${glasses} of ${input.config.glasses} today.`;
  },

  // Counting down, not up. "0 of 8 today." is the right line under the control
  // and the wrong one on a lock screen, where it was read as progress and the
  // copy called it "Almost there".
  remind(input) {
    const glasses = input.checkins.filter((c) => c.step === WATER_STEP).length;
    const left = input.config.glasses - glasses;
    if (left <= 0) return null;
    return `${left} ${left === 1 ? "glass" : "glasses"} to go.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(WATER_STEP, "Glass", periodStart, timezone, ALL_DAY);
  },

  // Spread across the day, because the target is eight glasses and nobody
  // drinks eight at nine o'clock. Reminding before the window closes, which is
  // what the engine would do without this, is the one time of day the reminder
  // cannot be acted on.
  reminderCues: ["11:00", "15:00", "19:00"],

  evaluate(input) {
    const glasses = input.checkins.filter((c) => c.step === WATER_STEP);
    const result = countPass(glasses, { min: input.config.glasses });
    return {
      passed: result.passed,
      detail: { glasses: result.count, target: input.config.glasses },
    };
  },
};
