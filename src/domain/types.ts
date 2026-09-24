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
  /**
   * Set when a repeating step still takes at most one press a CALENDAR DAY.
   *
   * `repeats` is about the period, and for a weekly type the two are not the
   * same question. Gym's session repeats, because a week of three is not done
   * after the first, and it is also once a day, because the second session on a
   * Tuesday counts for nothing. Only the module knows that (invariant 6), so it
   * says so here rather than the engine inferring it.
   *
   * What reads it: the minimum gap between logs. Spacing presses that can only
   * be a day apart is a control that cannot change anything, whatever it is set
   * to, and the configure screen does not offer it.
   */
  oncePerDay?: boolean;
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
  /**
   * Set while this window is anchored to another press that has not happened.
   *
   * Every window in the app until v3.2 was a clock time in config. Sleep's
   * confirm is not: it opens half an hour after the WAKE press and stays open
   * half an hour, because a confirm you can place yourself is a confirm you can
   * place at an hour you are already up.
   *
   * While this is set, `opensAt` and `closesAt` are the WIDEST the window could
   * turn out to be, so anything asking "is this period over yet" waits long
   * enough whatever happens. Nothing may be recorded against it, and the engine
   * shows `message` where it would otherwise show the times.
   */
  waitingOn?: { step: string; message: string };
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
  /**
   * The schedule this period was produced by, resolved as it stood on the
   * period being judged (invariant 5).
   *
   * Here because "how often" is an engine concept every type can use, and Gym
   * was carrying its own copy of it: the schedule said `perWeek` and the gym
   * config said `sessionsPerWeek`, one number written twice from one control.
   * The configure screen cannot draw one "how often" row while two exist, and
   * nothing stopped them disagreeing. The module still decides whether the
   * week passed, so the engine learns nothing about what a session is
   * (invariant 6).
   */
  schedule: Schedule;
  checkins: Checkin<Evidence>[];
}

/** One thing wrong, against the config path that is wrong. */
export interface FieldIssue {
  path: string;
  message: string;
}

interface HintInput<Config, Evidence> extends EvaluateInput<Config, Evidence> {
  step: string;
  /** What is typed into the fields right now, not yet recorded. */
  pending?: Partial<Evidence> | null;
}

interface EvaluateResult {
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

/**
 * What kind of thing a type is about, for Monk mode's four requirements (1.16).
 *
 * It is a field on the module and NOT a column on `activity_types`: that table
 * is append-only admin-toggle history with no unique constraint on `type_key`,
 * so a per-type attribute stored there would have as many answers as the admin
 * has switched it. The module is the one place a type is defined once.
 *
 * A condition somebody writes themselves has NO category (1.19). Nothing can
 * know whether "no doomscroll" is a MIND thing, and Monk mode's requirements
 * exist so the number means the same for everybody.
 */
export type Category = "body" | "food" | "mind" | "sleep";

/**
 * Which number this activity carries, EVERYWHERE it appears (1.49).
 *
 * Home, the group hub, the activity screen, Stats and the stop-cost screen all
 * ask the activity and render the answer. No surface branches on a type key or
 * on a category, which is invariant 6 applied to a number rather than to a
 * verdict.
 *
 * `"streak"` for an abstinence, where a consecutive count IS the achievement:
 * one lapse genuinely restarts something, and "47 days no alcohol" is the
 * thing somebody is proud of.
 *
 * `"consistency"` for anything you DO, where a consecutive count is an
 * artifact: four sessions a week for a year is a stronger habit than twelve
 * days of a daily run, and a streak ranks the second higher.
 *
 * Repair, grey and the Restore screen follow this and need no rule of their
 * own: all three are properties OF a streak, so they exist wherever one does
 * (1.50).
 */
export type Measure = "consistency" | "streak";

/**
 * The two answers a `declare` type offers, in its own words.
 *
 * The engine draws them and never reads what they say, so invariant 6 holds.
 * It defaults to "It held" and "I slipped", which is right for an abstinence
 * and wrong for Morning sunlight: you did not hold sunlight, you either got
 * out in it or you did not.
 */
export type DeclareAnswers = { yes: string; no: string };

export const DEFAULT_ANSWERS: DeclareAnswers = { yes: "It held", no: "I slipped" };

// A module names its chart and the engine draws it, the same way it draws the
// check-in affordance.
type ChartKind = "windowed" | "numeric" | "weekly" | "binary";

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
    }
  | {
      /**
       * A row that states something and offers no control.
       *
       * Not a `fact`: those sit at the top and describe the type. This one sits
       * in the list of settings, in its place, because a person scanning for
       * the confirm window looks where the confirm window would be and has to
       * find out there that it is not theirs to set.
       */
      kind: "fixed";
      label: string;
      value: string;
      /** Why it is not a setting. */
      note: string;
    };

