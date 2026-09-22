import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  activityReminders,
  events,
  groupMembers,
  notificationSettings,
  userApprovals,
  users,
} from "@/db/schema";
import { getActivityType, displayNameOf, periodUnit } from "@/domain";
import { now } from "@/lib/clock";
import { listUserActivities } from "./activities";
import { getCheckinState } from "./checkin";
import { timezoneHistory } from "./config";
import { listUserGroups } from "./groups";
import { assertMember } from "./membership";
import { isPausedToday } from "./pause";
import { sharesFor } from "./sharing";
import { allStreaks } from "./streak";
import type { Peers } from "./notification-copy";

// What a member still owes, when they are awake to hear about it, and who else
// has already done it. The triggers that turn these facts into a notification
// live next door in `notification-kinds.ts`; this file is only the facts.
//
// Everything here is READ-ONLY, and that is a constraint rather than an
// observation. The obvious way to ask "what does this person still owe today"
// is `todayFor`, which Home already calls, and it must never be used here:
// `todayFor` goes through `standingsFor`, which calls `closeOutstanding` and
// `closeStreaks`, so reading it WRITES scoring rows. Once every fifteen
// minutes, for everybody, forever. `getCheckinState` answers the same question
// and writes nothing.
//
// The second rule is that a reminder must never name something the write path
// would refuse. `check:offer` already guards the screens: a button is there
// when a press would count. This is the same claim one step further out, and
// `bun run check:reminders` is what holds it.

// ---------------------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------------------

/** Minutes before the deadline that the engine's own cues fire. */
const OFFSETS = [120, 45, 10];

const DEFAULT_QUIET_FROM = "21:30";
const DEFAULT_QUIET_TO = "08:00";

export interface Quiet {
  /** "HH:mm", member's own zone. `from > to` wraps midnight, which is normal. */
  from: string;
  to: string;
  /**
   * Did they set this, or is it the default?
   *
   * The distinction earns its keep in exactly one place. A reminder time the
   * member TYPED beats the default band, because somebody who asks for 10:30 PM
   * has told us they are awake then and the app should not know better. It does
   * not beat a band they set themselves: explicit beats default, and both of
   * those are theirs.
   */
  custom: boolean;
}

export async function quietFor(userId: string): Promise<Quiet> {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId));
  if (!row) return { from: DEFAULT_QUIET_FROM, to: DEFAULT_QUIET_TO, custom: false };
  return { from: row.quietFrom, to: row.quietTo, custom: true };
}

/** Replace the quiet band. Both times "HH:mm". */
export async function setQuietHours(
  userId: string,
  from: string,
  to: string,
): Promise<void> {
  for (const t of [from, to]) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error(`Not a time: ${t}`);
  }
  await db
    .insert(notificationSettings)
    .values({ userId, quietFrom: from, quietTo: to })
    .onConflictDoUpdate({
      target: notificationSettings.userId,
      set: { quietFrom: from, quietTo: to },
    });
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Is this moment inside the member's quiet band?
 *
 * The band almost always wraps midnight, so the wrapped case is the normal one
 * and not the edge: 9:30 PM to 8:00 AM is `from > to`, and "inside" then means
 * at or after `from` OR before `to`. Writing this the other way round, with the
 * un-wrapped case first, is how you ship an app that is silent all day and
 * talkative all night.
 */
export function inQuiet(instant: Date, timezone: string, quiet: Quiet): boolean {
  const local = DateTime.fromJSDate(instant, { zone: timezone });
  const at = local.hour * 60 + local.minute;
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  return from > to ? at >= from || at < to : at >= from && at < to;
}

