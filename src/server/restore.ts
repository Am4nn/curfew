import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import {
  getActivityType,
  graceBalance,
  offerOpen,
  resetsOn,
  type GraceBalance,
} from "@/domain";
import { listUserActivities } from "./activities";
import { recordEvent } from "./events";
import { userDay } from "./config";
import { allStreaks, offerFor, rebuildStreak } from "./streak";

// Spending grace: the pool, the offers, and the press (items 19 and 20).
//
// Named `restore` rather than `grace` because `server/grace.ts` already exists
// and is a different thing entirely: the days a group does not count a new
// member for. Two words for two ideas, and the one people see is this one.
//
// The pool is two a month for each activity tracked, counted LIVE, and what
// has been spent is read from `grace.spent` events. Nothing is stored: the
// events are the truth (invariant 1) and every number here is derived from
// them, so there is no counter to drift, no month rollover to run, and
// `verify` has nothing new to police.

/** "yyyy-MM" of a date, which is how a month's spending is grouped. */
const monthOf = (day: string) => day.slice(0, 7);

interface SpentRow {
  typeKey: string;
  day: string;
  cost: number;
}

/** Every grace spent in one month, newest first. */
async function spentIn(userId: string, month: string): Promise<SpentRow[]> {
  const rows = await db
    .select({ payload: events.payload, occurredAt: events.occurredAt })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "grace.spent"),
        sql`${events.payload}->>'month' = ${month}`,
      ),
    )
    .orderBy(events.occurredAt);

  return rows.map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    return {
      typeKey: String(p.type_key),
      day: String(p.spent_on),
      cost: Number(p.cost) || 0,
    };
  });
}

export interface GraceState extends GraceBalance {
  /** The month this counts, "yyyy-MM". */
  month: string;
  /** The day the allowance starts again. */
  resets: string;
  /** How many activities the pool is built from. */
  tracked: number;
  /** What has been spent this month, in the order it was spent. */
  spentOn: { typeKey: string; name: string; day: string; cost: number }[];
}

/**
 * The pool, what is left of it, and what went.
 *
 * The count of activities is what is tracked RIGHT NOW, which is deliberate:
 * add a sixth today and the pool is twelve today. A number fixed at the start
 * of the month would lag the person it is for, and somebody who has just taken
 * on more to track is exactly the person about to need it.
 */
export async function graceState(userId: string): Promise<GraceState> {
  const today = await userDay(userId);
  const month = monthOf(today);
  const [activities, spent] = await Promise.all([
    listUserActivities(userId),
    spentIn(userId, month),
  ]);
  const tracked = activities.filter((a) => a.enabled).length;
  const balance = graceBalance(
    tracked,
    spent.reduce((n, s) => n + s.cost, 0),
  );

  return {
    ...balance,
    month,
    resets: resetsOn(month),
    tracked,
    spentOn: spent.map((s) => ({
      ...s,
      name: nameOf(s.typeKey),
    })),
  };
}

function nameOf(typeKey: string): string {
  try {
    return getActivityType(typeKey).name;
  } catch {
    // A type that has since left the registry. The history is still real.
    return typeKey;
  }
}

export interface OpenOffer {
  typeKey: string;
  name: string;
  icon: string;
  /** The streak that comes back. */
  restoresTo: number;
  /** Grace it costs: one a missed day. */
  cost: number;
  /** Whether the pool covers it right now. */
  affordable: boolean;
  /** "until you next go", written by the engine from the type's own words. */
  closes: string;
  /** The period the break was judged on. */
  brokeOn: string;
}

/**
 * Every streak that has ended and can still be brought back.
 *
 * The offer opens the moment a streak breaks and closes when you next check in
 * for that activity, with a day at the floor and a fortnight at the ceiling.
 * Both bounds are in `domain/grace.ts`; the "have they checked in since" half
 * falls out of the walk itself, because a day done after the break puts the
 * streak above zero and there is nothing left to forgive.
 */
