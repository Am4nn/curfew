import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { countPass } from "../pass";

// Supplements. Once a day, no window (decision 46): there is no right time to
// take them, only whether you did. The simplest camera type in the catalog.

export const SUPPLEMENTS_STEP = "dose";

const supplementsConfigSchema = z
  .object({ dosesPerDay: z.number().int().min(1).max(6) })
  .strict();
export type SupplementsConfig = z.infer<typeof supplementsConfigSchema>;

const supplementsEvidenceSchema = z.object({}).strict();
export type SupplementsEvidence = z.infer<typeof supplementsEvidenceSchema>;

export const supplementsActivity: ActivityType<SupplementsConfig, SupplementsEvidence> = {
  key: "supplements",
  name: "Supplements",
  description: "A photo of what you took",
  icon: "supplements",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    config: { dosesPerDay: 1 },
  },

  configSchema: supplementsConfigSchema,
  evidenceSchema: supplementsEvidenceSchema,

  evidence: {
    level: "required",
    source: "live",
    detail: "Live camera. A photo of what you took.",
  },
  checkin: { kind: "camera" },
  chart: { kind: "binary", heading: "TAKEN OR MISSED" },

  summary(config) {
    return `${config.dosesPerDay} ${config.dosesPerDay === 1 ? "dose" : "doses"}`;
  },

  fields() {
    return [
      {
        kind: "number",
        key: "dosesPerDay",
        label: "Doses a day",
        min: 1,
        max: 6,
        unit: "doses",
      },
    ];
  },

  steps() {
    return [
      { key: SUPPLEMENTS_STEP, label: "Dose", open: "00:00", close: "23:59", repeats: true },
    ];
  },

  hint(input) {
    const doses = input.checkins.filter((c) => c.step === SUPPLEMENTS_STEP).length;
    return `${doses} of ${input.config.dosesPerDay} today.`;
  },

  remind(input) {
    const doses = input.checkins.filter((c) => c.step === SUPPLEMENTS_STEP).length;
    const left = input.config.dosesPerDay - doses;
    if (left <= 0) return null;
    return `${left} ${left === 1 ? "dose" : "doses"} to go.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(SUPPLEMENTS_STEP, "Dose", periodStart, timezone, ALL_DAY);
  },

  // Beside a meal, which is when most people take them and when the bottle is
  // in reach. Two rather than three: a dose missed at breakfast is usually
  // taken at dinner, and a third reminder in between says nothing new.
  reminderCues: ["09:30", "20:30"],

  evaluate(input) {
    const doses = input.checkins.filter((c) => c.step === SUPPLEMENTS_STEP);
    const result = countPass(doses, { min: input.config.dosesPerDay });
    return {
      passed: result.passed,
      detail: { doses: result.count, required: input.config.dosesPerDay },
    };
  },
};