/**
 * The last moment worth aiming at today.
 *
 * The window's own close, or the start of quiet hours, whichever comes first.
 *
 * The cap is what makes this work for the eight activity types whose window is
 * the whole day: their real close is 11:59 PM, and counting backwards from it
 * produces three messages between 10 PM and midnight about a day already lost,
 * none of which would be delivered anyway because quiet hours would eat them.
 * It also does something sensible for gym, whose window is the whole WEEK: the
 * cap turns "two hours before Sunday ends" into an evening nudge each day the
 * week is still short.
 *
 * ONE function, used by the cue times, by `minutesLeft` and by the last-call
 * trigger. They used to disagree: the cues were capped at a hardcoded 9:30 PM
 * and `minutesLeft` was measured to the raw close, so gym was cued on Tuesday
 * evening and the sentence named Sunday.
 */
export function deadlineFor(input: {
  closesAt: Date;
  timezone: string;
  instant: Date;
  quiet: Quiet;
}): DateTime {
  const { timezone, quiet } = input;
  const local = DateTime.fromJSDate(input.instant, { zone: timezone });
  const [h, m] = quiet.from.split(":").map(Number);
  const cap = local.startOf("day").set({ hour: h ?? 21, minute: m ?? 30 });
  const close = DateTime.fromJSDate(input.closesAt, { zone: timezone });

  // A cap that has already passed is not a deadline, it is history. Capping to
  // it anyway is how a notification comes to name a time in the past: a member
  // with a reminder they typed for 10:30 PM was sent "Study closes at 9:30 PM"
  // at half past ten, because the cap was applied without asking whether it
  // was still ahead. Found by `bun run sim:push`, persona G.
  if (cap <= local) return close;
  return close < cap ? close : cap;
}

// ---------------------------------------------------------------------------
// What is still owed
// ---------------------------------------------------------------------------

export interface Outstanding {
  typeKey: string;
  name: string;
  /**
   * The module's `remind()`, or a plain fallback when it writes none.
   *
   * Never `hint`. `hint` is written for a card that already shows the name and
   * counts UP from zero, which on a lock screen was read as progress and
   * described eight untouched glasses of water as nearly done.
   */
  left: string;
  /** The window's own close. */
  closesAt: Date;
  /** The close or the start of quiet hours, whichever is sooner. */
  deadline: Date;
  /** Formatted from `deadline`, so the sentence and the clock agree. */
  closesLabel: string;
  minutesLeft: number;
  period: string;
  streak: number;
  /**
   * What a unit of `streak` actually is.
   *
   * A streak counts PERIODS, and gym's period is a week, so a gym streak of 3
   * is three weeks. Everywhere else in the app that renders a streak says
   * "3 day streak" regardless, which is a small inaccuracy on a screen that
   * also shows the activity and its schedule. In a notification it is not
   * small: "3 days of Gym on the line" sat directly above "2 more days this
   * week", two day-counts side by side meaning different things.
   */
  streakUnit: "day" | "week";
}

/** Everything about this member's day that a notification could turn on. */
export interface DayView {
  /** Open right now, and a press would count. Sorted most urgent first. */
  outstanding: Outstanding[];
  /** Scheduled today at all. Zero on a declared pause. */
  scheduledCount: number;
  /** Scheduled today and not yet passing. Zero is what `done` fires on. */
  unfinishedCount: number;
  /** Did anything at all get logged today? What `sweep` fires on. */
  loggedAnythingToday: boolean;
  timezone: string;
  /** The member's local date, "yyyy-MM-dd". */
  day: string;
}

/**
 * The member's day, read once.
 *
 * The filter on `outstanding` is deliberately the same truth table
 * `resolveCheckinTarget` applies to a write, in the same order, because the two
 * disagreeing is the whole failure mode: a notification about a press that
 * would be refused.
 *
 * `step.open` already carries four of the conditions at once, since it is
 * `inWindow && counts && !spent && !waiting` and every screen in the app gates
 * its controls on exactly that. The two it does NOT carry are the scheduled day
 * and the pause, so those are checked here.
 */
