import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  activityReminders,
  events,
  groupMembers,
  userApprovals,
  users,
} from "@/db/schema";
import { getActivityType } from "@/domain";
import { listUserActivities } from "./activities";
import { getCheckinState } from "./checkin";
import { timezoneHistory } from "./config";
import { listUserGroups } from "./groups";
import { assertMember } from "./membership";
import { isPausedToday } from "./pause";
import { sharesFor } from "./sharing";
import { allStreaks } from "./streak";
import { compose, type Line, type Peers, type Situation } from "./notification-copy";

// Who is worth interrupting, and when.
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
// The shape of a day
// ---------------------------------------------------------------------------

/** Minutes before the deadline that the engine's own cues fire. */
const OFFSETS = [120, 45, 10];

/** Nothing the engine derives fires outside these, in the member's own zone. */
const WAKING_FROM = 8 * 60;
const WAKING_TO = 21 * 60 + 30;

/**
 * Peers are not worth mentioning first thing.
 *
 * Somebody in another timezone logging their gym at 6:30 AM your time is true
 * and is not news. The time cues are anchored to a deadline and can fire
 * whenever the deadline says; this one has no deadline behind it, so it needs
 * an hour of its own.
 */
const PEERS_FROM = 10 * 60;

/** Digests per account per day, whatever the cues say. */
export const DAILY_CAP = 4;

// ---------------------------------------------------------------------------
// What is still owed
// ---------------------------------------------------------------------------

export interface Outstanding {
  typeKey: string;
  name: string;
  /** The module's own progress line. Null when the module writes none. */
  hint: string | null;
  /** Never null: a row is only outstanding when a window is genuinely open. */
  closesAt: Date;
  closesLabel: string;
  period: string;
  streak: number;
}

/**
 * Everything this member could still record right now.
 *
 * The filter is deliberately the same truth table `resolveCheckinTarget`
 * applies to a write, in the same order, because the two disagreeing is the
 * whole failure mode: a notification about a press that would be refused.
 *
 * `step.open` already carries four of the conditions at once, since it is
 * `inWindow && counts && !spent && !waiting` and every screen in the app gates
 * its controls on exactly that. The two it does NOT carry are the scheduled day
 * and the pause, so those are checked here.
 */
