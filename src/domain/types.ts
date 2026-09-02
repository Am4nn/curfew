import type { ZodType } from "zod";
import type { DayBoundary, Schedule } from "./schedule";

// One check-in the UI can render for a period. open/close are wall-clock
// "HH:mm" in the user's timezone.
export interface CheckinStep {
  key: string;
  label: string;
  open: string;
  close: string;
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
}

// The whole UI contract for checking in. Five shapes cover twelve types
// (decision 73); a genuinely new shape extends the engine rather than living
// in a module.
export type CheckinKind = "tap" | "counter" | "number" | "camera" | "declare";

// A module names its chart and the engine draws it, the same way it draws the
// check-in affordance.
export type ChartKind = "windowed" | "numeric" | "weekly" | "binary";

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
  chart: ChartKind;

  steps(config: Config, periodStart: string): CheckinStep[];
  // Resolve every step's window to absolute instants for the given period.
  windows(config: Config, periodStart: string, timezone: string): CheckinWindow[];
  evaluate(input: EvaluateInput<Config, Evidence>): EvaluateResult;
}
