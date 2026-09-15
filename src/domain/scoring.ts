// Consequences of a sequence of periods: streak, grace, fine. Pure and
// group-scoped. The pass/fail per period comes from the activity module
// (activity_scores); this turns that chain into per-group outcomes.

export interface FineRules {
  fineMode: "flat" | "escalating";
  fineAmount: number; // minor units
  fineStep: number;
  fineCap: number | null;
}

// The fine for one failed period. Flat is the shipped config; escalating is
// built but off (PRD 10). consecutiveFailuresBefore is the run of failed
// periods immediately before this one (a passing period resets it to 0).
export function fineFor(
  rules: FineRules,
  consecutiveFailuresBefore: number,
): number {
  if (rules.fineMode === "flat") return rules.fineAmount;
  const raw = rules.fineAmount + rules.fineStep * consecutiveFailuresBefore;
  return rules.fineCap != null ? Math.min(raw, rules.fineCap) : raw;
}

// `scoreChain` was here: a second streak walk, with its own per-month grace
// allowance, carried since v1. `streakOver` has been the one that runs for two
// versions, and grace is not an automatic allowance any more at all (item 19),
// so this was a contradictory model with no caller. Deleted rather than
// updated: two answers to "did the streak hold" is one too many, and the one
// nothing called was the one to go.
