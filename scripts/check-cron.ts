// Does the nightly job run late enough to score last night?
//
//   bun run check:cron
//
// A period cannot be scored until two things are true: the period has ended,
// and every window inside it has closed. `vercel.json` schedules the job in
// UTC and every member lives in a local zone, so the two can disagree and
// nothing says so. They did: `0 4 * * *` is 9:30 AM in Kolkata, and a sleep
// night runs local noon to noon, so at 9:30 the night that just passed had not
// ended. It was scored by the NEXT day's run, and the fine posted about thirty
// six hours after the morning it was owed. Every screen looked right, because a
// read closes periods lazily; only the ledger lagged.
//
// No database, no server. It reads the schedule out of vercel.json and asks
// each registered module, at its own defaults, when its period becomes
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

// The zone the members are in. Everything here is judged from one place on
// purpose: one daily cron is early or late for somebody whatever you pick, so
// it is set for the people who actually use it. `JURISDICTION.city` is
// Bengaluru and `DEFAULT_ZONE` in src/server/config.ts is this.
const ZONE = "Asia/Kolkata";

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed++;
}

interface Vercel {
  crons?: { path: string; schedule: string }[];
}
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as Vercel;
const cron = vercel.crons?.find((c) => c.path === "/api/cron/score");
if (!cron) {
  console.error("No cron for /api/cron/score in vercel.json.");
  process.exit(1);
}

// Vercel schedules in UTC, and only the daily shape is expected here.
const parts = cron.schedule.trim().split(/\s+/);
const [minute, hour] = parts.map(Number);
if (parts.length !== 5 || parts.slice(2).join(" ") !== "* * *" || !Number.isInteger(hour)) {
  console.error(`Unexpected schedule '${cron.schedule}'. This check reads 'm h * * *'.`);
  process.exit(1);
}

/** When the period labelled `day` ends, as an instant. */
function periodEnd(day: string, unit: PeriodUnit, boundary: DayBoundary): DateTime {
  const start = DateTime.fromISO(day, { zone: ZONE })
    .startOf("day")
    .plus({ hours: boundary === "noon" ? 12 : 0 });
  return start.plus({ days: unit === "week" ? 7 : 1 });
}

/** The first instant at which the period labelled `day` can be scored. */
function scorableAt(key: string, day: string): DateTime {
  const type = getActivityType(key);
  const unit = periodUnit(type.defaults.schedule);
  const ends = periodEnd(day, unit, type.defaults.dayBoundary);
  const closes = type
    .windows(type.defaults.config, day, ZONE)
    .map((w) => DateTime.fromJSDate(w.closesAt, { zone: ZONE }));
  return closes.reduce((latest, c) => (c > latest ? c : latest), ends);
}

// Seven consecutive firings, so a weekday-only schedule or a week boundary
// cannot hide behind the one day this happened to be run.
const firings = Array.from({ length: 7 }, (_, i) =>
  DateTime.fromObject(
    { year: 2026, month: 9, day: 7 + i, hour, minute },
    { zone: "utc" },
  ).setZone(ZONE),
);

console.log(
  `schedule ${cron.schedule} = ${firings[0].toFormat("h:mm a")} in ${ZONE}\n`,
);

for (const key of registeredKeys().sort()) {
  const type = getActivityType(key);
  const unit = periodUnit(type.defaults.schedule);
  let worst: { at: DateTime; ready: DateTime; day: string } | null = null;

  for (const at of firings) {
    // Yesterday's activity-day, which is the one today's run owes an answer
    // for. A day labelled with yesterday's date is what a member calls "last
    // night" or "yesterday", whatever boundary the type uses, and the decision
    // is that its fine posts on the following morning's run.
    //
    // A week is different: it is not late until it has ended, and waiting for
    // Sunday to finish is the design rather than a delay.
    const day =
      unit === "week"
        ? at.minus({ days: 1 }).startOf("week").toFormat("yyyy-MM-dd")
        : at.minus({ days: 1 }).toFormat("yyyy-MM-dd");
    if (unit === "week" && periodEnd(day, unit, type.defaults.dayBoundary) > at) continue;

    // Both halves in one number: a period that has not ended is not scorable,
    // and neither is one whose last window is still open.
    const ready = scorableAt(key, day);
    if (ready > at && (!worst || ready.diff(at) > worst.ready.diff(worst.at))) {
      worst = { at, ready, day };
    }
  }

  const late = worst
    ? `${key} ${worst.day} was scorable ${worst.ready.toFormat("h:mm a")}, the run was ${worst.at.toFormat("h:mm a")}`
    : "";
  check(`${key} scores the period that just ended`, worst === null, late);
}

console.log(
  failed === 0
    ? "\nThe job runs after every default period becomes scorable. A fine posts the next run."
    : `\n${failed} FAILED. A fine posts a whole day after the one it is owed.`,
);
process.exit(failed === 0 ? 0 : 1);
