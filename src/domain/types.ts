import type { ZodType } from "zod";

export type Period = "day" | "week" | "month";

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
// step it satisfied; `evidence` is the module's own payload (empty for sleep).
export interface Checkin<Evidence> {
  step: string;
  at: Date;
  evidence?: Evidence;
}

export interface EvaluateInput<Config, Evidence> {
  // The period's sleep_date as "yyyy-MM-dd", already resolved in `timezone`.
  periodStart: string;
  timezone: string;
  config: Config;
  checkins: Checkin<Evidence>[];
}

export interface EvaluateResult {
  passed: boolean;
  // The module's own detail. The engine stores it verbatim and never inspects
  // it (invariant 6). For sleep: { night_ok, wake_ok, confirm_ok }.
  detail: Record<string, unknown>;
}

// The contract every activity type implements. This refines the sketch in
// PRD 6 in two deliberate ways, both noted where they occur:
//   - evaluate takes the sleep_date as a string plus the timezone, not a Date
//     pair. A period is a date, and the windows are wall-clock, so a bare
//     instant would force every caller to reconstruct the zone.
//   - evaluate receives Checkin[] (step + timestamp + evidence), not the raw
//     Evidence[] the PRD lists. Sleep's evidence is empty, so without the step
//     and timestamp there is nothing to score. Recomputing windows from the
//     timestamps is what lets /verify recompute truthfully from events.
export interface ActivityType<Config, Evidence> {
  key: string;
  period: Period;
  userConfigSchema: ZodType<Config>;
  evidenceSchema: ZodType<Evidence>;
  steps(config: Config, periodStart: string): CheckinStep[];
  // Resolve every step's window to absolute instants for the given period.
  windows(config: Config, periodStart: string, timezone: string): CheckinWindow[];
  evaluate(input: EvaluateInput<Config, Evidence>): EvaluateResult;
}
