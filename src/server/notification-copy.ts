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
//
// Why a bank rather than a template: Duolingo's notification system picks from
// a set of pre-written lines rather than filling one in, and that is most of
// why theirs do not read as machine output by the fourth day. One template, sent
// daily, becomes wallpaper within a week and then it is ignored for the rest of
// the app's life, which cannot be undone by writing a better template later.
//
// The pick is a stable hash of who, what day and which slot. Deterministic, so
// a test can assert the exact string and a retried send picks the same line.
// Varied, so nobody reads the same sentence three mornings running.
//
// What this file may NOT do is describe an activity's progress. "2 of 3 meals"
// is a sentence only the food module can write (invariant 6), so every line
// here WRAPS `hint` and none of them replaces it. Nothing in this file knows
// what a meal, a glass or a session is, and if you find yourself adding a line
// that does, the line belongs in the module.

/** One outstanding activity, and everything the copy is allowed to know. */
export interface Situation {
  /** The activity's display name. "Gym". */
  name: string;
  /** The module's own progress line, verbatim. "2 of 3 meals today." */
  hint: string | null;
  /** Minutes until the window closes. Null for a window with no real close. */
  minutesLeft: number | null;
  /** "8:00 PM", already formatted in the member's zone. */
  closesLabel: string | null;
  /** Days running. 0 when there is no streak to lose. */
  streak: number;
  /** Who else, in a group you share this with, has already logged it today. */
  peers: Peers | null;
}

export interface Peers {
  groupName: string;
  /** Up to two, for naming. Empty when there are more than two. */
  names: string[];
  logged: number;
  of: number;
}

