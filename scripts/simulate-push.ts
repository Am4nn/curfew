/**
 * bun run sim:push
 *
 * A day of notifications, printed as they would arrive on a lock screen.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * v3.3 shipped push reminders that nobody had read. Every test passed, the
 * copy had unit tests, the job ran, the phone buzzed. What arrived was this,
 * to somebody who had logged nothing all morning:
 *
 *     Almost there on Water
 *     0 of 8 today. Closes at 11:59 PM. Food, Supplements and Reading and
 *     5 more are open too.
 *
 * The defect was not in any one function. Every piece was individually correct
 * and the SENTENCE was wrong, and no unit test can notice that, because a unit
 * test asserts the string it was told to expect. The only way to catch it is to
 * read the notification, and the only way to read it before shipping is to
 * print it.
 *
 * So this walks fabricated days at the real fifteen-minute tick, through the
 * real `decide`, the real kinds and the real module `remind()` functions, and
 * prints every notification. No database and no network: a `Context` is a bag
 * of values by design, which is why it can be filled in by hand here.
 *
 * WHAT IT DOES NOT SIMULATE. The engine. Whether a window is open, whether a
 * press would count and whether a period has passed are `getCheckinState`'s
 * answers and `check:reminders` is what holds them. Here an activity is
 * outstanding when its module says something is left and the clock is before
 * its close, which is a faithful enough model to review words against.
 *
 * It also asserts, at the end, the things a person reading output would miss:
 * lengths, repeats, silence during quiet hours. Non-zero exit on any of them,
 * so CI reads it too.
 */
import { DateTime } from "luxon";
import { getActivityType, periodUnit } from "@/domain";
import { decide, type Context, type Sent } from "@/server/notification-kinds";
import type { Peers } from "@/server/notification-copy";
import {
  deadlineFor,
  type DayView,
  type Outstanding,
  type Quiet,
} from "@/server/reminders";

const ZONE = "Asia/Kolkata";
const DAY = "2026-09-17";
const SLOT_MINUTES = 15;
const DEFAULT_QUIET: Quiet = { from: "21:30", to: "08:00", custom: false };

// ---------------------------------------------------------------------------
// A persona
// ---------------------------------------------------------------------------

interface Press {
  /** Local "HH:mm" it was recorded. */
  at: string;
  /** The module's own evidence fields, where it has any. */
  evidence?: Record<string, number>;
}

interface Tracked {
  typeKey: string;
  /** Local "HH:mm" this activity's window closes. */
  closes: string;
  streak?: number;
  presses?: Press[];
  /** Reminder times the member typed. */
  chosen?: string[];
  /** Local "HH:mm" a peer logs it, and who. */
  peer?: { at: string; names: string[] };
}

interface Persona {
  name: string;
  /** What this one is here to prove. */
  asks: string;
  quiet?: Quiet;
  tracked: Tracked[];
}