export async function openOffers(userId: string): Promise<OpenOffer[]> {
  const today = await userDay(userId);
  const [activities, balance, counters] = await Promise.all([
    listUserActivities(userId),
    graceState(userId),
    allStreaks(userId),
  ]);

  const out: OpenOffer[] = [];
  for (const activity of activities) {
    if (!activity.enabled) continue;

    // The stored counter first, because it is a row read and `offerFor` is a
    // walk of every day since the join date. Home asks this for every activity
    // on every load, and the common case is that nothing is broken at all.
    //
    // Both conditions are necessary for an offer and neither is sufficient, so
    // this only ever skips work the walk would have thrown away: a live run has
    // nothing to restore, and a counter that has never been above zero never
    // had a run to lose. A type with no counter yet is not skipped, because
    // absent is not the same as zero.
    const counter = counters.get(activity.typeKey);
    if (counter && (counter.current > 0 || counter.best === 0)) continue;

    const offer = await offerFor(userId, activity.typeKey);
    if (!offer) continue;
    // `offerFor` already returns nothing once a later day is done, which is
    // the real rule. This is the fortnight ceiling on top of it.
    if (!offerOpen(offer.brokeOn, today, false)) continue;

    out.push({
      typeKey: activity.typeKey,
      name: nameOf(activity.typeKey),
      icon: getActivityType(activity.typeKey).icon,
      restoresTo: offer.restoresTo,
      cost: offer.cost,
      affordable: offer.cost <= balance.left,
      closes: "until you next check in",
      brokeOn: offer.brokeOn,
    });
  }
  // The dearest first, which is the one most at risk of going out of reach.
  return out.sort((a, b) => b.cost - a.cost);
}

/** One activity's offer, for the row on Home and the sheet behind it. */
export async function offerOn(
  userId: string,
  typeKey: string,
): Promise<OpenOffer | null> {
  return (await openOffers(userId)).find((o) => o.typeKey === typeKey) ?? null;
}

export type SpendResult =
  | { ok: true; restoredTo: number; left: number }
  | { ok: false; reason: "no_offer" | "too_expensive"; message: string };

/**
 * Spend grace on one activity, and bring the streak back.
 *
 * The offer is worked out here rather than trusted from the client, so a stale
 * tab or a hand-made POST buys nothing: what it costs and what it restores are
 * both read from the same walk that drew the button.
 *
 * The EVENT is written first and the counter rebuilt after, the same ordering
 * as every other write in this codebase, because there are no transactions
 * (see `src/db/index.ts`). The event is the truth and the counter is a cache,
 * so a crash between them leaves a streak one rebuild behind rather than grace
 * spent on nothing.
 */
export async function spendGrace(userId: string, typeKey: string): Promise<SpendResult> {
  const [offer, balance] = await Promise.all([offerOn(userId, typeKey), graceState(userId)]);
  if (!offer) {
    return {
      ok: false,
      reason: "no_offer",
      message: "There is no streak to restore here.",
    };
  }
  if (offer.cost > balance.left) {
    return {
      ok: false,
      reason: "too_expensive",
      message: `That needs ${offer.cost} grace and you have ${balance.left}.`,
    };
  }

  const inner = await offerFor(userId, typeKey);
  if (!inner) {
    return { ok: false, reason: "no_offer", message: "There is no streak to restore here." };
  }

  await recordEvent({
    userId,
    type: "grace.spent",
    payload: {
      type_key: typeKey,
      // The periods it forgives. The rebuild reads these back, so this is the
      // record AND the instruction, which is what keeps the two in step.
      covering: inner.covering,
      cost: offer.cost,
      restored_to: offer.restoresTo,
      spent_on: balance.month === monthOf(offer.brokeOn) ? offer.brokeOn : await userDay(userId),
      // The month it is charged to is the month it was SPENT in, not the month
      // the streak broke. A break on the 31st forgiven on the 1st comes out of
      // the new month's pool, which is the one the person has.
      month: balance.month,
    },
  });

  const rebuilt = await rebuildStreak(userId, typeKey);
  return {
    ok: true,
    restoredTo: rebuilt?.current ?? offer.restoresTo,
    left: balance.left - offer.cost,
  };
}
