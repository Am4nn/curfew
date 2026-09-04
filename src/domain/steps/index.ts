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

// Direction is a setting, not a constant: it was always data rather than two
// code paths (decision 52), and someone cutting down can say so.
export const stepsConfigSchema = z
  .object({
    target: z.number().int().min(100).max(100000),
    direction: z.enum(["atLeast", "atMost"]),
  })
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
    config: { target: 8000, direction: "atLeast" },
  },

  configSchema: stepsConfigSchema,
  evidenceSchema: stepsEvidenceSchema,

  evidence: {
    level: "optional",
    source: "gallery",
    detail: "Gallery allowed. A shot of your watch or app counts.",
  },
  checkin: { kind: "number" },
  chart: {
    kind: "numeric",
    heading: "STEPS A DAY",
    valueField: "steps",
    targetField: "target",
  },

  note: "Curfew cannot read your watch. The number is yours to enter.",

  fields() {
    return [
      {
        kind: "segmented",
        key: "direction",
        label: "Rule",
        options: [
          { value: "atLeast", label: "At or above" },
          { value: "atMost", label: "At or below" },
        ],
      },
      {
        kind: "number",
        key: "target",
        label: "Target",
        min: 1000,
        max: 100000,
        step: 500,
        unit: "steps",
        display: "input",
      },
    ];
  },

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
    const direction =
      input.config.direction === "atLeast" ? "at or above" : "at or below";
    const latest = latestField(
      input.checkins.filter((c) => c.step === STEPS_STEP),
      "steps",
    );
    if (latest === undefined) return `Target is ${target}. Anything ${direction} counts.`;
    return `${latest.toLocaleString("en-US")} recorded so far. The target is ${target}.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(STEPS_STEP, "Steps", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const readings = input.checkins.filter((c) => c.step === STEPS_STEP);
    const value = latestField(readings, "steps");

    // Silence is a miss (invariant 2). Nothing reported is not "under the
    // target", or an at-or-below rule would reward deleting the app.
    if (value === undefined) {
      return { passed: false, detail: { steps: null, target: input.config.target } };
    }

    const result = thresholdPass(value, {
      direction: input.config.direction,
      target: input.config.target,
    });
    return {
      passed: result.passed,
      detail: { steps: value, target: input.config.target },
    };
  },
};
