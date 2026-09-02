import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { thresholdPass, latestField } from "../pass";

// Steps. The one type where a gallery upload is the sensible default, because
// the number lives in another app and a live photo of your own screen is
// theatre.
//
// The value is the LATEST reading, not a sum: a phone reports a running total,
// so adding two readings would double-count the morning.

export const STEPS_STEP = "count";

export const stepsConfigSchema = z
  .object({ target: z.number().int().min(100).max(100000) })
  .strict();
export type StepsConfig = z.infer<typeof stepsConfigSchema>;

export const stepsEvidenceSchema = z
  .object({ steps: z.number().int().min(0).max(200000) })
  .strict();
export type StepsEvidence = z.infer<typeof stepsEvidenceSchema>;

export const stepsActivity: ActivityType<StepsConfig, StepsEvidence> = {
  key: "steps",
  name: "Steps",
  description: "The number your phone says",
  icon: "steps",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { target: 8000 },
  },

  configSchema: stepsConfigSchema,
  evidenceSchema: stepsEvidenceSchema,

  evidence: { level: "optional", source: "gallery" },
  checkin: { kind: "number" },
  chart: "numeric",
  fields: [
    { kind: "number", key: "target", label: "Steps a day", min: 1000, max: 100000, step: 500 },
  ],

  steps() {
    return [
      {
        key: STEPS_STEP,
        label: "Steps",
        open: "00:00",
        close: "23:59",
        // A later reading corrects an earlier one; the latest is what counts.
        repeats: true,
        fields: [
          {
            kind: "number",
            key: "steps",
            label: "Steps today",
            min: 0,
            max: 200000,
            step: 100,
            unit: "steps",
          },
        ],
      },
    ];
  },

  hint(input) {
    const target = input.config.target.toLocaleString("en-US");
    const latest = latestField(
      input.checkins.filter((c) => c.step === STEPS_STEP),
      "steps",
    );
    if (latest === undefined) return `Target is ${target}. Anything at or above counts.`;
    return `${latest.toLocaleString("en-US")} recorded so far. The target is ${target}.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(STEPS_STEP, "Steps", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const readings = input.checkins.filter((c) => c.step === STEPS_STEP);
    const value = latestField(readings, "steps") ?? 0;
    const result = thresholdPass(value, {
      direction: "atLeast",
      target: input.config.target,
    });
    return {
      passed: result.passed,
      detail: { steps: value, target: input.config.target },
    };
  },
};
