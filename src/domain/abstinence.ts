import { z } from "zod";
import type {
  ActivityType,
  Category,
  DeclareAnswers,
  EvaluateInput,
} from "./types";
import { DEFAULT_ANSWERS } from "./types";
import { EVERY_DAY } from "./schedule";
import {
  windowSchema,
  oneWindow,
  windowInstants,
  within,
  HHMM,
  clockLabel,
  type Window,
} from "./windows";

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
//
// v4 adds five more through it (3.1), and two of them are not abstinences at
// all: Cold shower and Morning sunlight are things you DO, with the same shape.
// That is what `answers` is for. "It held" is right for a condition you kept
// and wrong for sunlight you either got out in or did not, and the module is
// where a type's own words belong.

export const DECLARE_STEP = "declare";

const DEFAULT_SAID = { yes: "You said it held.", no: "You said you slipped." };

// The window is when you CONFIRM. The cut-off is the time the abstinence
// starts, which only some of these types have: nightfast has a "nothing after"
// time, sugar-free is simply the whole day.
const abstinenceConfigSchema = z
  .object({ window: windowSchema, cutoff: HHMM.nullable() })
  .strict();
export type AbstinenceConfig = z.infer<typeof abstinenceConfigSchema>;

// The whole payload: did it hold. There is nothing else to record.
const abstinenceEvidenceSchema = z.object({ held: z.boolean() }).strict();
export type AbstinenceEvidence = z.infer<typeof abstinenceEvidenceSchema>;

export function abstinenceActivity(spec: {
  key: string;
  name: string;
  description: string;
  icon: string;
  label: string;
  /** 1.16. Left off only by a condition somebody wrote themselves. */
  category?: Category;
  /** The two buttons, first person. Defaults to "It held" and "I slipped". */
  answers?: DeclareAnswers;
  /**
   * The same two answers reported back under the row, second person.
   *
   * A separate pair rather than a transformation of `answers`, because there
   * is no transformation: "I slipped" is not "you slipped" by any rule a
   * function can apply, and lowercasing it gives "you said i slipped".
   */
  said?: { yes: string; no: string };
  window: Window;
  /** The "nothing after" time, when the type has one. */
  cutoff: { label: string; default: string } | null;
  /** The question the check-in screen asks, in this type's own words. */
  prompt: (config: AbstinenceConfig) => string;
  /** The heading over this type's chart, in its own words. */
  chartHeading: string;
  /** The rule in a person's words, for the top of the configure screen. */
  rule: (config: AbstinenceConfig) => string;
  /** The line under the confirm window on the configure screen. */
  windowHint: string;
  /** The line under "No photo" on the configure screen. */
  evidenceDetail: string;
  /** The footnote above the stop control. */
  note: string;
}): ActivityType<AbstinenceConfig, AbstinenceEvidence> {
  return {
    key: spec.key,
    name: spec.name,
    description: spec.description,
    icon: spec.icon,
    category: spec.category,

    defaults: {
      schedule: EVERY_DAY,
      dayBoundary: "midnight",
      config: { window: spec.window, cutoff: spec.cutoff?.default ?? null },
    },

    configSchema: abstinenceConfigSchema,
    evidenceSchema: abstinenceEvidenceSchema,

    evidence: { level: "none", source: "live", detail: spec.evidenceDetail },
    checkin: { kind: "declare", answers: spec.answers ?? DEFAULT_ANSWERS },
    chart: { kind: "binary", heading: spec.chartHeading },

    note: spec.note,

    summary(config) {
      return `${spec.rule(config)}, confirmed between ${clockLabel(config.window.open)} and ${clockLabel(config.window.close)}`;
    },

    fields() {
      return [
        ...(spec.cutoff
          ? [{ kind: "time" as const, key: "cutoff", label: spec.cutoff.label }]
          : []),
        {
          kind: "timeRange",
          label: "Confirmed between",
          openKey: "window.open",
          closeKey: "window.close",
          hint: spec.windowHint,
        },
      ];
    },

    steps(config) {
      return [
        {
          key: DECLARE_STEP,
          label: spec.label,
          open: config.window.open,
          close: config.window.close,
          // A correction is allowed: someone who taps "It held" and then
          // corrects themselves is telling the truth the second time.
          repeats: true,
          prompt: spec.prompt(config),
          aside:
            "Nobody can check this one. The record is only worth what your answer is worth.",
          consequence:
            "A slip breaks the streak and costs your standing in any group you share this with. It costs nothing else.",
        },
      ];
    },

    // Which answer stands. Without this the row said "Logged 10:15 PM"
    // whichever way you answered, so correcting "It held" to "I slipped"
    // changed the tick and nothing else, and on a day with nothing declared
    // yet it changed nothing at all on screen. The one type whose whole record
    // is a yes or a no was the one type that never said which.
    hint(input) {
      const window = windowInstants(input.periodStart, input.timezone, input.config.window);
      const declared = input.checkins
        .filter((c) => c.step === DECLARE_STEP && within(c.at, window))
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .at(-1);
      if (!declared) return null;
      const said = spec.said ?? DEFAULT_SAID;
      return declared.evidence?.held === true
        ? said.yes
        : `${said.no} Today does not count.`;
    },

    remind(input) {
      const window = windowInstants(input.periodStart, input.timezone, input.config.window);
      const answered = input.checkins.some(
        (c) => c.step === DECLARE_STEP && within(c.at, window),
      );
      return answered ? null : "Not answered yet.";
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