export async function outstandingFor(userId: string): Promise<Outstanding[]> {
  const activities = (await listUserActivities(userId)).filter((a) => a.enabled);
  if (activities.length === 0) return [];

  // A declared pause is a day with nothing scheduled on it. Asked once for the
  // member rather than once per activity: it is an account-level fact and this
  // runs on a tick.
  if (await isPausedToday(userId)) return [];

  const [states, streaks] = await Promise.all([
    Promise.all(activities.map((a) => getCheckinState(userId, a.typeKey))),
    allStreaks(userId),
  ]);

  const out: Outstanding[] = [];
  for (const state of states) {
    if (!state) continue;
    if (!state.scheduled) continue;
    if (state.passed) continue;

    // The step whose press would actually count. `waitingOn` steps can never be
    // open, so this also excludes sleep's confirm before the wake press: its
    // times are the widest the window could turn out to be, and scheduling
    // against a bound is how you announce a window that never opens.
    const step = state.steps.find((s) => s.open && s.closesAt !== null);
    if (!step || !step.closesAt) continue;

    out.push({
      typeKey: state.typeKey,
      name: state.name,
      hint: state.steps.find((s) => s.hint)?.hint ?? null,
      closesAt: step.closesAt,
      closesLabel: step.closesLabel,
      period: state.period,
      streak: streaks.get(state.typeKey)?.current ?? 0,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

/**
 * The instants this activity is worth a reminder at, today, in this zone.
 *
 * Three sources, first one that answers wins:
 *
 *  1. What the member set. Honoured as typed, including outside waking hours:
 *     somebody who asks for 10:30 PM has told us something and the app should
 *     not know better.
 *  2. What the module declares. Food's breakfast, lunch and dinner. Clamped to
 *     waking hours, since it is a default nobody chose.
 *  3. The engine's own: two hours, forty-five minutes and ten minutes before
 *     the deadline.
 *
 * The DEADLINE is the window's close or 9:30 PM today, whichever comes first.
 * The cap is what makes this work for the eight types whose window is the whole
 * day: their real close is midnight, and counting backwards from it produces
 * three messages between 10 PM and midnight about a day already lost. It also
 * does something sensible for gym, whose window is the whole WEEK: the cap
 * turns "two hours before Sunday ends" into an evening nudge each day the week
 * is still short.
 */
export function cuesFor(input: {
  closesAt: Date;
  timezone: string;
  instant: Date;
  typeKey: string;
  /** "HH:mm" rows the member set for this activity. */
  chosen: string[];
}): Date[] {
  const { timezone, instant } = input;
  const today = DateTime.fromJSDate(instant, { zone: timezone }).startOf("day");

  if (input.chosen.length > 0) {
    return input.chosen.map((t) => at(today, t)).map((d) => d.toJSDate());
  }

  const declared = getActivityType(input.typeKey).reminderCues;
  if (declared && declared.length > 0) {
    return declared
      .map((t) => at(today, t))
      .filter(waking)
      .map((d) => d.toJSDate());
  }

  const cap = today.set({ hour: 21, minute: 30 });
  const close = DateTime.fromJSDate(input.closesAt, { zone: timezone });
  const deadline = close < cap ? close : cap;

  return OFFSETS.map((m) => deadline.minus({ minutes: m }))
    .filter(waking)
    .map((d) => d.toJSDate());
}

function at(day: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h ?? 0, minute: m ?? 0 });
}

function waking(d: DateTime): boolean {
  const minute = d.hour * 60 + d.minute;
  return minute >= WAKING_FROM && minute < WAKING_TO;
}

/**
 * The tick a moment belongs to, as the member's own local date and time.
 *
 * This is the idempotency key (`events_one_push_idx`), so it has to be stable
 * for a given moment and coarse enough that two ticks a second apart cannot
 * both send. It is local rather than UTC because the cap is a per-day cap and
 * the day that matters is theirs.
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
// The decision
// ---------------------------------------------------------------------------

export interface Digest extends Line {
  /** The idempotency key for this send. */
  slot: string;
  /** What the badge should read: how many things are still open. */
  count: number;
  typeKeys: string[];
}

/**
 * Whether this member is due a digest at this moment, and what it says.
 *
 * Null is the overwhelmingly common answer and the cheap one: most ticks, for
 * most people, nothing is due.
 */
export async function dueNow(
  userId: string,
  instant: Date,
  slotMinutes: number,
): Promise<Digest | null> {
  const outstanding = await outstandingFor(userId);
  if (outstanding.length === 0) return null;

  const timezone = (await timezoneHistory(userId)).at(instant);
  const slot = slotFor(instant, timezone, slotMinutes);
  const day = slot.slice(0, 10);

  if (await sentToday(userId, day)) return null;

  const chosen = await chosenCues(userId);
  const since = instant.getTime() - slotMinutes * 60_000;

  // A time cue for any outstanding activity is enough to fire the whole digest.
  let fired = outstanding.some((o) =>
    cuesFor({
      closesAt: o.closesAt,
      timezone,
      instant,
      typeKey: o.typeKey,
      chosen: chosen.get(o.typeKey) ?? [],
    }).some((cue) => cue.getTime() > since && cue.getTime() <= instant.getTime()),
  );

  // Peers are resolved either way, because they are the best line in the
  // notification when one is going out anyway, and a reason to send one when
  // nothing else is due.
  const local = DateTime.fromJSDate(instant, { zone: timezone });
  const peerHour = local.hour * 60 + local.minute >= PEERS_FROM && waking(local);

  const situations: Situation[] = [];
  let anyPeers = false;
  for (const o of outstanding) {
    const peers = peerHour ? await peersOn(userId, o.typeKey, o.period) : null;
    if (peers && peers.logged > 0) anyPeers = true;
    situations.push({
      name: o.name,
      hint: o.hint,
      minutesLeft: Math.round((o.closesAt.getTime() - instant.getTime()) / 60_000),
      closesLabel: o.closesLabel || null,
      streak: o.streak,
      peers,
    });
  }

  if (!fired && anyPeers && !(await peerCueSentToday(userId, day))) fired = true;
  if (!fired) return null;

  const line = compose({ userId, day, slot, situations });
  if (!line) return null;

  return {
    ...line,
    slot,
    count: outstanding.length,
    typeKeys: outstanding.map((o) => o.typeKey),
  };
}

/** Every reminder time this member has set, by activity. */
async function chosenCues(userId: string): Promise<Map<string, string[]>> {
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

/** The cap, counted from what was actually sent rather than a stored tally. */
async function sentToday(userId: string, day: string): Promise<boolean> {
  const rows = await db
    .select({ slot: sql<string>`${events.payload}->>'slot'` })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "push.sent"),
        sql`${events.payload}->>'slot' LIKE ${day + "%"}`,
      ),
    );
  return rows.length >= DAILY_CAP;
}

/**
 * Whether the peer cue has already gone out today.
 *
 * Separate from the cap because it is a different question: the cap stops a
 * runaway tick, this stops one group being active from turning into four
 * notifications about the same fact.
 */
async function peerCueSentToday(userId: string, day: string): Promise<boolean> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "push.sent"),
        sql`${events.payload}->>'slot' LIKE ${day + "%"}`,
        sql`(${events.payload}->>'peers')::boolean is true`,
      ),
    );
  return rows.length > 0;
}
