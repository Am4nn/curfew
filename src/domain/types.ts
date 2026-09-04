import type { ZodType } from "zod";
import type { DayBoundary, Schedule } from "./schedule";

// One check-in the UI can render for a period. open/close are wall-clock
// "HH:mm" in the user's timezone.
//
// A step carries its own words and its own fields (decision 90). The check-in
// screen is drawn once for all twelve types, so every sentence on it that is
// specific to a type has to come from the type: the engine cannot write
// "Nothing after 8:00 PM last night" without knowing what nightfast is.
export interface CheckinStep {
  key: string;
  label: string;
  open: string;
  close: string;
  /**
   * Whether this step can be checked in more than once a period. Water's glass
   * repeats, Office's arrival does not. A second check-in against a step that
   * does not repeat is refused.
   */
  repeats?: boolean;
  /** The numbers this check-in carries, drawn with the configure screen's controls. */
  fields?: ConfigField[];
  /** The question a `declare` step asks. */
  prompt?: string;
  /** The small grey line under the prompt. */
  aside?: string;
  /** What answering costs, stated as a fact at the foot of the screen. */
  consequence?: string;
}

// A step's window resolved to absolute instants for a specific period. Drives
// both "which window is open now" on the check-in page and the server-side
// validation of a POST. The engine gets these without knowing what the steps
// mean.
export interface CheckinWindow {
  step: string;
  label: string;
  opensAt: Date;
  closesAt: Date;
}

// One recorded check-in the engine hands to a module for evaluation. `at` is
// the server-stamped instant the check-in happened; `step` is the namespaced
// step it satisfied; `evidence` is the module's own payload.
export interface Checkin<Evidence> {
  step: string;
  at: Date;
  evidence?: Evidence;
}

export interface EvaluateInput<Config, Evidence> {
  // The period's start as "yyyy-MM-dd", already resolved in `timezone`.
  periodStart: string;
  timezone: string;
  config: Config;
  checkins: Checkin<Evidence>[];
}

/** One thing wrong, against the config path that is wrong. */
export interface FieldIssue {
  path: string;
  message: string;
}

export interface HintInput<Config, Evidence> extends EvaluateInput<Config, Evidence> {
  step: string;
  /** What is typed into the fields right now, not yet recorded. */
  pending?: Partial<Evidence> | null;
}

export interface EvaluateResult {
  passed: boolean;
  // The module's own detail. The engine stores it verbatim and never inspects
  // it (invariant 6).
  detail: Record<string, unknown>;
}

// Whether a photo is off, optional or required, and where it may come from,
// belongs to the TYPE and not the user (decision 6). Two people's Food streak
// therefore mean the same thing in the same group. `steps` narrows a
// requirement to named windows: sleep requires one on confirm and nowhere else.
export interface EvidenceRule {
  level: "none" | "optional" | "required";
  source: "live" | "gallery";
  steps?: string[];
  /**
   * The line under "Photo required" on the configure screen, in the module's
   * own words. "Gallery allowed. A shot of your watch or app counts." is a
   * sentence about steps, not about evidence in general.
   */
  detail: string;
  /**
   * What the browser compresses to (decision 97). Defaults are 1280px at
   * quality 0.75; a type whose photo carries detail worth keeping asks for
   * more. Bigger means a longer upload on a bad connection, which is the cost
   * this trades against, not storage.
   */
  maxEdge?: number;
  quality?: number;
}

// The whole UI contract for checking in. Five shapes cover twelve types
// (decision 73); a genuinely new shape extends the engine rather than living
// in a module.
export type CheckinKind = "tap" | "counter" | "number" | "camera" | "declare";

// A module names its chart and the engine draws it, the same way it draws the
// check-in affordance.
export type ChartKind = "windowed" | "numeric" | "weekly" | "binary";

/**
 * Everything the engine needs to draw a module's chart without knowing what the
 * module measures (invariant 6).
 *
 * `heading` was "LAST N PERIODS" over every numeric chart, which told a person
 * nothing about what the bars were. It is the module's own words now, and the
 * engine appends the window length to it.
 *
 * `valueField` and `targetField` were a chain of guesses in the chart component:
 * steps ?? minutes ?? amount ?? calories ?? glasses. That is the engine knowing
 * what a type means, so the module names its own fields instead. Adding a
 * thirteenth type never edits the chart again.
 */
export interface ChartSpec {
  kind: ChartKind;
  /** Shipped in caps, so write it in caps. */
  heading: string;
  /** The field of this module's `detail` carrying the plotted number. */
  valueField?: string;
  /** The field carrying the line it is measured against. */
  targetField?: string;
}

