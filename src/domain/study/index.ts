import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { countPass, thresholdPass, sumField } from "../pass";

// Study. Decision 86: the minutes target binds when one is set, and a single
// check-in passes when it is not. The "or" in ACTIVITIES.md describes two
// configurations, not two ways to pass one, or the target would be decorative.

export const STUDY_STEP = "session";

export const studyConfigSchema = z
  .object({ minutesTarget: z.number().int().min(1).max(1440).nullable() })
  .strict();
export type StudyConfig = z.infer<typeof studyConfigSchema>;

export const studyEvidenceSchema = z
  .object({ minutes: z.number().int().min(0).max(1440) })
  .strict();
export type StudyEvidence = z.infer<typeof studyEvidenceSchema>;

export const studyActivity: ActivityType<StudyConfig, StudyEvidence> = {
  key: "study",
  name: "Study",
  description: "Time at the desk, with proof",
  icon: "study",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { minutesTarget: 60 },
  },

  configSchema: studyConfigSchema,
  evidenceSchema: studyEvidenceSchema,

  evidence: { level: "required", source: "live", detail: "Live camera." },
  checkin: { kind: "number" },
  chart: "numeric",

  fields() {
    return [
      {
        kind: "number",
        key: "minutesTarget",
        label: "Target",
        min: 5,
        max: 1440,
        step: 5,
        unit: "minutes",
      },
    ];
  },

  steps() {
    return [
      {
        key: STUDY_STEP,
        label: "Session",
        open: "00:00",
        close: "23:59",
        // Sittings add up, so the day can take several.
        repeats: true,
        fields: [
          {
            kind: "number",
            key: "minutes",
            label: "Minutes studied",
            min: 0,
            max: 1440,
            unit: "min",
          },
        ],
      },
    ];
  },

  hint(input) {
    const minutes = sumField(
      input.checkins.filter((c) => c.step === STUDY_STEP),
      "minutes",
    );
    const target = input.config.minutesTarget;
    if (target === null) return "No target set. One check-in is enough.";
    const pending = input.pending?.minutes ?? null;
    if (minutes === 0 && pending === null) {
      return `Target is ${target}. Anything at or above counts.`;
    }
    return pending === null
      ? `${minutes} of ${target} so far today.`
      : `${minutes + pending} of ${target} once this is sent.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(STUDY_STEP, "Session", periodStart, timezone, ALL_DAY);
  },

  evaluate(input) {
    const sessions = input.checkins.filter((c) => c.step === STUDY_STEP);
    // Sessions add up. Three twenty-minute sittings are an hour at the desk.
    const minutes = sumField(sessions, "minutes");
    const target = input.config.minutesTarget;

    const result =
      target === null
        ? countPass(sessions, { min: 1 })
        : thresholdPass(minutes, { direction: "atLeast", target });

    return {
      passed: result.passed,
      detail: { minutes, target, sessions: sessions.length },
    };
  },
};
