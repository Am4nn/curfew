import { cache } from "react";
import { DateTime } from "luxon";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, userPauses } from "@/db/schema";
import { resolveUserTimezone, userDay } from "./config";
import { now } from "@/lib/clock";

// A declared absence.
//
// The whole design is one sentence: A PAUSED DAY IS A DAY WITH NOTHING
// SCHEDULED. Not a miss. Everything else falls out of that rather than needing
// a rule of its own. No fine can arise, because nothing was scheduled to miss.
// Reputation is not marked down, because there was nothing to mark. Both are
// the engine's existing behaviour for a quiet day, reached by marking the
// period rather than by teaching the engine what a pause is.
//
// What it costs is the streak, outright, when the first paused day CLOSES,
// exactly the way a missed day takes one. Grace does not cover it, and that is
// what removes the need for a quota: pausing every weekend would reset the
// streak every weekend, and a weekday-only schedule already does the honest
// version of the same thing.
//
// Reputation still settles. A pause is not a freeze: seven quiet days and then
// the ordinary idle decay, so four days away costs nothing and four weeks costs
// what any four quiet weeks cost. Decisions 133 to 137.

/** Enough for a weekend trip, and not usable as a one-night excuse. */
export const MINIMUM_DAYS = 3;

export interface Pause {
  pauseId: string;
  startsOn: string;
  endsOn: string;
  /** When this shape of it was declared. An extension has a later one. */
  declaredAt: Date;
  /** How many times it has been restated: 0 as declared, 1 after one change. */
  revisions: number;
}

/** Inclusive day count, which is what every screen shows. */
export function lengthOf(pause: { startsOn: string; endsOn: string }): number {
  return (
    DateTime.fromISO(pause.endsOn, { zone: "utc" }).diff(
      DateTime.fromISO(pause.startsOn, { zone: "utc" }),
      "days",
    ).days + 1
  );
}

const iso = (d: DateTime) => d.toFormat("yyyy-MM-dd");
const addDays = (date: string, n: number) =>
  iso(DateTime.fromISO(date, { zone: "utc" }).plus({ days: n }));

/**
 * Every pause a user has declared, as it finally stood.
 *
 * The table is insert-only, so one trip can have several rows. The one that
 * counts is the highest version of each `pauseId`, which is the last thing they
 * said about that trip; a cancelled one counts for nothing at all.
 */
function reduceRows(
  rows: {
    version: number;
    pauseId: string;
    startsOn: string;
    endsOn: string;
    cancelled: boolean;
    declaredAt: Date;
  }[],
): Pause[] {
  const latest = new Map<string, (typeof rows)[number]>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.pauseId, (counts.get(row.pauseId) ?? 0) + 1);
    const held = latest.get(row.pauseId);
    if (!held || row.version > held.version) latest.set(row.pauseId, row);
  }
  return [...latest.values()]
    .filter((r) => !r.cancelled)
    .map((r) => ({
      pauseId: r.pauseId,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      declaredAt: r.declaredAt,
      revisions: (counts.get(r.pauseId) ?? 1) - 1,
    }))
    .sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0));
}

const SELECT = {
  version: userPauses.version,
  pauseId: userPauses.pauseId,
  startsOn: userPauses.startsOn,
  endsOn: userPauses.endsOn,
  cancelled: userPauses.cancelled,
  declaredAt: userPauses.declaredAt,
};

/** Every pause this user has ever declared, oldest first. */
export const pausesFor = cache(async (userId: string): Promise<Pause[]> => {
  const rows = await db.select(SELECT).from(userPauses).where(eq(userPauses.userId, userId));
  return reduceRows(rows);
});

/**
 * The days inside a pause, for a range of the replay.
 *
 * A Set rather than a predicate because the scorer asks about every day of
 * every period it walks, and one query for the range beats one per day.
 */
export async function pausedDaysIn(
  userId: string,
  from: string,
  to: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const pause of await pausesFor(userId)) {
    if (pause.endsOn < from || pause.startsOn > to) continue;
    let day = pause.startsOn > from ? pause.startsOn : from;
    const last = pause.endsOn < to ? pause.endsOn : to;
    while (day <= last) {
      out.add(day);
      day = addDays(day, 1);
    }
  }
  return out;
}

/**
 * The pause covering today, or the one already declared for later.
 *
 * Both, because a member who has declared next week's trip should see it
 * waiting rather than nothing at all, and because the group is told about it
 * before it starts for the same reason it is told during.
 */
export const currentPause = cache(
  async (userId: string): Promise<{ pause: Pause; running: boolean } | null> => {
    const today = await userDay(userId);
    const live = (await pausesFor(userId))
      .filter((p) => p.endsOn >= today)
      .sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1));
    const pause = live[0];
    if (!pause) return null;
    return { pause, running: pause.startsOn <= today };
  },
);

/** Is this member away today? The one question every screen asks. */
export async function isPausedToday(userId: string): Promise<boolean> {
  const held = await currentPause(userId);
  return held?.running === true;
}