export async function dayFor(
  userId: string,
  instant: Date,
  quiet: Quiet,
): Promise<DayView> {
  const timezone = (await timezoneHistory(userId)).at(instant);
  const day = DateTime.fromJSDate(instant, { zone: timezone }).toFormat("yyyy-MM-dd");
  const empty: DayView = {
    outstanding: [],
    scheduledCount: 0,
    unfinishedCount: 0,
    loggedAnythingToday: false,
    timezone,
    day,
  };

  const activities = (await listUserActivities(userId)).filter((a) => a.enabled);
  if (activities.length === 0) return empty;

  // A declared pause is a day with nothing scheduled on it. Asked once for the
  // member rather than once per activity: it is an account-level fact and this
  // runs on a tick. Returning `empty` rather than a day with zero outstanding
  // matters, because a day with nothing scheduled must not read as a day
  // completed: `done` would fire every morning of a holiday.
  if (await isPausedToday(userId)) return empty;

  const [states, streaks] = await Promise.all([
    Promise.all(activities.map((a) => getCheckinState(userId, a.typeKey))),
    allStreaks(userId),
  ]);

  const outstanding: Outstanding[] = [];
  let scheduledCount = 0;
  let unfinishedCount = 0;
  let loggedAnythingToday = false;

  for (const state of states) {
    if (!state) continue;
    if (!state.scheduled) continue;
    scheduledCount++;
    if (state.countedToday) loggedAnythingToday = true;
    if (!state.passed) unfinishedCount++;
    if (state.passed) continue;

    // The step whose press would actually count. `waitingOn` steps can never be
    // open, so this also excludes sleep's confirm before the wake press: its
    // times are the widest the window could turn out to be, and scheduling
    // against a bound is how you announce a window that never opens.
    const step = state.steps.find((s) => s.open && s.closesAt !== null);
    if (!step || !step.closesAt) continue;

    const deadline = deadlineFor({
      closesAt: step.closesAt,
      timezone,
      instant,
      quiet,
    });

    outstanding.push({
      typeKey: state.typeKey,
      name: state.name,
      // The module's own words, or the engine's plainest possible fallback.
      // Never `hint`, and never an invented sentence: a type that says nothing
      // still deserves a reminder that it exists.
      left: state.steps.find((s) => s.remind)?.remind ?? "Not logged yet.",
      closesAt: step.closesAt,
      deadline: deadline.toJSDate(),
      closesLabel: deadline.toFormat("h:mm a"),
      minutesLeft: Math.round(
        (deadline.toMillis() - instant.getTime()) / 60_000,
      ),
      period: state.period,
      // A GREY run is over. It keeps its number on screen, because the days
      // happened, but it is not a streak that tonight can save and a
      // notification must not say it is. "Don't break a 23 day streak" about a
      // run that ended on Saturday is the same class of lie as telling somebody
      // with nothing logged that they were almost there, which is what
      // notification-copy.ts exists to make impossible. Zero here means the
      // streak kind never fires for it.
      streak: (() => {
        const k = streaks.get(state.typeKey);
        return k && !k.grey ? k.current : 0;
      })(),
      streakUnit: periodUnit(state.schedule),
    });
  }

  // Most urgent first, everywhere. The old code sorted by which copy bank a row
  // belonged to, which is how Water closing at 11:59 PM led a notification
  // while the two activities closing that afternoon sat inside "and 5 more".
  outstanding.sort((a, b) => a.minutesLeft - b.minutesLeft || b.streak - a.streak);

  return {
    outstanding,
    scheduledCount,
    unfinishedCount,
    loggedAnythingToday,
    timezone,
    day,
  };
}

