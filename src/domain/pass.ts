import type { Checkin } from "./types";

// The two composable pass-test shapes that cover the launch catalog
// (ACTIVITIES.md). They are engine helpers a module calls from inside its own
// evaluate, not something the engine applies on a module's behalf: the module
// still decides what its numbers mean, and still owns its detail payload
// (invariant 6).
//
// They combine with AND. Food is the case that needs both: at least three
// check-ins in the day, and calories at or below the limit.

export interface CountRule {
  /** At least this many check-ins in the period. */
  min: number;
  /** When set, require at least one check-in on each of these named steps. */
  steps?: string[];
}

export interface CountResult {
  passed: boolean;
  count: number;
  /** Which of the required steps were satisfied. Empty when steps is unset. */
  missingSteps: string[];
}

export function countPass<E>(
  checkins: Checkin<E>[],
  rule: CountRule,
): CountResult {
  const seen = new Set(checkins.map((c) => c.step));
  const missingSteps = (rule.steps ?? []).filter((s) => !seen.has(s));
  return {
    passed: checkins.length >= rule.min && missingSteps.length === 0,
    count: checkins.length,
    missingSteps,
  };
}

// A threshold runs in either direction (decision 52). Steps passes at or above
// its target; Screen passes at or below its limit. Same field, opposite
// comparison, so the direction is data rather than two code paths.
export type Direction = "atLeast" | "atMost";

export interface ThresholdRule {
  direction: Direction;
  target: number;
}

export interface ThresholdResult {
  passed: boolean;
  value: number;
}

export function thresholdPass(
  value: number,
  rule: ThresholdRule,
): ThresholdResult {
  return {
    passed: rule.direction === "atLeast" ? value >= rule.target : value <= rule.target,
    value,
  };
}

/** Sum a numeric field across a period's check-ins, for counter types. */
export function sumField<E extends Record<string, unknown>>(
  checkins: Checkin<E>[],
  field: keyof E & string,
): number {
  return checkins.reduce((total, c) => {
    const raw = c.evidence?.[field];
    return total + (typeof raw === "number" && Number.isFinite(raw) ? raw : 0);
  }, 0);
}

/** The last recorded value of a numeric field, for types that overwrite. */
export function latestField<E extends Record<string, unknown>>(
  checkins: Checkin<E>[],
  field: keyof E & string,
): number | undefined {
  const withValue = checkins
    .filter((c) => typeof c.evidence?.[field] === "number")
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = withValue.at(-1);
  return last ? (last.evidence?.[field] as number) : undefined;
}
