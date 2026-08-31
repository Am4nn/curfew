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
