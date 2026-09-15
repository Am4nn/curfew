// Grace: one pool for the account, spent by hand (items 19 and 20).
//
// It used to be a per-activity allowance, set on the configure screen, spent
// automatically the moment a day was missed. Three things were wrong with that.
// Nobody chose it, so a streak was held by something the person never saw
// happen. It was a SETTING, so how forgiving the app was to you was a number you
// typed yourself. And it was per activity, so tracking more things bought more
// forgiveness for each of them.
//
// Now: two a month for each activity tracked, counted live, in one pool for the
// account, spent deliberately after a streak has already ended.
//
// FUNGIBLE, on purpose. Spend the lot on one activity if you like. Grace holds a
// STREAK and nothing else, so doing that still costs a fine and a dip in
// standing every single time, which needs no rule to discourage. A per-activity
// cap would collapse the pool straight back into the old allowance with a
// button on it.
//
// ONE GRACE PER MISSED DAY. A gym week wanting three sessions that got one is
// two days short and costs two. A streak can therefore break by more than
// somebody can afford, which is a state the screens have to answer rather than
// hide: Home shows no Restore at all on a row nobody can act on, and the grace
// screen is the one place that says what it needs against what you have.

/** Two a month, for each activity tracked. */
export const GRACE_PER_ACTIVITY = 2;

/**
 * How long an offer stays open after a streak ends.
 *
 * It closes when you next check in for that activity, which is the real rule:
 * the run either came back or it did not. These two bound that. A day at
 * minimum, so somebody who checks in the next morning still gets to see the
 * offer they would otherwise never have met. A fortnight at most, because an
 * offer to undo something that happened three weeks ago is not a decision
 * anybody is still making.
 */
const OFFER_MIN_DAYS = 1;
export const OFFER_MAX_DAYS = 14;

/**
 * The month's allowance, from what is tracked RIGHT NOW.
 *
 * Live rather than fixed at the start of the month: add a sixth activity today
 * and the pool is twelve today. The alternative is a number that lags what
 * somebody is actually doing, and a person who has just taken on more to track
 * is exactly the person about to need it.
 */
export function gracePool(activitiesTracked: number): number {
  return activitiesTracked * GRACE_PER_ACTIVITY;
}

export interface GraceBalance {
  /** The whole month's allowance. */
  pool: number;
  /** Spent so far this month. */
  spent: number;
  /** What is left to spend. */
  left: number;
}

export function graceBalance(activitiesTracked: number, spent: number): GraceBalance {
  const pool = gracePool(activitiesTracked);
  return { pool, spent, left: Math.max(0, pool - spent) };
}

/**
 * Is an offer dated `brokeOn` still open on `today`?
 *
 * `checkedInSince` is whether the activity has been checked in for since the
 * break, which is what really closes it. The two bounds do the rest.
 */
export function offerOpen(
  brokeOn: string,
  today: string,
  checkedInSince: boolean,
): boolean {
  const age = daysBetween(brokeOn, today);
  if (age > OFFER_MAX_DAYS) return false;
  if (age < OFFER_MIN_DAYS) return true;
  return !checkedInSince;
}

/** Whole days from one "yyyy-MM-dd" to another. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(...split(from));
  const b = Date.UTC(...split(to));
  return Math.round((b - a) / 86_400_000);
}

function split(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m - 1, d];
}

/** The first day of the month after this one, for "Resets 1 October". */
export function resetsOn(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