const PERSONAS: Persona[] = [
  {
    name: "A. Nine activities, nothing logged",
    asks:
      "The production case. Nothing may claim progress, every line must name " +
      "its activity, and a day this empty should end with one sweep.",
    tracked: [
      { typeKey: "water", closes: "21:30" },
      { typeKey: "food", closes: "21:30" },
      { typeKey: "supplements", closes: "21:30" },
      { typeKey: "reading", closes: "21:30" },
      { typeKey: "study", closes: "21:30" },
      { typeKey: "steps", closes: "21:30" },
      { typeKey: "screen", closes: "21:30" },
      { typeKey: "gym", closes: "21:30" },
    ],
  },
  {
    name: "B. Partway through, a long streak, a live group",
    asks:
      "The peer line must arrive on the tick after Rahul logs, not hours " +
      "later, and the streak must be invoked only as the day runs out.",
    tracked: [
      {
        typeKey: "water",
        closes: "21:30",
        presses: [{ at: "08:30" }, { at: "10:00" }, { at: "12:00" }],
      },
      {
        typeKey: "supplements",
        closes: "21:30",
        streak: 24,
        presses: [{ at: "09:40" }],
      },
      {
        typeKey: "gym",
        closes: "20:00",
        streak: 6,
        peer: { at: "11:05", names: ["Rahul", "Priya"] },
      },
    ],
  },
  {
    name: "C. Everything done by noon",
    asks: "Exactly one notification, and it asks for nothing.",
    tracked: [
      {
        typeKey: "water",
        closes: "21:30",
        presses: Array.from({ length: 8 }, (_, i) => ({
          at: `0${6 + Math.floor(i / 2)}:${i % 2 ? "30" : "00"}`,
        })),
      },
      {
        typeKey: "supplements",
        closes: "21:30",
        presses: [{ at: "09:00" }, { at: "11:30" }],
      },
    ],
  },
  {
    name: "D. Gym, two of three, midweek",
    asks:
      "Gym's window is the whole WEEK. Every sentence must be about tonight " +
      "and none about Sunday, which is what the old code got wrong.",
    tracked: [
      {
        typeKey: "gym",
        closes: "23:59",
        streak: 3,
        presses: [{ at: "07:00" }],
      },
    ],
  },
  {
    name: "E. One activity, closing at 2:00 PM, untouched",
    asks:
      "Must escalate to a last call, and must not repeat itself on the way. " +
      "The engine cues at 12:00, 13:15 and 13:50; the middle one says exactly " +
      "what the first one said, so it is suppressed rather than sent.",
    tracked: [{ typeKey: "study", closes: "14:00" }],
  },
  {
    name: "F. Nothing scheduled (a declared pause)",
    asks: "Absolute silence, and in particular no 'all clear'.",
    tracked: [],
  },
  {
    name: "G. A late window, and a reminder the member typed at 10:30 PM",
    asks:
      "The 11:45 PM last call must be swallowed by quiet hours. The 10:30 PM " +
      "reminder they asked for must still arrive. This is the one place the " +
      "two rules disagree.",
    tracked: [
      { typeKey: "reading", closes: "23:45" },
      { typeKey: "study", closes: "23:45", chosen: ["22:30"] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Turning a persona into the day a tick sees
// ---------------------------------------------------------------------------

const localAt = (hhmm: string): DateTime =>
  DateTime.fromISO(`${DAY}T${hhmm}`, { zone: ZONE });

/**
 * What the module says is left, right now.
 *
 * The real `remind()`, with the type's own default config and schedule, so the
 * sentences printed below are the sentences that would ship. This is the half
 * of the copy that no bank may write (invariant 6) and the half that was
 * missing when "0 of 8 today." was read as progress.
 */
function leftFor(t: Tracked, instant: DateTime): string | null {
  const type = getActivityType(t.typeKey);
  const config = type.defaults.config;
  const schedule = type.defaults.schedule;
  const step = type.steps(config, DAY)[0];

  const checkins = (t.presses ?? [])
    .filter((p) => localAt(p.at) <= instant)
    .map((p) => ({
      step: step.key,
      at: localAt(p.at).toJSDate(),
      evidence: p.evidence ?? {},
    }));

  return (
    type.remind?.({
      periodStart: DAY,
      timezone: ZONE,
      config,
      schedule,
      checkins,
      step: step.key,
      pending: null,
    }) ?? null
  );
}

function viewAt(p: Persona, instant: DateTime, quiet: Quiet): DayView {
  const outstanding: Outstanding[] = [];
  let unfinished = 0;
  let logged = false;

  for (const t of p.tracked) {
    const pressed = (t.presses ?? []).filter((x) => localAt(x.at) <= instant);
    if (pressed.length > 0) logged = true;

    const left = leftFor(t, instant);
    if (left === null) continue;
    unfinished++;

    const closesAt = localAt(t.closes);
    if (closesAt <= instant) continue;

    const deadline = deadlineFor({
      closesAt: closesAt.toJSDate(),
      timezone: ZONE,
      instant: instant.toJSDate(),
      quiet,
    });

    outstanding.push({
      typeKey: t.typeKey,
      name: getActivityType(t.typeKey).name,
      left,
      closesAt: closesAt.toJSDate(),
      deadline: deadline.toJSDate(),
      closesLabel: deadline.toFormat("h:mm a"),
      minutesLeft: Math.round((deadline.toMillis() - instant.toMillis()) / 60_000),
      period: DAY,
      streak: t.streak ?? 0,
      streakUnit: periodUnit(getActivityType(t.typeKey).defaults.schedule),
    });
  }

  outstanding.sort((a, b) => a.minutesLeft - b.minutesLeft || b.streak - a.streak);

  return {
    outstanding,
    scheduledCount: p.tracked.length,
    unfinishedCount: unfinished,
    loggedAnythingToday: logged,
    timezone: ZONE,
    day: DAY,
  };
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

interface Delivered {
  at: string;
  kind: string;
  title: string;
  body: string;
  badge: number;
}

async function walk(p: Persona): Promise<Delivered[]> {
  const quiet = p.quiet ?? DEFAULT_QUIET;
  const sent: Sent[] = [];
  const out: Delivered[] = [];

  const chosen = new Map<string, string[]>();
  for (const t of p.tracked) if (t.chosen) chosen.set(t.typeKey, t.chosen);

  let cursor = localAt("00:00");
  const end = localAt("00:00").plus({ days: 1 });

  while (cursor < end) {
    const instant = cursor;
    const view = viewAt(p, instant, quiet);

    const ctx: Context = {
      userId: "sim-user",
      instant: instant.toJSDate(),
      slotMinutes: SLOT_MINUTES,
      slot: `${DAY}T${instant.toFormat("HH:mm")}`,
      view,
      quiet,
      chosen,
      sent,
      // Synchronous here, a query in production. The signature is what lets
      // one `decide` serve both.
      peers(o) {
        const t = p.tracked.find((x) => x.typeKey === o.typeKey);
        if (!t?.peer || localAt(t.peer.at) > instant) return Promise.resolve(null);
        const names = t.peer.names;
        const peers: Peers = {
          groupName: "Morning Crew",
          names: names.length <= 2 ? names : [],
          logged: names.length,
          of: names.length + 1,
        };
        return Promise.resolve(peers);
      },
    };

    const next = await decide(ctx);
    if (next) {
      sent.push({
        kind: next.kind,
        typeKey: next.typeKey,
        title: next.title,
        body: next.body,
      });
      out.push({
        at: instant.toFormat("HH:mm"),
        kind: next.kind,
        title: next.title,
        body: next.body,
        badge: next.count,
      });
    }

    cursor = cursor.plus({ minutes: SLOT_MINUTES });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Printing, and the rules a reader would not catch
// ---------------------------------------------------------------------------

const failures: string[] = [];

function fail(persona: string, why: string): void {
  failures.push(`${persona}: ${why}`);
}

function wrap(text: string, width: number, indent: string): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line.length + w.length + 1 > width) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : indent + l)).join("\n");
}

function report(p: Persona, sent: Delivered[]): void {
  console.log(`\n${"=".repeat(74)}`);
  console.log(p.name);
  console.log(wrap(p.asks, 72, ""));
  console.log("=".repeat(74));

  if (sent.length === 0) {
    console.log("\n  (nothing all day)");
  }

  for (const d of sent) {
    console.log("");
    console.log(`  ${d.at}  [${d.kind}]${d.badge ? `  badge ${d.badge}` : ""}`);
    console.log(`         ${d.title}`);
    console.log(`         ${wrap(d.body, 62, " ".repeat(9))}`);
  }

  console.log(`\n  ${sent.length} notification${sent.length === 1 ? "" : "s"}.`);

  // --- the rules ---------------------------------------------------------
  const quiet = p.quiet ?? DEFAULT_QUIET;
  const seen = new Set<string>();

  for (const d of sent) {
    if (d.body.length > 120) fail(p.name, `body over 120 chars at ${d.at}`);
    if (d.title.length > 60) fail(p.name, `title over 60 chars at ${d.at}`);
    if (/[–—]/.test(d.title + d.body)) {
      fail(p.name, `em-dash at ${d.at}`);
    }

    const key = `${d.title}|${d.body}`;
    if (seen.has(key)) fail(p.name, `sent the same words twice, at ${d.at}`);
    seen.add(key);

    // The whole reason for the rewrite: nothing may read as progress when
    // there is none.
    if (/almost|nearly|so close|one more/i.test(`${d.title} ${d.body}`)) {
      fail(p.name, `claims progress at ${d.at}: ${d.title}`);
    }

    // Quiet hours, with no exception for urgency. A member-typed cue is the
    // one thing allowed through the DEFAULT band, so it is exempt here.
    const at = localAt(d.at);
    const mins = at.hour * 60 + at.minute;
    const [fh, fm] = quiet.from.split(":").map(Number);
    const [th, tm] = quiet.to.split(":").map(Number);
    const from = fh * 60 + fm;
    const to = th * 60 + tm;
    const inBand = from > to ? mins >= from || mins < to : mins >= from && mins < to;
    const typed = p.tracked.some((t) => t.chosen?.includes(d.at));
    if (inBand && !typed) fail(p.name, `sent inside quiet hours at ${d.at}`);
  }
}

// ---------------------------------------------------------------------------

console.log("");
console.log("A day of Curfew notifications, at the real 15 minute tick.");
console.log(`${ZONE}, ${DAY}. Quiet hours 9:30 PM to 8:00 AM unless stated.`);

for (const p of PERSONAS) {
  report(p, await walk(p));
}

console.log(`\n${"=".repeat(74)}`);
if (failures.length === 0) {
  console.log("Every rule held.");
  console.log("");
  console.log("Read the notifications above rather than trusting this line.");
  console.log("The rules catch lengths, repeats and silence. They cannot catch");
  console.log("a sentence that is clear to whoever wrote it and to nobody else.");
} else {
  console.log(`${failures.length} FAILED:`);
  for (const f of failures) console.log(`  ${f}`);
  process.exitCode = 1;
}
console.log("");

export {};
