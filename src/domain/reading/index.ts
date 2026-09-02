import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { thresholdPass, sumField } from "../pass";

// Reading. Minutes OR pages, one unit chosen on the configure screen with a
// single target beside it (decision 87). Tracking both and passing on either
// would leave the check-in asking for two numbers, one of them always blank.

export const READING_STEP = "session";

export const readingUnitSchema = z.enum(["minutes", "pages"]);
export type ReadingUnit = z.infer<typeof readingUnitSchema>;

export const readingConfigSchema = z
  .object({
    unit: readingUnitSchema,
    target: z.number().int().min(1).max(5000),
  })
  .strict();
export type ReadingConfig = z.infer<typeof readingConfigSchema>;

// One field, whatever the unit. The config says what the number means, so the
// evidence does not have to carry two of them.
export const readingEvidenceSchema = z
  .object({ amount: z.number().int().min(0).max(5000) })
  .strict();
export type ReadingEvidence = z.infer<typeof readingEvidenceSchema>;

export const readingActivity: ActivityType<ReadingConfig, ReadingEvidence> = {
  key: "reading",
  name: "Reading",
  description: "Minutes or pages, your choice",
  icon: "reading",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { unit: "minutes", target: 30 },
  },

  configSchema: readingConfigSchema,
  evidenceSchema: readingEvidenceSchema,

  evidence: { level: "optional", source: "live" },
  checkin: { kind: "number" },
  chart: "numeric",
  fields: [
    {
      kind: "segmented",
      key: "unit",
      label: "Measure",
      options: [
        { value: "minutes", label: "Minutes" },
        { value: "pages", label: "Pages" },
      ],
    },
    { kind: "number", key: "target", label: "Target a day", min: 1, max: 5000 },
  ],

  steps() {
    return [{ key: READING_STEP, label: "Reading", open: "00:00", close: "23:59" }];
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(READING_STEP, "Reading", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const sessions = input.checkins.filter((c) => c.step === READING_STEP);
    // Sittings add up, in either unit: twenty pages then ten is thirty.
    const amount = sumField(sessions, "amount");
    const result = thresholdPass(amount, {
      direction: "atLeast",
      target: input.config.target,
    });
    return {
      passed: result.passed,
      detail: { amount, target: input.config.target, unit: input.config.unit },
    };
  },
};
