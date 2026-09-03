import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { thresholdPass, latestField } from "../pass";

// Screen. The threshold runs the other way (decision 52): you pass at or BELOW
// the limit. Same field, opposite comparison, which is why direction is data
// rather than two code paths.
//
// Like Steps, the value is the latest reading rather than a sum, because a
// phone reports a running total for the day.

export const SCREEN_STEP = "reading";

// Stored in minutes, set in hours: the artboard's control reads "3 hours" and
// the field declares the scale between them.
export const screenConfigSchema = z
  .object({
    limitMinutes: z.number().int().min(1).max(1440),
    direction: z.enum(["atLeast", "atMost"]),
  })
  .strict();
export type ScreenConfig = z.infer<typeof screenConfigSchema>;

export const screenEvidenceSchema = z
  .object({ minutes: z.number().int().min(0).max(1440) })
  .strict();
export type ScreenEvidence = z.infer<typeof screenEvidenceSchema>;

export const screenActivity: ActivityType<ScreenConfig, ScreenEvidence> = {
  key: "screen",
  name: "Screen",
  description: "Time on the phone, under your limit",
  icon: "screen",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { limitMinutes: 120, direction: "atMost" },
  },

  configSchema: screenConfigSchema,
  evidenceSchema: screenEvidenceSchema,

  evidence: {
    level: "optional",
    source: "gallery",
    detail: "Gallery allowed. A screenshot of your phone's own report.",
  },
  checkin: { kind: "number" },
  chart: "numeric",

  note: "Curfew cannot read your screen time. The number is yours to enter.",

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
        key: "limitMinutes",
        label: "Limit",
        min: 1,
        max: 24,
        unit: "hours",
        display: "input",
        scale: 60,
      },
    ];
  },

  steps() {
    return [
      {
        key: SCREEN_STEP,
        label: "Screen time",
        open: "00:00",
        close: "23:59",
        repeats: true,
        fields: [
          {
            kind: "number",
            key: "minutes",
            label: "Minutes on the phone",
            min: 0,
            max: 1440,
            unit: "min",
          },
        ],
      },
    ];
  },

  hint(input) {
    const limit = input.config.limitMinutes;
    const latest = latestField(
      input.checkins.filter((c) => c.step === SCREEN_STEP),
      "minutes",
    );
    if (latest === undefined) {
      const direction =
        input.config.direction === "atMost" ? "at or below" : "at or above";
      return `The limit is ${limit} min. Anything ${direction} counts.`;
    }
    return `${latest} min recorded. The limit is ${limit}.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(SCREEN_STEP, "Screen time", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const readings = input.checkins.filter((c) => c.step === SCREEN_STEP);
    const value = latestField(readings, "minutes");

    // Silence is a miss, as everywhere else (invariant 2). Without a reading
    // there is nothing under the limit, so an unreported day cannot pass.
    if (value === undefined) {
      return { passed: false, detail: { minutes: null, limit: input.config.limitMinutes } };
    }

    const result = thresholdPass(value, {
      direction: input.config.direction,
      target: input.config.limitMinutes,
    });
    return {
      passed: result.passed,
      detail: { minutes: value, limit: input.config.limitMinutes },
    };
  },
};