// How the engine draws a module's own settings (decision 88).
//
// configSchema says what is VALID; this says what it LOOKS LIKE. Zod cannot be
// introspected into a form without guessing, and guessing is what produces a
// configure screen that does not match its mock. A module therefore declares
// its fields, and the engine draws the same controls for every type: one
// stepper, one time range, one segmented switch, drawn once.
//
// `key` is a dot path into the config, so a nested { window: { open, close } }
// and a flat night_open both render through the same control.
export type ConfigField = ConfigFieldShape & {
  /** One line under the control, in the module's words. */
  hint?: string;
};

type ConfigFieldShape =
  | {
      kind: "number";
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      unit?: string;
      /**
       * A stepper for something you nudge, a typed box for something you know.
       * "3 a day" is a stepper; "8,000 steps" is a box.
       */
      display?: "stepper" | "input";
      /**
       * Stored units per displayed unit. Screen stores minutes and is set in
       * hours, so its limit declares 60.
       */
      scale?: number;
      // A nullable number is a target the user can switch off entirely. Study's
      // minutes and Food's calorie limit both work this way.
      nullable?: boolean;
      offLabel?: string;
    }
  | {
      kind: "timeRange";
      label: string;
      openKey: string;
      closeKey: string;
    }
  | {
      kind: "time";
      key: string;
      label: string;
    }
  | {
      kind: "segmented";
      key: string;
      label: string;
      options: { value: string; label: string }[];
    };

// What the engine owns for every activity, whatever its type (decision 79).
// The period unit is derived from the schedule, never stored beside it.
export interface ScheduleDefaults {
  schedule: Schedule;
  dayBoundary: DayBoundary;
  grace: number;
}

// The contract every activity type implements.
//
// It is a declarative envelope around one behavioural method (decision 78). The
// engine renders every screen from the declaration and calls `evaluate` to
// score a period. `evaluate` keeps the period start, timezone and step-tagged
// check-ins because sleep judges three named windows, and a window is a
// wall-clock time that only resolves against a date and a zone. Recomputing
// windows from timestamps is also what lets `bun run verify` recompute a period
// truthfully from events alone.
export interface ActivityType<Config, Evidence> {
  key: string;
  // One word, with a one-line description, used wherever a type is offered
  // (decision 36).
  name: string;
  description: string;
  icon: string;

  defaults: ScheduleDefaults & { config: Config };
  configSchema: ZodType<Config>;
  evidenceSchema: ZodType<Evidence>;

  evidence: EvidenceRule;
  checkin: { kind: CheckinKind };
  chart: ChartSpec;
  /**
   * How the configure screen draws this module's own settings.
   *
   * A function of the config, because Reading's target is labelled in the unit
   * the user picked one control above it.
   */
  fields(config: Config): ConfigField[];
  /** Properties of the type, stated at the top and never offered as controls. */
  facts?: { title: string; sub: string }[];
  /** The module's own footnote, above the stop control. */
  note?: string;
  /**
   * Anything the schema cannot express, as field paths. Sleep's windows may not
   * overlap, and no Zod object can say that about three sibling pairs.
   */
  validate?(config: Config): FieldIssue[];

  steps(config: Config, periodStart: string): CheckinStep[];
  /**
   * One line under a step's fields, in the module's own words (decision 90).
   *
   * The engine prints it verbatim and never composes it, because "1180 so far
   * today. The limit is 2000." is a sentence only the module can write.
   * `pending` is what the user has typed and not sent, which is what turns that
   * line into "1700 of 2000 once this is sent."
   */
  hint?(input: HintInput<Config, Evidence>): string | null;
  /**
   * Whether another press of this step would count for anything right now.
   * Defaults to true, so most types never implement it.
   *
   * Gym does. It counts at most one session a calendar day, so once today's
   * session is recorded a second press is deliberately ignored by `evaluate`.
   * Without this the engine had no way to know that, and Home went on offering
   * a Check in button whose press could not change the result. A control that
   * does nothing is worse than no control.
   *
   * The engine uses it to hide the affordance and to refuse the press. It
   * never infers WHY, only whether (invariant 6).
   */
  countsNow?(input: HintInput<Config, Evidence>): boolean;
  // Resolve every step's window to absolute instants for the given period.
  windows(config: Config, periodStart: string, timezone: string): CheckinWindow[];
  evaluate(input: EvaluateInput<Config, Evidence>): EvaluateResult;
}