export interface Line {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// The four situations
// ---------------------------------------------------------------------------

type Writer = (s: Situation) => string;

// Somebody in your group did it and you have not. The strongest of the four,
// so it wins the title whenever it applies.
const PEERS: { title: Writer; body: Writer }[] = [
  {
    title: () => "Don't be the last one!",
    body: (s) => `${who(s)} already logged ${s.name}. ${urgency(s)}`,
  },
  {
    title: (s) => `${who(s)} are ahead of you`,
    body: (s) => `${s.name} is still open. ${urgency(s)}`,
  },
  {
    title: (s) => `Your group is moving on ${s.name}`,
    body: (s) => `${who(s)} logged it today. ${urgency(s)}`,
  },
  {
    title: () => "Catch up!",
    body: (s) => `${who(s)} have done ${s.name}. ${urgency(s)}`,
  },
];

// A streak worth losing, and not much time left.
const STREAK: { title: Writer; body: Writer }[] = [
  {
    title: (s) => `${s.streak} days on the line`,
    body: (s) => `Your ${s.name} streak ends ${when(s)}. Don't let it slip now!`,
  },
  {
    title: () => "Don't break it now!",
    body: (s) => `${s.streak} days of ${s.name}, and ${urgency(s).toLowerCase()}`,
  },
  {
    title: (s) => `Keep the ${s.name} streak alive`,
    body: (s) => `${s.streak} days so far. ${urgency(s)}`,
  },
];

// Something is recorded and it is short of the target. The module's own hint
// carries the numbers.
const NEARLY: { title: Writer; body: Writer }[] = [
  {
    title: () => "So close!",
    body: (s) => `${s.hint} One more and today counts.`,
  },
  {
    title: (s) => `Almost there on ${s.name}`,
    body: (s) => `${s.hint} ${urgency(s)}`,
  },
  {
    title: () => "Nearly done!",
    body: (s) => `${s.hint} Finish it before the window shuts.`,
  },
];

// Nothing logged, nobody ahead of you, no streak to lose.
const COLD: { title: Writer; body: Writer }[] = [
  {
    title: (s) => `${s.name} is waiting`,
    body: (s) => `Nothing recorded yet. ${urgency(s)}`,
  },
  {
    title: () => "Still time!",
    body: (s) => `${s.name} has not been logged today. ${urgency(s)}`,
  },
  {
    title: (s) => `Don't forget ${s.name}`,
    body: (s) => urgency(s),
  },
];

// ---------------------------------------------------------------------------
// Phrases the banks share
// ---------------------------------------------------------------------------

/** "Rahul", "Rahul and Priya", or "3 of 4 in Morning Crew". */
function who(s: Situation): string {
  const p = s.peers;
  if (!p) return "Someone";
  if (p.names.length === 1) return p.names[0];
  if (p.names.length === 2) return `${p.names[0]} and ${p.names[1]}`;
  return `${p.logged} of ${p.of} in ${p.groupName}`;
}

/** "40 minutes left!", "Closes at 8:00 PM.", or a nudge when neither applies. */
function urgency(s: Situation): string {
  if (s.minutesLeft !== null && s.minutesLeft <= 15) return "Minutes left!";
  if (s.minutesLeft !== null && s.minutesLeft <= 120) {
    return `${s.minutesLeft} minutes left!`;
  }
  if (s.closesLabel) return `Closes at ${s.closesLabel}.`;
  return "There is still time today.";
}

/** "at 8:00 PM" or "when today does". */
function when(s: Situation): string {
  return s.closesLabel ? `at ${s.closesLabel}` : "when today does";
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/**
 * Which bank a situation belongs to, most pressing first.
 *
 * Peers beat a streak because somebody else having done it is a fact about the
 * world rather than about the app, and it is the only one of the four that says
 * anything a person could not work out by opening Curfew.
 */
function bankFor(s: Situation): { title: Writer; body: Writer }[] {
  if (s.peers && s.peers.logged > 0) return PEERS;
  if (s.streak >= 3) return STREAK;
  if (s.hint) return NEARLY;
  return COLD;
}

/**
 * FNV-1a, 32-bit. Not for security: this picks a sentence, and what it has to
 * be is the SAME sentence every time for the same person, day and slot, so a
 * retried send is not a second, differently worded notification.
 */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The whole notification, from everything outstanding right now.
 *
 * The first situation, once sorted by how pressing it is, writes the title and
 * the first line of the body. The rest are listed after it, up to two more,
 * because a notification nobody can read at a glance is a notification nobody
 * reads at all.
 */
export function compose(input: {
  userId: string;
  /** The member's local date, "yyyy-MM-dd". */
  day: string;
  /** Which tick this is, "19:15". Part of the seed, so three sends in one day
   *  do not repeat a sentence. */
  slot: string;
  situations: Situation[];
}): Line | null {
  const ranked = [...input.situations].sort((a, b) => rank(a) - rank(b));
  const lead = ranked[0];
  if (!lead) return null;

  const bank = bankFor(lead);
  const chosen = bank[hash(`${input.userId}:${input.day}:${input.slot}`) % bank.length];

  return {
    title: chosen.title(lead),
    body: [chosen.body(lead), alsoOpen(ranked.slice(1))].filter(Boolean).join(" "),
  };
}

/**
 * "Water and Reading are open too."
 *
 * Only the NAMES. The first attempt listed each one's `hint` instead, and the
 * body came out as "2 of 3 meals today. 40 minutes left! 5 of 8 today. 0 of 20
 * pages." Every one of those sentences is true and the last two do not say what
 * they are about, because a module's hint describes its own progress and has no
 * reason to name itself. A lock screen is the wrong place to work that out.
 */
function alsoOpen(rest: Situation[]): string {
  if (rest.length === 0) return "";
  const names = rest.slice(0, 3).map((s) => s.name);
  const more = rest.length - names.length;
  const listed =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const verb = rest.length === 1 ? "is" : "are";
  return more > 0
    ? `${listed} and ${more} more ${verb} open too.`
    : `${listed} ${verb} open too.`;
}

/** Sort key. Lower is more pressing, matching the order in `bankFor`. */
function rank(s: Situation): number {
  if (s.peers && s.peers.logged > 0) return 0;
  if (s.streak >= 3) return 1;
  if (s.hint) return 2;
  return 3;
}
