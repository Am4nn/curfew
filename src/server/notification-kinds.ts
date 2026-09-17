import { and, eq, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { events } from "@/db/schema";
import { timezoneHistory } from "./config";
import {
  allClear,
  lastCall,
  peerAhead,
  reminder,
  streakAtRisk,
  sweep,
  type KindKey,
  type Line,
  type Peers,
  type Subject,
} from "./notification-copy";
import {
  cueFired,
  cuesFor,
  chosenCues,
  dayFor,
  inQuiet,
  peersOn,
  quietFor,
  slotFor,
  type DayView,
  type Outstanding,
  type Quiet,
} from "./reminders";

// Every reason Curfew has to speak first, as six records with a trigger each.
//
// A kind is a kind because it has its own TRIGGER, not because it is worded
// differently. That is the test, and it is why "closing soon" is a kind while
// "encouraging" is not: the first answers a question about the clock that no
// other kind asks, the second is a choice of adjective.
//
// This replaces one digest that tried to be all six at once. The digest listed
// everything outstanding in a single notification, which meant that with nine
// activities open it was a pile of nouns with no verb and a number attached to
// none of them, and that the 9:30 AM send repeated what the 9:00 AM send had
// already said. One kind, one activity, one thing to do.
//
// ---------------------------------------------------------------------------
// WHAT REPLACED THE DAILY CAP
//
// There was a flat cap of four notifications a day. It was the wrong control:
// it did nothing about the real problem, which was four notifications SAYING
// THE SAME THING, and it silenced the one case that actually matters, a window
// about to close at the end of a busy day. Three rules replace it:
//
//   1. One notification per member per tick. `nextFor` returns the first kind
//      that fires and stops, so the tick is the spacing.
//   2. A repeat rule per kind, below. Most are once per activity per day.
//   3. `reminder` dedupes on the WORDS. Same activity, same thing left to do,
//      same sentence, so it is suppressed. Log a glass and the sentence
//      changes, so the next one goes. A notification that repeats carries no
//      information; one that differs does.
//
// There is no upper bound on a day, and that is deliberate: a day with fifteen
// different things worth saying may say fifteen.

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Inside this, the window is closing and it is the last thing worth saying. */
const LAST_CALL_WITHIN = 30;

/** A streak is worth invoking only once the day is genuinely running out. */
const STREAK_WITHIN = 180;
const STREAK_MIN = 3;

/**
 * Peers are not worth mentioning first thing.
 *
 * Somebody in another timezone logging their gym at 6:30 AM your time is true
 * and is not news.
 */
const PEERS_FROM = 10 * 60;

/** The evening look at a day where nothing at all has happened. */
const SWEEP_FROM = 19 * 60;
const SWEEP_TO = 20 * 60;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** One notification already sent today, as the repeat rules need to see it. */
export interface Sent {
  kind: string;
  typeKey: string | null;
  title: string;
  body: string;
}

export interface Context {
  userId: string;
  instant: Date;
  slotMinutes: number;
  /** "2026-09-17T19:15", the member's local date and tick. */
  slot: string;
  view: DayView;
  quiet: Quiet;
  chosen: Map<string, string[]>;
  sent: Sent[];
  /**
   * Who else has logged this activity, injected rather than imported.
   *
   * The only thing in a `Context` that is not already a value, and the reason
   * `decide` can be driven by `bun run sim:push` with no database behind it. In
   * production this is `peersOn`.
   */
  peers(o: Outstanding): Promise<Peers | null>;
}

/** What a kind returns when it fires. Internal: `decide` turns it into a send. */
interface Candidate {
  kind: KindKey;
  /** Null for the two kinds that are about the day rather than an activity. */
  typeKey: string | null;
  line: Line;
}

export interface Notification extends Line {
  kind: KindKey;
  typeKey: string | null;
  /** The idempotency key for this send. */
  slot: string;
  /** What the badge should read. Zero on `done`, which clears it. */
  count: number;
}

interface Kind {
  key: KindKey;
  /**
   * Promise-returning even where the answer is synchronous, because `peer` has
   * to ask the database and a registry whose records disagree about that would
   * need every caller to know which is which. Five of the six never await.
   */
  detect(ctx: Context): Promise<Candidate | null> | Candidate | null;
}

// ---------------------------------------------------------------------------
// Helpers the kinds share
// ---------------------------------------------------------------------------

/**
 * The seed a writer picks its phrasing from.
 *
 * Stable for a DAY, not for a tick, and that is load-bearing rather than
 * incidental. If the seed moved every fifteen minutes, the same activity with
 * the same thing left to do would be worded differently each time, and
 * `reminder`'s dedupe, which compares the finished sentence, would never match.
 * Holding the phrasing still for the day is what turns "say something new or
 * say nothing" into a rule that can actually be enforced on the text.
 */
function seed(ctx: Context, kind: KindKey, typeKey: string | null): string {
  return `${ctx.userId}:${ctx.view.day}:${kind}:${typeKey ?? ""}`;
}

/** Has this kind already gone out today, for this activity? */
function already(ctx: Context, kind: KindKey, typeKey: string | null = null): boolean {
  return ctx.sent.some((s) => s.kind === kind && s.typeKey === typeKey);
}

/** An outstanding row as the copy is allowed to see it. */
function subject(o: Outstanding): Subject {
  return {
    name: o.name,
    left: o.left,
    minutesLeft: o.minutesLeft,
    closesLabel: o.closesLabel,
    streak: o.streak,
    streakUnit: o.streakUnit,
  };
}

function localMinutes(ctx: Context): number {
  const local = DateTime.fromJSDate(ctx.instant, { zone: ctx.view.timezone });
  return local.hour * 60 + local.minute;
}

/** Is the member inside their quiet band right now? */
function asleep(ctx: Context): boolean {
  return inQuiet(ctx.instant, ctx.view.timezone, ctx.quiet);
}

// ---------------------------------------------------------------------------
// The six, in priority order
// ---------------------------------------------------------------------------

/**
 * A window is about to shut.
 *
 * First because it is the only kind that expires. Everything else can wait for
 * the next tick and lose nothing; this cannot, and a member who misses a window
 * they were awake for and meant to make is the one failure this whole feature
 * exists to prevent.
 *
 * `outstanding` arrives sorted by `minutesLeft`, so the first match is the most
 * urgent thing the member owns.
 */
const LASTCALL: Kind = {
  key: "lastcall",
  detect(ctx) {
    for (const o of ctx.view.outstanding) {
      if (o.minutesLeft <= 0 || o.minutesLeft > LAST_CALL_WITHIN) continue;
      if (already(ctx, "lastcall", o.typeKey)) continue;
      return {
        kind: "lastcall",
        typeKey: o.typeKey,
        line: lastCall(subject(o), seed(ctx, "lastcall", o.typeKey)),
      };
    }
    return null;
  },
};

/**
 * A streak long enough to be worth naming, with the day running out.
 *
 * Gated on `STREAK_WITHIN` rather than firing at the first cue of the morning,
 * because "your 24 day streak ends tonight" at 8:00 AM is true, useless and
 * slightly threatening. It is a last-hours argument or it is nothing.
 */
const STREAK: Kind = {
  key: "streak",
  detect(ctx) {
    for (const o of ctx.view.outstanding) {
      if (o.streak < STREAK_MIN) continue;
      if (o.minutesLeft <= 0 || o.minutesLeft > STREAK_WITHIN) continue;
      if (already(ctx, "streak", o.typeKey)) continue;
      return {
        kind: "streak",
        typeKey: o.typeKey,
        line: streakAtRisk(subject(o), seed(ctx, "streak", o.typeKey)),
      };
    }
    return null;
  },
};

/**
 * Somebody in your group logged something you have not.
 *
 * The one kind with no clock behind it: the trigger is the peer's check-in
 * existing, so it goes out on the first tick after they press, while it is
 * still live. That is the whole value. Told six hours later at an unrelated cue
 * time, it is a fact about the past.
 *
 * "Once per activity per day" is what keeps one busy group from becoming the
 * reason for every notification a member gets, and it is also why this does not
 * need to remember WHICH peer events it has already reported: the first one
 * spends the day's single mention.
 */
const PEER: Kind = {
  key: "peer",
  async detect(ctx) {
    if (localMinutes(ctx) < PEERS_FROM) return null;
    for (const o of ctx.view.outstanding) {
      // Checked before the query, not after. Once the day's peer notification
      // for this activity has gone out, asking the group again every fifteen
      // minutes buys nothing.
      if (already(ctx, "peer", o.typeKey)) continue;
      const peers = await ctx.peers(o);
      if (!peers || peers.logged === 0) continue;
      return {
        kind: "peer",
        typeKey: o.typeKey,
        line: peerAhead(subject(o), peers, seed(ctx, "peer", o.typeKey)),
      };
    }
    return null;
  },
};

/**
 * Evening, and nothing at all has been logged today.
 *
 * The safety net under the other kinds: every individual cue can be dismissed
 * without a thought, and a day where that happened to all of them is a day
 * worth one notification that says so plainly.
 *
 * A window rather than an exact tick, so a missed run of the job does not lose
 * it. `already` makes the window idempotent.
 */
const SWEEP: Kind = {
  key: "sweep",
  detect(ctx) {
    const at = localMinutes(ctx);
    if (at < SWEEP_FROM || at >= SWEEP_TO) return null;
    if (ctx.view.loggedAnythingToday) return null;
    if (ctx.view.outstanding.length === 0) return null;
    if (already(ctx, "sweep")) return null;
    return {
      kind: "sweep",
      typeKey: null,
      line: sweep(ctx.view.outstanding.map(subject), seed(ctx, "sweep", null)),
    };
  },
};

/**
 * A cue time came round and this is still open. The ordinary one.
 *
 * Its repeat rule is the only one that reads the finished sentence rather than
 * a key: if the words match something already sent today, there is nothing new
 * to say and it stays quiet. Because the phrasing is held stable for the day
 * (see `seed`), the only thing that can change the words is the fact underneath
 * them, which is exactly the condition worth notifying on.
 */
const REMINDER: Kind = {
  key: "reminder",
  detect(ctx) {
    for (const o of ctx.view.outstanding) {
      const chosen = ctx.chosen.get(o.typeKey) ?? [];
      // Inside the default quiet band, only a time they typed may fire. A type
      // with no chosen rows can only be cued by the module's defaults or by the
      // engine's own offsets, and neither of those is anybody's decision.
      if (asleep(ctx) && chosen.length === 0) continue;

      const cues = cuesFor({
        closesAt: o.closesAt,
        timezone: ctx.view.timezone,
        instant: ctx.instant,
        typeKey: o.typeKey,
        quiet: ctx.quiet,
        chosen,
      });
      if (!cueFired(cues, ctx.instant, ctx.slotMinutes)) continue;

      const line = reminder(subject(o), seed(ctx, "reminder", o.typeKey));
      if (ctx.sent.some((s) => s.title === line.title && s.body === line.body)) {
        continue;
      }
      return { kind: "reminder", typeKey: o.typeKey, line };
    }
    return null;
  },
};

/**
 * Everything scheduled today is logged.
 *
 * Last, because it can never compete: it requires nothing outstanding, and
 * every kind above requires something outstanding. The ordering is for a reader
 * rather than for the machine.
 *
 * It fires on `unfinishedCount`, not on an empty `outstanding`, and the
 * difference is a real bug avoided. `outstanding` is empty both when the day is
 * done and when every window has yet to open, so at 6:00 AM an empty list means
 * "not started" and this would have congratulated somebody on a day that had
 * not happened.
 */
const DONE: Kind = {
  key: "done",
  detect(ctx) {
    if (ctx.view.scheduledCount === 0) return null;
    if (ctx.view.unfinishedCount > 0) return null;
    if (already(ctx, "done")) return null;
    return {
      kind: "done",
      typeKey: null,
      line: allClear(ctx.view.scheduledCount, seed(ctx, "done", null)),
    };
  },
};

const KINDS: Kind[] = [LASTCALL, STREAK, PEER, SWEEP, REMINDER, DONE];

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/**
 * What, if anything, this member should be sent right now.
 *
 * Null is the overwhelmingly common answer and the cheap one: most ticks, for
 * most people, nothing fires.
 */
export async function nextFor(
  userId: string,
  instant: Date,
  slotMinutes: number,
): Promise<Notification | null> {
  const quiet = await quietFor(userId);

  // The cheap half of the quiet gate, before anything expensive is read. It is
  // the answer on roughly half of all ticks, and `decide` checks it properly
  // again: this is an optimisation, not the rule.
  const timezone = (await timezoneHistory(userId)).at(instant);
  if (inQuiet(instant, timezone, quiet) && quiet.custom) return null;

  const view = await dayFor(userId, instant, quiet);

  return decide({
    userId,
    instant,
    slotMinutes,
    slot: slotFor(instant, view.timezone, slotMinutes),
    view,
    quiet,
    chosen: await chosenCues(userId),
    sent: await sentToday(userId, view.day),
    peers: (o) => peersOn(userId, o.typeKey, o.period),
  });
}

/**
 * The whole decision, over values.
 *
 * Split from `nextFor` so it can be driven without a database, which is what
 * `bun run sim:push` does: it fabricates a day, walks it at fifteen-minute
 * ticks and prints what would arrive on a lock screen. Copy that can only be
 * reviewed by waiting for a phone to buzz is copy that ships unread, and that
 * is exactly how the first version reached production.
 */
export async function decide(ctx: Context): Promise<Notification | null> {
  // THE QUIET GATE, above the registry rather than inside any kind, so a kind
  // added later cannot forget it.
  //
  // There is no exception for urgency and `lastcall` in particular is not
  // exempt. Urgency is precisely the argument that would put a notification at
  // 2:00 AM, and a window nobody was awake to make is not saved by being told
  // about it at the time they could not have made it.
  const quiet = asleep(ctx);
  if (quiet && ctx.quiet.custom) return null;

  for (const kind of KINDS) {
    // Inside the DEFAULT band, the only thing that may fire is a reminder at a
    // time the member typed themselves. The other five are all triggered by
    // something Curfew noticed rather than something anybody asked for.
    if (quiet && kind.key !== "reminder") continue;
    const found = await kind.detect(ctx);
    if (!found) continue;
    return {
      ...found.line,
      kind: found.kind,
      typeKey: found.typeKey,
      slot: ctx.slot,
      // `done` clears the badge. Everything else counts what is still open.
      count: found.kind === "done" ? 0 : ctx.view.outstanding.length,
    };
  }

  return null;
}

/**
 * Everything already pushed to this member today.
 *
 * Read once per member per tick and handed to every kind, so six repeat rules
 * cost one query rather than six.
 *
 * Rows written before this shape existed carry no `kind`, `title` or `body`.
 * They are read as an untyped reminder, which at worst spends one extra
 * notification on the day of the deploy and never sends a duplicate of
 * anything, because an empty title matches no line any writer produces.
 */
async function sentToday(userId: string, day: string): Promise<Sent[]> {
  const rows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "push.sent"),
        sql`${events.payload}->>'slot' LIKE ${day + "%"}`,
      ),
    );

  return rows.map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    return {
      kind: typeof p.kind === "string" ? p.kind : "reminder",
      typeKey: typeof p.typeKey === "string" ? p.typeKey : null,
      title: typeof p.title === "string" ? p.title : "",
      body: typeof p.body === "string" ? p.body : "",
    };
  });
}
