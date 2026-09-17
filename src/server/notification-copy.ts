// Every word Curfew ever pushes to a phone, and the only place in the app
// written in this voice.
//
// The Voice section of CLAUDE.md says Curfew is a clerk, not a coach: no
// congratulation, no encouragement, no exclamation marks. Notifications are the
// one deliberate exception (item 29), because a notification speaks FIRST, to a
// phone lying on a table, unprompted, which is the one thing a clerk has no
// reason to do. Writing it in the clerk's register would have been a worse
// version of the feature shipped to protect a rule the feature already breaks
// by existing.
//
// The exception is this FILE, not a direction. Every screen is still the clerk.
// If you find yourself wanting an exclamation mark somewhere else, that is
// ROADMAP theme 3 and it is not decided yet.
//
// ---------------------------------------------------------------------------
// THE RULE THIS FILE EXISTS TO ENFORCE
//
// Nothing here may describe progress. Not "almost", not "nearly", not "one
// more", not a number. The only sentence in a notification that says how far
// along something is comes from the module, through `remind()`, and arrives
// here as `Subject.left`, already written.
//
// This was learned the expensive way. The first version picked a whole sentence
// out of a bank, and it chose the bank by asking whether the module's `hint`
// was a non-empty string. Water's hint at zero is "0 of 8 today.", which is
// non-empty, so production sent a member who had logged nothing:
//
//     Almost there on Water
//     0 of 8 today. Closes at 11:59 PM. Food, Supplements and Reading and
//     5 more are open too.
//
// Eight glasses outstanding, described as almost done, twice, thirty minutes
// apart, with a tail listing seven other activities and a number for none of
// them. The fix is structural rather than editorial: a writer below receives
// `left` as an opaque string it may only place, and there is no bank line that
// could claim otherwise because no bank line has the numbers to claim it with.
//
// ---------------------------------------------------------------------------
// WHY A BANK AT ALL
//
// One template, sent daily, becomes wallpaper within a week, and then it is
// ignored for the rest of the app's life. That cannot be undone by writing a
// better template later. So each writer has two or three phrasings and the pick
// is a stable hash of who, what day, which tick and which KIND. Deterministic,
// so a test asserts an exact string and a retried send picks the same words.
// Varied, so nobody reads the same sentence three mornings running.
//
// The variation is in the FRAME, never in the fact. `left` is identical every
// time, and the deadline is identical every time. What rotates is the sentence
// they sit in.

export type KindKey = "lastcall" | "streak" | "peer" | "sweep" | "reminder" | "done";

export interface Line {
  title: string;
  body: string;
}

/** One outstanding activity, and everything the copy is allowed to know. */
export interface Subject {
  /** The activity's display name. "Gym". */
  name: string;
  /**
   * The module's own `remind()`, verbatim. "3 glasses to go."
   *
   * The ONLY progress claim in a notification, and the reason no writer below
   * takes a count, a target or a fraction: none of them could write this line
   * and none of them is allowed to try (invariant 6).
   */
  left: string;
  /** Minutes to the EFFECTIVE deadline, which may be the start of quiet hours. */
  minutesLeft: number;
  /** "8:00 PM", already formatted in the member's zone. */
  closesLabel: string;
  /** Periods running. 0 when there is no streak to lose. */
  streak: number;
  /**
   * What a unit of `streak` is. Gym's period is a week, so its streak counts
   * weeks, and calling those days put "3 days of Gym on the line" above
   * "2 more days this week" in the same notification.
   */
  streakUnit: "day" | "week";
}

