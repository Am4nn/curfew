import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { countPass } from "../pass";

// Supplements. Once a day, no window (decision 46): there is no right time to
// take them, only whether you did. The simplest camera type in the catalog.

export const SUPPLEMENTS_STEP = "dose";

export const supplementsConfigSchema = z
  .object({ dosesPerDay: z.number().int().min(1).max(6) })
  .strict();
export type SupplementsConfig = z.infer<typeof supplementsConfigSchema>;

export const supplementsEvidenceSchema = z.object({}).strict();
export type SupplementsEvidence = z.infer<typeof supplementsEvidenceSchema>;

export const supplementsActivity: ActivityType<SupplementsConfig, SupplementsEvidence> = {
  key: "supplements",
  name: "Supplements",
  description: "A photo of what you took",
  icon: "supplements",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { dosesPerDay: 1 },
  },

  configSchema: supplementsConfigSchema,
  evidenceSchema: supplementsEvidenceSchema,

  evidence: { level: "required", source: "live" },
  checkin: { kind: "camera" },
  chart: "binary",
  fields: [
    { kind: "number", key: "dosesPerDay", label: "Doses a day", min: 1, max: 6 },
  ],

  steps() {
    return [{ key: SUPPLEMENTS_STEP, label: "Dose", open: "00:00", close: "23:59" }];
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(SUPPLEMENTS_STEP, "Dose", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const doses = input.checkins.filter((c) => c.step === SUPPLEMENTS_STEP);
    const result = countPass(doses, { min: input.config.dosesPerDay });
    return {
      passed: result.passed,
      detail: { doses: result.count, required: input.config.dosesPerDay },
    };
  },
};