// What the engine owns for every activity, whatever its type (decision 79).
// The period unit is derived from the schedule, never stored beside it.
interface ScheduleDefaults {
  schedule: Schedule;
  dayBoundary: DayBoundary;
  /**
   * Minutes between two presses of a repeating step, as this type's default.
   *
   * The FIELD is engine-owned and means the same everywhere (see
   * `schedule.ts`); only the number belongs to the module, because how long is
   * plausible between two of a thing is the one part of it that depends on what
   * the thing is. Eight glasses in eight seconds is a record of a day nobody
   * had, and zero was the default that allowed it.
   *
   * Omitted is 0, which is right for every type whose steps do not repeat.
   */
  minGap?: number;
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
  checkin: { kind: CheckinKind; answers?: DeclareAnswers };
  /** 1.16. Undefined on a condition somebody wrote themselves. */
  category?: Category;
  /** 1.49. The one number this activity carries, on every surface. */
  measure: Measure;
  /**
   * The same thing when it depends on the CONFIG rather than the module.
   *
   * Only a written condition uses it: one module stands behind all of them
   * (1.19) and C7 asks whether each is something you do or something you
   * avoid, which is exactly the question `measure` answers for the other
   * seventeen. Same shape as `displayName` and `answersFor`.
   */
  measureFor?(config: Config): Measure;
  /**
   * What to CALL this activity on screen, when `name` is not it.
   *
   * One module stands behind every condition somebody writes themselves
   * (1.19), so its `name` is the same string for all of them. This is how the
   * one that is being drawn says which it is.
   *
   * Symmetric with `summary(config)`, and read the same way: the engine
   * renders the string and never inspects it, so invariant 6 holds.
   */
  displayName?(config: Config): string;
  /**
   * The two declare answers, when they depend on the CONFIG rather than the
   * module. Same shape and same reason as `displayName`.
   *
   * A written condition is the only user of it: C7 asks whether it is
   * something you do or something you avoid, and "It held" is as wrong for
   * the first as it was for Morning sunlight.
   */
  answersFor?(config: Config): DeclareAnswers;
  chart: ChartSpec;
  /**
   * How the configure screen draws this module's own settings.
   *
   * A function of the config, because Reading's target is labelled in the unit
   * the user picked one control above it.
   */
  fields(config: Config): ConfigField[];
  /**
   * The rule this module enforces, as a sentence a person would say.
   *
   * "3 meals a day, under 2,000 calories." "In bed by 10:30 PM, up by
   * 6:30 AM." The configure screen states the rule before it offers to change
   * any of it, so somebody reads what they have set instead of reconstructing
   * it from six controls.
   *
   * ONLY the module's own half. How often, when the day starts and how many
   * misses are forgiven are the engine's, written once by the engine in one
   * voice, because they read the same for all twelve types and a module
   * writing them again would be twelve chances to word it differently.
   *
   * No leading capital and no full stop: the engine joins these into a
   * sentence and punctuates it.
   */
  summary(config: Config): string;
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
   * What is LEFT, for a notification. The same sentence `hint` is, written for
   * a different reader.
   *
   * `hint` sits under a step's fields, on a card with the activity's name above
   * it and the whole configure screen around it, so it describes what has been
   * recorded and never names its own subject. On a lock screen neither of those
   * holds: there is no name above it unless the notification supplies one, and
   * the reader has about three words of patience. `hint`'s own words prove it.
   * Study returns "Target is 45. Anything at or above counts." before anything
   * is recorded, which is the right line under a control and useless on a
   * phone at 8 PM.
   *
   * So this one counts DOWN rather than up, because a notification exists to
   * ask for something: "45 minutes to go", not "0 of 45 today". It is the only
   * sentence in a notification allowed to describe progress (invariant 6), and
   * the reason the copy may not: a bank that could write its own progress line
   * wrote "Almost there" over eight untouched glasses of water, in production.
   *
   * Null when there is nothing left to ask for, which is how the engine learns
   * that a notification about this activity would be pointless. `pending` is
   * never set here: nothing is half-typed on a lock screen.
   */
  remind?(input: HintInput<Config, Evidence>): string | null;
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
  /**
   * Resolve every step's window to absolute instants for the given period.
   *
   * `checkins` is what has been recorded in this period so far, and is only
   * needed by a window anchored to another press: sleep's confirm opens half an
   * hour after the wake press. Callers that do not have them may omit them, and
   * an anchored window then comes back marked `waitingOn` at its widest, which
   * is the safe answer for "has this period finished".
   */
  windows(
    config: Config,
    periodStart: string,
    timezone: string,
    checkins?: Checkin<Evidence>[],
  ): CheckinWindow[];
  /**
   * When this type is worth a reminder, as "HH:mm" wall clock in the member's
   * zone. Omit it and the engine reminds before the window closes instead.
   *
   * It exists because eight of the twelve have an all-day window, whose real
   * close is midnight, and "you have not eaten today" at 11:50 PM is a message
   * about a day that is already lost. Food wants breakfast, lunch and dinner,
   * and only Food knows when those are.
   *
   * Declared and not computed, like every other fact a module states about
   * itself, so the engine reads three strings and never learns that one of them
   * is lunch (invariant 6). A member may override them per activity, and their
   * rows win.
   *
   * These are a DEFAULT and never a judgement. Nothing here decides whether a
   * period passed, so unlike every window and threshold in this file it is not
   * resolved as of the period being scored, and changing it rewrites nothing.
   */
  reminderCues?: string[];
  evaluate(input: EvaluateInput<Config, Evidence>): EvaluateResult;
  /**
   * The calendar days in this period that count toward a streak.
   *
   * A streak counts DAYS you did the thing, and for eleven of the twelve types
   * a period IS a day, so the answer is "this day, if it passed" and the engine
   * works that out from `evaluate`. Gym is the exception: its period is a week,
   * its streak adds a day per session (decision 77), and only the module knows
   * that two presses on a Tuesday are one day at the gym.
   *
   * So the module answers, and the engine never guesses (invariant 6). It was
   * guessing before, by handing the streak one row per PERIOD, which arrived as
   * a single Monday, fell below its own weekly minimum, and reported three
   * passed gym weeks as a streak of 1.
   *
   * Return days in any order; the caller sorts. Days outside the period are
   * ignored.
   */
  daysDone?(input: EvaluateInput<Config, Evidence>): string[];
}
