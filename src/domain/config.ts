// Effective-dated config resolution, as a pure pick over rows already fetched.
// The DB query stays in the query layer; this decides which of the candidate
// rows was in force on a period. It mirrors the SQL in schema.sql:
//
//   ... WHERE (scope = $id OR scope IS NULL) AND effective_from <= $periodStart
//   ORDER BY scope NULLS LAST, effective_from DESC LIMIT 1
//
// so a scope-specific row (non-null) always beats the default (null), and among
// rows of the same specificity the latest effective_from that is still <= the
// period wins. Resolving as of the period, never as of now, is invariant 5: a
// future rule change must not rewrite a past period.

export interface EffectiveRow {
  // The scope owner: a user_id or activity_id, or null for the default row.
  scopeId: string | null;
  // "yyyy-MM-dd". Compared lexically, which is correct for that format.
  effectiveFrom: string;
}

export function resolveConfig<T extends EffectiveRow>(
  rows: T[],
  periodStart: string,
): T | null {
  const applicable = rows.filter((r) => r.effectiveFrom <= periodStart);
  if (applicable.length === 0) return null;

  applicable.sort((a, b) => {
    const aDefault = a.scopeId === null;
    const bDefault = b.scopeId === null;
    if (aDefault !== bDefault) return aDefault ? 1 : -1; // specific first
    if (a.effectiveFrom !== b.effectiveFrom) {
      return a.effectiveFrom < b.effectiveFrom ? 1 : -1; // latest first
    }
    return 0;
  });

  return applicable[0];
}

// ---------------------------------------------------------------------------
// Operational state, resolved as of an INSTANT rather than a period date.
//
// Scoring config (a user's windows, a group's fines) is future-dated and
// resolved by date: resolveConfig above, invariant 4. App and group settings
// are operational, take effect immediately, and are resolved by instant
// (decision 65). Both are append-only, so history stays intact either way.
//
// The rule that makes "immediate" workable: a period is judged against the
// settings as they stood WHEN THE PERIOD CLOSED. One lookup at scoring time, no
// partial periods, no arithmetic about fractions of a day.

export interface EffectiveAtRow {
  effectiveAt: Date;
  // Tie-break for two rows written in the same transaction. Higher wins.
  id: number;
}

export function resolveAt<T extends EffectiveAtRow>(
  rows: T[],
  instant: Date,
): T | null {
  const at = instant.getTime();
  let best: T | null = null;
  for (const row of rows) {
    if (row.effectiveAt.getTime() > at) continue;
    if (
      best === null ||
      row.effectiveAt.getTime() > best.effectiveAt.getTime() ||
      (row.effectiveAt.getTime() === best.effectiveAt.getTime() && row.id > best.id)
    ) {
      best = row;
    }
  }
  return best;
}

// Money resolves in a fixed order (decision 66):
//
//   1. app-wide sets the default
//   2. a per-group override set by an admin wins for that group
//   3. the group owner's own toggle decides within what the first two allow
//
// An owner can never turn money on where an admin has it off. That asymmetry is
// the whole point of the order, so it is a single expression rather than a
// chain of ifs that could be reordered by accident.
export function resolveMoney(input: {
  appWide: boolean;
  groupOverride?: boolean | null;
  ownerToggle: boolean;
}): boolean {
  const allowed = input.groupOverride ?? input.appWide;
  return allowed && input.ownerToggle;
}