/** Everything open right now. Kept for `check:reminders`, which asks only this. */
export async function outstandingFor(userId: string): Promise<Outstanding[]> {
  const instant = await now();
  return (await dayFor(userId, instant, await quietFor(userId))).outstanding;
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

/**
 * The instants this activity is worth a reminder at, today, in this zone.
 *
 * Three sources, first one that answers wins:
 *
 *  1. What the member set. Honoured as typed, including inside the DEFAULT
 *     quiet band: somebody who asks for 10:30 PM has told us something.
 *  2. What the module declares. Food's breakfast, lunch and dinner. Dropped if
 *     it lands in quiet hours, since it is a default nobody chose.
 *  3. The engine's own: two hours, forty-five minutes and ten minutes before
 *     the deadline.
 */
export function cuesFor(input: {
  closesAt: Date;
  timezone: string;
  instant: Date;
  typeKey: string;
  quiet: Quiet;
  /** "HH:mm" rows the member set for this activity. */
  chosen: string[];
}): Date[] {
  const { timezone, instant, quiet } = input;
  const today = DateTime.fromJSDate(instant, { zone: timezone }).startOf("day");
  const awake = (d: DateTime) => !inQuiet(d.toJSDate(), timezone, quiet);

  if (input.chosen.length > 0) {
    return input.chosen.map((t) => at(today, t).toJSDate());
  }

  const declared = getActivityType(input.typeKey).reminderCues;
  if (declared && declared.length > 0) {
    return declared
      .map((t) => at(today, t))
      .filter(awake)
      .map((d) => d.toJSDate());
  }

  const deadline = deadlineFor({ closesAt: input.closesAt, timezone, instant, quiet });
  return OFFSETS.map((m) => deadline.minus({ minutes: m }))
    .filter(awake)
    .map((d) => d.toJSDate());
}

function at(day: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h ?? 0, minute: m ?? 0 });
}

/** Whether any of this activity's cues landed in the tick ending at `instant`. */
export function cueFired(cues: Date[], instant: Date, slotMinutes: number): boolean {
  const since = instant.getTime() - slotMinutes * 60_000;
  return cues.some((c) => c.getTime() > since && c.getTime() <= instant.getTime());
}

/**
 * The tick a moment belongs to, as the member's own local date and time.
 *
 * This is the idempotency key (`events_one_push_idx`), so it has to be stable
 * for a given moment and coarse enough that two ticks a second apart cannot
 * both send. It is local rather than UTC because everything it gates is a
 * per-day question and the day that matters is theirs.
 */
export function slotFor(instant: Date, timezone: string, slotMinutes: number): string {
  const local = DateTime.fromJSDate(instant, { zone: timezone });
  const minute = Math.floor(local.minute / slotMinutes) * slotMinutes;
  return `${local.toFormat("yyyy-MM-dd")}T${local.set({ minute }).toFormat("HH:mm")}`;
}

// ---------------------------------------------------------------------------
// Who else has done it
// ---------------------------------------------------------------------------

/**
 * Members of this person's groups who have already logged this activity today.
 *
 * It says nothing the group hub would not. The whole set is read through the
 * existing group path, `assertMember` then `sharesFor`, not because anything
 * here needs hiding but because that path already knows the rules and a second
 * one would not. v3.1 shipped two bugs of exactly this shape in opposite
 * directions: a group saw a member's whole back catalogue, and shared evidence
 * never reached the group at all. The second is the one that would hurt here,
 * because a peer line that silently never fires looks identical to a group
 * where nobody did anything.
 *
 * KNOWN INEXACTNESS. `period_start` resolves per member, from their zone and
 * their activity's day boundary, so sleep's noon-to-noon period can carry a
 * different date string for somebody abroad. This asks with the RECIPIENT's
 * period. The cost is a sentence that counts the wrong day for a peer in
 * another timezone. It judges nothing and charges nobody, which is why it is a
 * comment here rather than a second resolution pass.
 */