/**
 * Everyone in one group who is away or about to be, keyed by user.
 *
 * The whole group sees it, deliberately and with the dates, for the same reason
 * the join grace period is on the members list (decision 123): a member sitting
 * at nothing reads as somebody who does not turn up, and a trip that keeps
 * being extended is worth being able to see as such.
 */
export const pausesIn = cache(
  async (groupId: string): Promise<Map<string, Pause>> => {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
    const out = new Map<string, Pause>();
    if (members.length === 0) return out;

    const ids = members.map((m) => m.userId);
    const instant = await now();
    // Two days back covers every zone on earth against a UTC read, the same
    // narrowing `grace.ts` uses, so the per-member zone lookup below only runs
    // for rows that could possibly still be live.
    const floor = iso(DateTime.fromJSDate(instant, { zone: "utc" }).minus({ days: 2 }));
    const rows = await db
      .select({ ...SELECT, userId: userPauses.userId })
      .from(userPauses)
      .where(and(inArray(userPauses.userId, ids), gte(userPauses.endsOn, floor)));

    const byUser = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }

    for (const [userId, list] of byUser) {
      // Each member's own zone: "today" is not the same instant for two people
      // in the same group.
      const timezone = await resolveUserTimezone(
        userId,
        instant.toISOString().slice(0, 10),
      );
      const today = iso(DateTime.fromJSDate(instant, { zone: timezone }));
      const live = reduceRows(list).filter((p) => p.endsOn >= today);
      if (live[0]) out.set(userId, live[0]);
    }
    return out;
  },
);

// ---------------------------------------------------------------------------
// Writing one. Every rule here is enforced in the app and not in the database,
// the same way invariant 4's future effective_from is.
// ---------------------------------------------------------------------------

export class PauseError extends Error {}

async function checkRange(userId: string, startsOn: string, endsOn: string): Promise<void> {
  if (!DateTime.fromISO(startsOn).isValid || !DateTime.fromISO(endsOn).isValid) {
    throw new PauseError("Those are not two dates.");
  }
  if (endsOn < startsOn) throw new PauseError("The last day is before the first.");

  const today = await userDay(userId);
  if (startsOn <= today) {
    // Declaring a pause over a day already lived would turn a miss that has
    // already happened into a day that was never scheduled. That is the erase
    // retroactive un-sharing was closed against (decision 15).
    throw new PauseError("A pause starts tomorrow at the earliest.");
  }
  if (lengthOf({ startsOn, endsOn }) < MINIMUM_DAYS) {
    throw new PauseError(`A pause is ${MINIMUM_DAYS} days or more.`);
  }
}

/** Declare one. Refuses to overlap a pause that is already on the books. */
export async function declarePause(
  userId: string,
  startsOn: string,
  endsOn: string,
): Promise<void> {
  await checkRange(userId, startsOn, endsOn);
  const today = await userDay(userId);
  for (const held of await pausesFor(userId)) {
    if (held.endsOn >= today && held.startsOn <= endsOn && held.endsOn >= startsOn) {
      throw new PauseError("You already have a pause covering those days.");
    }
  }
  await db.insert(userPauses).values({ userId, startsOn, endsOn });
}

/**
 * Push the end out. A trip that grows is the same trip, so it keeps its
 * `pauseId` and the original declaration stays on the record beside it.
 */
export async function extendPause(userId: string, endsOn: string): Promise<void> {
  const held = await currentPause(userId);
  if (!held) throw new PauseError("You have no pause to extend.");
  if (!DateTime.fromISO(endsOn).isValid) throw new PauseError("That is not a date.");
  if (endsOn <= held.pause.endsOn) {
    throw new PauseError("An extension has to end later than the pause does.");
  }
  await db.insert(userPauses).values({
    userId,
    pauseId: held.pause.pauseId,
    startsOn: held.pause.startsOn,
    endsOn,
  });
}

/**
 * Home early.
 *
 * From tomorrow, never from today: today was declared out and its windows have
 * been shut all day, so re-imposing them at four in the afternoon would judge
 * hours nobody could have used. The days already passed stay paused, and the
 * streak that ended does not come back.
 *
 * A pause that has not started yet is called off outright instead, because
 * there is nothing yet to be honest about.
 */
export async function endPauseEarly(userId: string): Promise<void> {
  const held = await currentPause(userId);
  if (!held) throw new PauseError("You have no pause to end.");
  const today = await userDay(userId);

  if (!held.running) {
    await db.insert(userPauses).values({
      userId,
      pauseId: held.pause.pauseId,
      startsOn: held.pause.startsOn,
      endsOn: held.pause.endsOn,
      cancelled: true,
    });
    return;
  }

  if (held.pause.endsOn <= today) {
    throw new PauseError("This pause already ends today.");
  }
  await db.insert(userPauses).values({
    userId,
    pauseId: held.pause.pauseId,
    startsOn: held.pause.startsOn,
    endsOn: today,
  });
}
