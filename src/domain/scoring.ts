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

export interface ChainPeriod {
  periodStart: string; // "yyyy-MM-dd"
  passed: boolean;
  gracePerMonth: number;
  rules: FineRules;
}

export interface ChainOutcome {
  periodStart: string;
  passed: boolean;
  graceUsed: boolean;
  streakAfter: number;
  fineAmount: number; // 0 when passed
}

// Walk the periods in date order, carrying streak, the run of consecutive
// failures (for escalating fines), and grace spent per calendar month.
//
//   - pass: streak + 1, consecutive failures reset.
//   - miss with grace left this month: grace absorbs it. The streak HOLDS
//     (a miss is not a passing day, so it does not add, but it does not reset).
//     The fine still applies. Grace protects the chain, not the wallet.
//   - miss with no grace left: streak resets to 0. The fine applies.
//
// Grace is anchored to the period's month (date_trunc('month', period_start)),
// never to now(), or the month boundary would gift extra grace.
export function scoreChain(periods: ChainPeriod[]): ChainOutcome[] {
  const sorted = [...periods].sort((a, b) =>
    a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0,
  );

  let streak = 0;
  let consecutiveFailures = 0;
  const graceByMonth = new Map<string, number>();

  return sorted.map((p) => {
    if (p.passed) {
      streak += 1;
      consecutiveFailures = 0;
      return {
        periodStart: p.periodStart,
        passed: true,
        graceUsed: false,
        streakAfter: streak,
        fineAmount: 0,
      };
    }

    const month = p.periodStart.slice(0, 7); // "yyyy-MM"
    const used = graceByMonth.get(month) ?? 0;
    const fineAmount = fineFor(p.rules, consecutiveFailures);
    consecutiveFailures += 1;

    if (used < p.gracePerMonth) {
      graceByMonth.set(month, used + 1);
      return {
        periodStart: p.periodStart,
        passed: false,
        graceUsed: true,
        streakAfter: streak, // hold
        fineAmount,
      };
    }

    streak = 0;
    return {
      periodStart: p.periodStart,
      passed: false,
      graceUsed: false,
      streakAfter: 0,
      fineAmount,
    };
  });
}