export async function peersOn(
  userId: string,
  typeKey: string,
  period: string,
): Promise<Peers | null> {
  const groups = await listUserGroups(userId);
  if (groups.length === 0) return null;

  for (const group of groups) {
    await assertMember(group.groupId, userId);

    // Live members, minus anyone whose account has been disabled or banned.
    // The same filter `scoreAll` uses, so a banned member disappears from this
    // for the same reason they disappear from scoring.
    const members = await db
      .select({ userId: users.id, name: users.name })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .leftJoin(userApprovals, eq(userApprovals.userId, users.id))
      .where(
        and(
          eq(groupMembers.groupId, group.groupId),
          isNull(groupMembers.leftAt),
          isNull(userApprovals.disabledAt),
        ),
      );

    const peers = members.filter((m) => m.userId !== userId);
    if (peers.length === 0) continue;

    // What each of them shares HERE. A member who tracks gym but has not shared
    // it with this group is invisible to this group, and so to this sentence.
    const sharing: typeof peers = [];
    for (const peer of peers) {
      const shares = await sharesFor(group.groupId, peer.userId);
      if (shares.some((s) => s.typeKey === typeKey && s.shared)) sharing.push(peer);
    }
    if (sharing.length === 0) continue;

    const ids = sharing.map((p) => p.userId);
    const logged = await db
      .selectDistinct({ userId: events.userId })
      .from(events)
      .where(
        and(
          inArray(events.userId, ids),
          like(events.type, `checkin.${typeKey}.%`),
          sql`${events.payload}->>'period_start' = ${period}`,
        ),
      );
    if (logged.length === 0) continue;

    const names = sharing
      .filter((p) => logged.some((l) => l.userId === p.userId))
      .map((p) => firstName(p.name));

    return {
      groupName: group.name,
      // Named only while there are few enough to read. Past two it becomes a
      // count, which says the same thing and fits on a lock screen.
      names: names.length <= 2 ? names : [],
      logged: names.length,
      // Everyone who shares it here, including the recipient, since "3 of 4"
      // has to count them or the fraction is about a group they are not in.
      of: sharing.length + 1,
    };
  }

  return null;
}

/** "Rahul Arya" is "Rahul" on a lock screen. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// ---------------------------------------------------------------------------
// The member's own times
// ---------------------------------------------------------------------------

/**
 * What the settings screen shows: every tracked activity, the times it will
 * remind at, and whether those are the member's own or the module's default.
 */
export async function reminderSettings(userId: string): Promise<
  {
    typeKey: string;
    name: string;
    chosen: string[];
    suggested: string[];
  }[]
> {
  const activities = (await listUserActivities(userId)).filter((a) => a.enabled);
  const chosen = await chosenCues(userId);
  return activities.map((a) => {
    const type = getActivityType(a.typeKey);
    return {
      typeKey: a.typeKey,
      name: displayNameOf(type, a.config),
      chosen: (chosen.get(a.typeKey) ?? []).sort(),
      // The module's own times, or nothing when it has none and the engine
      // works backwards from the window instead. Shown as placeholders so a
      // person can see what they are replacing.
      suggested: type.reminderCues ?? [],
    };
  });
}

/**
 * Replace this activity's reminder times. An empty list restores the default,
 * which is why there is no separate reset.
 *
 * Delete then insert, rather than a diff. The rows have no identity beyond
 * their own value and there are at most a handful, so a diff would be more code
 * to arrive at the same three rows.
 */
export async function setReminders(
  userId: string,
  typeKey: string,
  times: string[],
): Promise<void> {
  const clean = [...new Set(times.map((t) => t.trim()).filter(Boolean))].sort();
  for (const t of clean) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
      throw new Error(`Not a time: ${t}`);
    }
  }
  // No transaction available on the Neon HTTP driver, so the order matters: a
  // crash between these leaves the activity on its default times, which is a
  // visible, correct-looking state rather than a half-saved one.
  await db
    .delete(activityReminders)
    .where(
      and(eq(activityReminders.userId, userId), eq(activityReminders.typeKey, typeKey)),
    );
  if (clean.length === 0) return;
  await db
    .insert(activityReminders)
    .values(clean.map((at) => ({ userId, typeKey, at })))
    .onConflictDoNothing();
}

/** Every reminder time this member has set, by activity. */
export async function chosenCues(userId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select()
    .from(activityReminders)
    .where(eq(activityReminders.userId, userId));
  const out = new Map<string, string[]>();
  for (const row of rows) {
    out.set(row.typeKey, [...(out.get(row.typeKey) ?? []), row.at]);
  }
  return out;
}