export interface Peers {
  groupName: string;
  /** Up to two, for naming. Empty when there are more than two. */
  names: string[];
  logged: number;
  of: number;
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/**
 * FNV-1a, 32-bit. Not for security: this picks a sentence, and what it has to
 * be is the SAME sentence every time for the same person, day, tick and kind,
 * so a retried send is not a second, differently worded notification.
 */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** One of `options`, chosen stably from the seed. */
function pick<T>(seed: string, options: T[]): T {
  return options[hash(seed) % options.length];
}

// ---------------------------------------------------------------------------
// Phrases the writers share
// ---------------------------------------------------------------------------

/** "Rahul", "Rahul and Priya", or "3 of 4 in Morning Crew". */
function who(p: Peers): string {
  if (p.names.length === 1) return p.names[0];
  if (p.names.length === 2) return `${p.names[0]} and ${p.names[1]}`;
  return `${p.logged} of ${p.of} in ${p.groupName}`;
}

/** Whether a peer line should read as one person or several. */
function plural(p: Peers): boolean {
  return p.names.length !== 1;
}

// ---------------------------------------------------------------------------
// lastcall
// ---------------------------------------------------------------------------

/**
 * The window is about to shut.
 *
 * The title carries the clock because that is the whole reason this one exists,
 * and the body carries what to do about it. Neither repeats the other: an
 * earlier draft put "closes" in both and the notification read as if it were
 * about two different deadlines.
 */
export function lastCall(s: Subject, seed: string): Line {
  const m = s.minutesLeft;
  const title = pick(`${seed}:t`, [
    `${s.name} closes in ${m} ${m === 1 ? "minute" : "minutes"}`,
    `Last call for ${s.name}`,
    `${m} ${m === 1 ? "minute" : "minutes"} left on ${s.name}`,
  ]);
  const push = pick(`${seed}:b`, [
    "Log it now!",
    "This is the last window today.",
    "After this, today does not count.",
  ]);
  return { title, body: `${s.left} ${push}` };
}

// ---------------------------------------------------------------------------
// streak
// ---------------------------------------------------------------------------

/** A run worth keeping, and not much day left to keep it in. */
export function streakAtRisk(s: Subject, seed: string): Line {
  // Every one of these names the activity, and that is not stylistic. A member
  // tracking nine things who reads "Don't break a 24 day streak" on a lock
  // screen has been told the stakes and not the subject, which is the exact
  // failure this whole rewrite is about. "ends tonight" is out for the same
  // reason: this fires up to three hours before the deadline, and for an
  // activity closing at 2:00 PM, tonight is a lie.
  const run = `${s.streak} ${s.streakUnit}${s.streak === 1 ? "" : "s"}`;
  const title = pick(`${seed}:t`, [
    `${run} of ${s.name} on the line`,
    `Don't break a ${run} ${s.name} streak`,
    `Your ${s.name} streak is at risk`,
  ]);
  const stake = pick(`${seed}:b`, [
    `The streak ends at ${s.closesLabel}.`,
    `${run} go if you miss today. Closes at ${s.closesLabel}.`,
    `Keep it alive before ${s.closesLabel}.`,
  ]);
  return { title, body: `${s.left} ${stake}` };
}

// ---------------------------------------------------------------------------
// peer
// ---------------------------------------------------------------------------

/**
 * Somebody in your group did it and you have not.
 *
 * It says nothing the group hub would not, which is why naming people is fine:
 * the recipient could read the same fact by opening Curfew. See `peersOn`.
 */
export function peerAhead(s: Subject, p: Peers, seed: string): Line {
  const name = who(p);
  const verb = plural(p) ? "have" : "has";
  const title = pick(`${seed}:t`, [
    `${name} logged ${s.name}`,
    `${name} ${verb} done ${s.name} today`,
    `Don't be the last one on ${s.name}`,
  ]);
  const tail = pick(`${seed}:b`, [
    `Closes at ${s.closesLabel}.`,
    `You have until ${s.closesLabel}.`,
    `Catch up before ${s.closesLabel}!`,
  ]);
  return { title, body: `${s.left} ${tail}` };
}

// ---------------------------------------------------------------------------
// sweep
// ---------------------------------------------------------------------------

/**
 * Evening, and nothing at all has been logged.
 *
 * The one writer that names more than one activity, because on a day where
 * nothing has happened there is no reason to single one out. It names the two
 * closing soonest, with their times, and counts the rest. `subjects` arrives
 * sorted by urgency.
 *
 * It does NOT list `left` for each, and that is the lesson from the digest this
 * whole design replaced: a body carrying three modules' progress lines reads as
 * a pile of numbers attached to nothing, because a module's own sentence has no
 * reason to name its subject. Times and names here, numbers in the app.
 */
export function sweep(subjects: Subject[], seed: string): Line {
  const title = pick(`${seed}:t`, [
    "Nothing logged today",
    "The day is still empty",
    "Still time to save today",
  ]);

  // The eight activity types whose window is the whole day all cap at the same
  // moment, the start of quiet hours, so the two most urgent usually share a
  // time. Printing it twice reads as a mistake.
  const [first, second] = subjects;
  const named = !second
    ? `${first.name} closes at ${first.closesLabel}.`
    : second.closesLabel === first.closesLabel
      ? `${first.name} and ${second.name} close at ${first.closesLabel}.`
      : `${first.name} closes at ${first.closesLabel}, ${second.name} at ${second.closesLabel}.`;

  const rest = subjects.length - (second ? 2 : 1);
  return {
    title,
    body: rest > 0 ? `${named} ${rest} more open.` : named,
  };
}

// ---------------------------------------------------------------------------
// reminder
// ---------------------------------------------------------------------------

/**
 * A cue time came round and this is still open. The ordinary one.
 *
 * The title takes the deadline only when it is close enough to be the reason
 * anybody should care. Outside that it is the bare name, and the body carries
 * the time, because "Water closes at 11:59 PM" at nine in the morning is a
 * title about nothing.
 */
export function reminder(s: Subject, seed: string): Line {
  const soon = s.minutesLeft <= 180;
  const title = soon
    ? pick(`${seed}:t`, [
        `${s.name} closes at ${s.closesLabel}`,
        `${s.name}, until ${s.closesLabel}`,
      ])
    : pick(`${seed}:t`, [s.name, `${s.name} is still open`]);

  const tail = soon ? "" : ` Closes at ${s.closesLabel}.`;
  return { title, body: `${s.left}${tail}` };
}

// ---------------------------------------------------------------------------
// done
// ---------------------------------------------------------------------------

/**
 * Everything scheduled today is logged.
 *
 * The only notification Curfew sends that asks for nothing, and the only reason
 * it is worth sending: it is the one that makes the others credible. An app
 * that speaks up exclusively to complain teaches people to dread the sound.
 */
export function allClear(count: number, seed: string): Line {
  const title = pick(`${seed}:t`, ["All clear", "That is the day", "Day complete"]);
  const body = pick(`${seed}:b`, [
    `Everything you track today is logged. ${count} for ${count}.`,
    `${count} of ${count} done. Nothing else is open today.`,
    `All ${count} logged. See you tomorrow!`,
  ]);
  return { title, body };
}
