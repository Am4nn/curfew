// Split a fine equally among recipients, in integer minor units. Shares must
// sum EXACTLY to the fine (invariant 7): distribute the remainder one minor
// unit at a time, recipients ordered by id, so 5000 across three is
// 1667/1667/1666 and never 1666x3 with a unit lost.
//
// No currency exponent appears here: the split works in whatever minor unit the
// caller passes. The exponent comes from the currency at display time, never a
// hardcoded /100.

export interface Share {
  toUserId: string;
  amount: number;
}

export function splitFine(amount: number, recipientIds: string[]): Share[] {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(
      `splitFine: amount must be a positive integer in minor units (got ${amount})`,
    );
  }
  const n = recipientIds.length;
  if (n === 0) throw new Error("splitFine: no recipients");
  if (new Set(recipientIds).size !== n) {
    throw new Error("splitFine: duplicate recipient ids");
  }

  const ids = [...recipientIds].sort();
  const base = Math.floor(amount / n);
  let remainder = amount - base * n; // 0 <= remainder < n

  return ids.map((id) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { toUserId: id, amount: base + extra };
  });
}
