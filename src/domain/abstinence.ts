import { z } from "zod";
import type { ActivityType, EvaluateInput } from "./types";
import { EVERY_DAY } from "./schedule";
import { windowSchema, oneWindow, windowInstants, within, type Window } from "./windows";

// Abstinence types pass by NOT doing something, which inverts the whole engine:
// every other type treats silence as failure, and abstinence would treat it as
// success (decision 50).
//
// Left as pure honesty the app would reward deleting it and coming back to a
// 90-day streak, which is precisely what invariant 2 exists to prevent. So you
// still check in once a day, and the two answers are "It held" or "I slipped".
// Silence is a miss like anywhere else.
//
// Evidence is always none (decision 51). A photo cannot prove absence, and the
// UI says so rather than pretending otherwise.
//
// Nightfast and Sugar-free differ only in their words and their window, so they
// share this factory. A third abstinence type is one call, not another file of
// copied logic.

export const DECLARE_STEP = "declare";

export const abstinenceConfigSchema = z.object({ window: windowSchema }).strict();
export type AbstinenceConfig = z.infer<typeof abstinenceConfigSchema>;

// The whole payload: did it hold. There is nothing else to record.
export const abstinenceEvidenceSchema = z.object({ held: z.boolean() }).strict();
export type AbstinenceEvidence = z.infer<typeof abstinenceEvidenceSchema>;

export function abstinenceActivity(spec: {
  key: string;
  name: string;
  description: string;
  icon: string;
  label: string;
  window: Window;
}): ActivityType<AbstinenceConfig, AbstinenceEvidence> {
  return {
    key: spec.key,
    name: spec.name,
    description: spec.description,
    icon: spec.icon,

    defaults: {
      schedule: EVERY_DAY,
      dayBoundary: "midnight",
      grace: 2,
      config: { window: spec.window },
    },

    configSchema: abstinenceConfigSchema,
    evidenceSchema: abstinenceEvidenceSchema,

    evidence: { level: "none", source: "live" },
    checkin: { kind: "declare" },
    chart: "binary",
    fields: [
      {
        kind: "timeRange",
        label: "Confirm between",
        openKey: "window.open",
        closeKey: "window.close",
      },
    ],

    steps(config) {
      return [
        {
          key: DECLARE_STEP,
          label: spec.label,
          open: config.window.open,
          close: config.window.close,
        },
      ];
    },

    windows(config, periodStart, timezone) {
      return oneWindow(DECLARE_STEP, spec.label, periodStart, timezone, config.window);
    },

    evaluate(input: EvaluateInput<AbstinenceConfig, AbstinenceEvidence>) {
      const window = windowInstants(input.periodStart, input.timezone, input.config.window);
      const declarations = input.checkins.filter(
        (c) => c.step === DECLARE_STEP && within(c.at, window),
      );

      // The last word wins. Someone who taps "It held" and then corrects
      // themselves to "I slipped" is telling the truth the second time, and the
      // app should take it.
      const latest = [...declarations].sort((a, b) => a.at.getTime() - b.at.getTime()).at(-1);

      return {
        passed: latest?.evidence?.held === true,
        detail: {
          declared: latest !== undefined,
          held: latest?.evidence?.held ?? null,
        },
      };
    },
  };
}
