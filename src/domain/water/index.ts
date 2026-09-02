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

export const waterConfigSchema = z
  .object({ glasses: z.number().int().min(1).max(30) })
  .strict();
export type WaterConfig = z.infer<typeof waterConfigSchema>;

export const waterEvidenceSchema = z.object({}).strict();
export type WaterEvidence = z.infer<typeof waterEvidenceSchema>;

export const waterActivity: ActivityType<WaterConfig, WaterEvidence> = {
  key: "water",
  name: "Water",
  description: "Glasses through the day",
  icon: "water",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { glasses: 8 },
  },

  configSchema: waterConfigSchema,
  evidenceSchema: waterEvidenceSchema,

  evidence: { level: "none", source: "live" },
  checkin: { kind: "counter" },
  chart: "numeric",
  fields: [
    { kind: "number", key: "glasses", label: "Glasses a day", min: 1, max: 30 },
  ],

  steps() {
    return [{ key: WATER_STEP, label: "Glass", open: "00:00", close: "23:59" }];
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(WATER_STEP, "Glass", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const glasses = input.checkins.filter((c) => c.step === WATER_STEP);
    const result = countPass(glasses, { min: input.config.glasses });
    return {
      passed: result.passed,
      detail: { glasses: result.count, target: input.config.glasses },
    };
  },
};
