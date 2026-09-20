// How long can a period sit unscored after it becomes scorable?
//
//   bun run check:cron
//
// A period cannot be scored until two things are true: the period has ended,
// and every window inside it has closed. Both are LOCAL to the member. The
// schedule is not, so the two can disagree and nothing says so.
//
// They have disagreed twice, and the second time is why this file now reads a
// table of QStash jobs instead of `vercel.json`.
//
// ONCE: `0 4 * * *` is 9:30 AM in Kolkata, and a sleep night runs local noon to
// noon, so at 9:30 the night that just passed had not ended. It was scored by
// the NEXT day's run and the fine posted about thirty six hours after the
// morning it was owed. Every screen looked right, because a read closes periods
// lazily; only the ledger lagged. The fix was `0 7 * * *` and this check.
//
// TWICE: a member joined from Europe/Berlin. Their sleep shuts at 08:00 UTC and
// the job ran at 07:00 UTC, thirty three minutes early, every single day. Their
// score, streak and group outcome were permanently a day behind. This check did
// not catch it, and the reason is the line it used to carry here:
//
//     one daily cron is early or late for somebody whatever you pick, so it is
//     set for the people who actually use it
//
// That was an accurate description of a one-firing-a-day schedule and it stopped
// being acceptable the moment two timezones used the app. A single daily firing
// cannot serve more than one span of them, and moving the hour only moves the
// cliff west. So scoring runs HOURLY, on QStash, and the question this file asks
// changed with it: not "is the one firing late" but "how long is the worst wait,
// anywhere on earth".
//
// No database, no server. It reads the cadence out of scripts/schedule-jobs.ts
// and asks each registered module, at its own defaults, when its period becomes
// scorable.
import { readFileSync } from "node:fs";
import { DateTime } from "luxon";
import {
  getActivityType,
  periodUnit,
  registeredKeys,
  type DayBoundary,
  type PeriodUnit,
} from "@/domain";

// Every zone a member has actually been in, plus the ends of the inhabited
// range. The Kolkata-only version of this check is what missed Berlin, so the
// cheapest guard against a third time is to ask about somewhere nobody has
// signed up from yet.
const ZONES = [
  "Pacific/Auckland",
  "Asia/Kolkata",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Pacific/Honolulu",
];

/** The longest a period may wait between becoming scorable and being scored. */
const BUDGET_HOURS = 1;

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed++;
}

// ---------------------------------------------------------------------------
// The schedule, as declared
// ---------------------------------------------------------------------------

const jobs = readFileSync("scripts/schedule-jobs.ts", "utf8");

/** The cron string a job in that table carries, read out of the source. */
function cadenceOf(path: string): string | null {
  const at = jobs.indexOf(`path: "${path}"`);
  if (at === -1) return null;
  return /cron:\s*"([^"]+)"/.exec(jobs.slice(at))?.[1] ?? null;
}

// Nothing may put a Vercel cron back. Two schedulers is two places to look when
// a job did not run, and a job that silently never fires is the failure that
// costs a day to notice.
interface Vercel {
  crons?: unknown[];
}
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as Vercel;
check(
  "vercel.json declares no crons, so QStash owns the whole schedule",
  vercel.crons === undefined,
  vercel.crons ? JSON.stringify(vercel.crons) : "",
);

const score = cadenceOf("/api/cron/score");
if (!score) {
  console.error("No /api/cron/score job in scripts/schedule-jobs.ts.");
  process.exit(1);
}

// `m * * * *`: every hour, at a fixed minute. Anything coarser reintroduces the
// bug; anything finer is fine but this check does not know how to read it.
const parts = score.trim().split(/\s+/);
const minute = Number(parts[0]);
if (parts.length !== 5 || parts.slice(1).join(" ") !== "* * * *" || !Number.isInteger(minute)) {
  console.error(`Unexpected scoring cadence '${score}'. This check reads 'm * * * *'.`);
  process.exit(1);
}

// The reminder route's SLOT_MINUTES is its idempotency key and its own comment
// asks a human to keep it in step with the schedule. Ask the machine instead.
const remind = cadenceOf("/api/cron/remind");
const slotMinutes = Number(
  /SLOT_MINUTES\s*=\s*(\d+)/.exec(
    readFileSync("src/app/api/cron/remind/route.ts", "utf8"),
  )?.[1],
);
check(
  "the reminder cadence and SLOT_MINUTES still agree",
  remind === `*/${slotMinutes} * * * *`,
  `${remind} against SLOT_MINUTES ${slotMinutes}`,
);

// ---------------------------------------------------------------------------
// The wait, per module, per zone
// ---------------------------------------------------------------------------

/** When the period labelled `day` ends, as an instant. */
function periodEnd(day: string, unit: PeriodUnit, boundary: DayBoundary, zone: string): DateTime {
  const start = DateTime.fromISO(day, { zone })
    .startOf("day")
    .plus({ hours: boundary === "noon" ? 12 : 0 });
  return start.plus({ days: unit === "week" ? 7 : 1 });
}

/** The first instant at which the period labelled `day` can be scored. */
function scorableAt(key: string, day: string, zone: string): DateTime {
  const type = getActivityType(key);
  const unit = periodUnit(type.defaults.schedule);
  const ends = periodEnd(day, unit, type.defaults.dayBoundary, zone);
  const closes = type
    .windows(type.defaults.config, day, zone)
    .map((w) => DateTime.fromJSDate(w.closesAt, { zone }));
  return closes.reduce((latest, c) => (c > latest ? c : latest), ends);
}

console.log(`scoring ${score}, at most ${BUDGET_HOURS}h of wait allowed\n`);

// Seven consecutive days of firings, so a weekday-only schedule or a week
// boundary cannot hide behind the one day this happened to be run.
const days = Array.from({ length: 7 }, (_, i) =>
  DateTime.fromObject({ year: 2026, month: 9, day: 7 + i }, { zone: "utc" }),
);

for (const key of registeredKeys().sort()) {
  const type = getActivityType(key);
  const unit = periodUnit(type.defaults.schedule);
  let worst: { wait: number; zone: string; day: string } | null = null;

  for (const zone of ZONES) {
    for (const midnight of days) {
      const day =
        unit === "week"
          ? midnight.setZone(zone).startOf("week").toFormat("yyyy-MM-dd")
          : midnight.setZone(zone).toFormat("yyyy-MM-dd");

      const ready = scorableAt(key, day, zone);
      // The next firing at or after the moment it became scorable. The job runs
      // at `minute` past every hour, so this is the ceiling of that.
      let run = ready.toUTC().set({ minute, second: 0, millisecond: 0 });
      if (run < ready) run = run.plus({ hours: 1 });

      const wait = run.diff(ready, "hours").hours;
      if (!worst || wait > worst.wait) worst = { wait, zone, day };
    }
  }

  const w = worst!;
  check(
    `${key} is scored within ${BUDGET_HOURS}h of closing, anywhere`,
    w.wait <= BUDGET_HOURS,
    `worst ${w.wait.toFixed(2)}h, ${w.zone}, ${w.day}`,
  );
}

console.log(
  failed === 0
    ? `\nNo period waits more than ${BUDGET_HOURS}h to be scored, in any of ${ZONES.length} zones.`
    : `\n${failed} FAILED. Somebody's day is judged late, and it will be the same somebody every day.`,
);
process.exit(failed === 0 ? 0 : 1);
