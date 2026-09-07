// Days belong to the member, not to Greenwich.
//
//   bun run check:timezones
//
// Two questions, both of which the app used to answer with UTC:
//
//   1. When a config change takes effect. Every effective-dated write is dated
//      "tomorrow" (invariant 4), and tomorrow is a day in the member's own zone.
//      Read in UTC, a change saved late in the evening in Kiritimati landed on a
//      date that member was already living, so it took effect at once and
//      rewrote a period in progress. Saved in the morning in Midway it landed
//      two of their days out and did nothing tomorrow.
//
//   2. Which zone a PAST period is judged in. `recomputeUser` resolved the zone
//      once, for today, and replayed all of history in it, so changing country
//      re-judged every night already scored.
//
// Local only. It builds two throwaway accounts, pins the clock, and deletes
// everything it made.
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  users,
  userApprovals,
  userSettings,
  userActivities,
  userActivityConfig,
  activityScores,
  activityStreaks,
  activityOutcomes,
  reputationDaily,
  consentRecords,
  events,
} from "@/db/schema";
import { setInitialTimezone, updateTimezone, updateSleepWindows } from "@/server/settings";
import { getCheckinState, performCheckin } from "@/server/checkin";
import { userDay } from "@/server/config";
import { WATER_STEP } from "@/domain";
import { scoreUser } from "@/server/scoring";
import { recomputeStreak } from "@/server/streak";
import { getActivityType } from "@/domain";
import { CONSENT_VERSION } from "@/server/consent";
import { setClock } from "@/lib/clock";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:timezones is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const tag = `tzc-${randomUUID().slice(0, 6)}`;
const made: string[] = [];

async function person(suffix: string): Promise<string> {
  const id = `${tag}-${suffix}`;
  await db.insert(users).values({
    id,
    name: `Zone ${suffix}`,
    email: `${id}@example.invalid`,
    emailVerified: true,
  });
  await db.insert(userApprovals).values({
    userId: id,
    status: "approved",
    decidedAt: new Date(),
  });
  await db.insert(consentRecords).values({ userId: id, version: CONSENT_VERSION });
  made.push(id);
  return id;
}

/** The one row of a kind this user has, latest first. */
async function settingsRows(userId: string) {
  return db
    .select({
      effectiveFrom: userSettings.effectiveFrom,
      timezone: userSettings.timezone,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .orderBy(asc(userSettings.effectiveFrom));
}

async function cleanup() {
  if (made.length === 0) return;
  await db.delete(reputationDaily).where(inArray(reputationDaily.userId, made));
  await db.delete(activityOutcomes).where(inArray(activityOutcomes.userId, made));
  await db.delete(activityScores).where(inArray(activityScores.userId, made));
  await db.delete(activityStreaks).where(inArray(activityStreaks.userId, made));
  await db.delete(events).where(inArray(events.userId, made));
  await db.delete(userActivityConfig).where(inArray(userActivityConfig.userId, made));
  await db.delete(userActivities).where(inArray(userActivities.userId, made));
  await db.delete(userSettings).where(inArray(userSettings.userId, made));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, made));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, made));
  await db.delete(users).where(inArray(users.id, made));
}

try {
  // -------------------------------------------------------------------------
  // 1. A config change lands on the MEMBER'S tomorrow
  // -------------------------------------------------------------------------
  console.log("\nWHEN A CHANGE TAKES EFFECT");

  // Noon UTC is already tomorrow in Kiritimati (UTC+14). Read in UTC, a change
  // saved at this instant is dated to a day this member has been living for
  // twelve hours.
  const east = await person("east");
  setClock(new Date("2026-03-10T12:00:00Z"));
  await setInitialTimezone(east, "Pacific/Kiritimati");

  check("the member's day is not the UTC day", (await userDay(east)) === "2026-03-11", await userDay(east));

  await updateTimezone(east, "Europe/Lisbon");
  const eastRows = await settingsRows(east);
  const eastChange = eastRows.find((r) => r.timezone === "Europe/Lisbon");
  check(
    "a zone change lands the day after the member's day, not after the UTC one",
    eastChange?.effectiveFrom === "2026-03-12",
    eastChange?.effectiveFrom ?? "no row",
  );
  check(
    "and it did not overwrite the row already in force today",
    eastRows.some((r) => r.effectiveFrom === "2026-03-11" && r.timezone === "Pacific/Kiritimati"),
    eastRows.map((r) => `${r.effectiveFrom}=${r.timezone}`).join(" "),
  );

  await updateSleepWindows(east, getActivityType("sleep").defaults.config);
  const [sleepRow] = await db
    .select({ effectiveFrom: userActivityConfig.effectiveFrom })
    .from(userActivityConfig)
    .where(
      and(eq(userActivityConfig.userId, east), eq(userActivityConfig.typeKey, "sleep")),
    );
  check(
    "a windows change lands on the same day",
    sleepRow?.effectiveFrom === "2026-03-12",
    sleepRow?.effectiveFrom ?? "no row",
  );

  // Two in the morning UTC is still yesterday in Midway (UTC-11). Read in UTC,
  // a change saved here is dated two of this member's days out.
  const west = await person("west");
  setClock(new Date("2026-03-10T02:00:00Z"));
  await setInitialTimezone(west, "Pacific/Midway");

  check("the member's day is behind the UTC day", (await userDay(west)) === "2026-03-09", await userDay(west));

  await updateTimezone(west, "Europe/Lisbon");
  const westChange = (await settingsRows(west)).find((r) => r.timezone === "Europe/Lisbon");
  check(
    "and a change west of Greenwich lands tomorrow rather than the day after",
    westChange?.effectiveFrom === "2026-03-10",
    westChange?.effectiveFrom ?? "no row",
  );

  // -------------------------------------------------------------------------
  // 2. Moving country does not re-judge the past
  // -------------------------------------------------------------------------
  console.log("\nWHICH ZONE A PAST NIGHT IS JUDGED IN");

  const mover = await person("mover");
  const START = "2026-02-01";

  // Living in Kolkata since the first of February, with sleep tracked.
  await db.insert(userSettings).values({
    userId: mover,
    timezone: "Asia/Kolkata",
    effectiveFrom: START,
  });
  const sleep = getActivityType("sleep");
  await db.insert(userActivityConfig).values({
    userId: mover,
    typeKey: "sleep",
    effectiveFrom: START,
    config: {
      schedule: {
        schedule: sleep.defaults.schedule,
        dayBoundary: sleep.defaults.dayBoundary,
        grace: 0,
      },
      config: sleep.defaults.config,
    },
  });
  await db.insert(userActivities).values({
    userId: mover,
    typeKey: "sleep",
    enabled: true,
    effectiveAt: new Date(`${START}T00:00:00+05:30`),
  });

  // A fortnight of nights, each pressed inside the Kolkata windows: 10:30 PM,
  // then 7:00 and 8:00 the next morning, IST. The same three instants read in
  // Lisbon are the afternoon and the small hours, so every one of them falls
  // outside every window there. That is what makes the two zones disagree
  // loudly enough for this to be worth checking.
  const NIGHTS = 14;
  const at = (day: DateTime, plusDays: number, hhmm: string) =>
    DateTime.fromISO(`${day.plus({ days: plusDays }).toFormat("yyyy-MM-dd")}T${hhmm}:00`, {
      zone: "Asia/Kolkata",
    }).toJSDate();

  for (let i = 0; i < NIGHTS; i += 1) {
    const day = DateTime.fromISO(START, { zone: "utc" }).plus({ days: i });
    const period = day.toFormat("yyyy-MM-dd");
    for (const [step, when] of [
      ["night", at(day, 0, "22:30")],
      ["wake", at(day, 1, "07:00")],
      ["confirm", at(day, 1, "08:00")],
    ] as const) {
      await db.insert(events).values({
        userId: mover,
        type: `checkin.sleep.${step}`,
        occurredAt: when,
        payload: { type_key: "sleep", period_start: period, step, idem: `${tag}-${period}-${step}` },
      });
    }
  }

  // Score it as they lived it, then read the verdicts back.
  setClock(new Date("2026-02-20T06:00:00+05:30"));
  await scoreUser(mover, { fines: false });
  const before = await db
    .select({
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
      detail: activityScores.detail,
    })
    .from(activityScores)
    .where(eq(activityScores.userId, mover))
    .orderBy(asc(activityScores.periodStart));

  const nights = before.filter((r) => r.periodStart < "2026-02-15");
  const streakBefore = await recomputeStreak(mover, "sleep");
  check("the fortnight was scored", nights.length === NIGHTS, `${nights.length} of ${before.length} periods`);
  check(
    "and every night of it passed",
    nights.every((r) => r.passed),
    `${nights.filter((r) => r.passed).length} passed`,
  );

  // They move. The change is dated forward, the way every config change is.
  await updateTimezone(mover, "Europe/Lisbon");
  const moved = (await settingsRows(mover)).find((r) => r.timezone === "Europe/Lisbon");
  check("the move is dated forward", moved?.effectiveFrom === "2026-02-21", moved?.effectiveFrom ?? "no row");

  // A day later, in Lisbon, the whole history is replayed again.
  setClock(new Date("2026-02-22T06:00:00+00:00"));
  await scoreUser(mover, { fines: false });
  const after = await db
    .select({
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
      detail: activityScores.detail,
    })
    .from(activityScores)
    .where(eq(activityScores.userId, mover))
    .orderBy(asc(activityScores.periodStart));

  const past = new Map(after.map((r) => [r.periodStart, r]));
  const changed = before.filter((r) => {
    const now = past.get(r.periodStart);
    return (
      !now ||
      now.passed !== r.passed ||
      JSON.stringify(now.detail) !== JSON.stringify(r.detail)
    );
  });
  check(
    "moving country re-judged nothing already scored",
    changed.length === 0,
    changed.length === 0
      ? ""
      : `${changed.length} nights changed, first ${changed[0].periodStart}`,
  );

  // The streak is rebuilt from those same periods, so it is the number a person
  // would actually see go.
  const streakAfter = await recomputeStreak(mover, "sleep");
  check(
    "and the streak they had is the streak they still have",
    streakBefore?.best === streakAfter?.best,
    `${streakAfter?.best ?? "none"} was ${streakBefore?.best ?? "none"}`,
  );

  // -------------------------------------------------------------------------
  // 3. Which day a press made TODAY belongs to
  // -------------------------------------------------------------------------
  console.log("\nWHICH DAY A PRESS BELONGS TO");

  // The case the first section fixed for writes, asked of reads. A member's
  // first zone is dated from their own today, and east of Greenwich that is a
  // date UTC has not reached, so a lookup keyed on the UTC day cannot see the
  // row that is in force. Everything downstream is then computed in the seeded
  // default: the wrong windows on the board, and a press filed under the wrong
  // day.
  const presser = await person("press");
  setClock(new Date("2026-03-10T12:00:00Z"));
  await setInitialTimezone(presser, "Pacific/Kiritimati");
  check(
    "the member is a day ahead of UTC",
    (await userDay(presser)) === "2026-03-11",
    `${await userDay(presser)} while UTC is 2026-03-10`,
  );

  const water = getActivityType("water");
  await db.insert(userActivityConfig).values({
    userId: presser,
    typeKey: "water",
    effectiveFrom: "2026-03-01",
    config: {
      schedule: {
        schedule: water.defaults.schedule,
        dayBoundary: water.defaults.dayBoundary,
        grace: 0,
      },
      config: water.defaults.config,
    },
  });
  await db.insert(userActivities).values({
    userId: presser,
    typeKey: "water",
    enabled: true,
    effectiveAt: new Date("2026-03-01T00:00:00+14:00"),
  });

  const board = await getCheckinState(presser, "water");
  check(
    "the check-in board is on the member's day",
    board?.period === "2026-03-11",
    `${board?.period ?? "no board"}, and the zone read as ${board?.timezone ?? "none"}`,
  );

  const press = await performCheckin(presser, null, {
    typeKey: "water",
    step: WATER_STEP,
    idem: `${tag}-press`,
    evidence: {},
  });
  const [filed] = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, presser), eq(events.type, `checkin.water.${WATER_STEP}`)));
  const filedUnder = (filed?.payload as { period_start?: string } | null)?.period_start;
  check(
    "and the press is filed under it",
    press.ok && filedUnder === "2026-03-11",
    press.ok ? `filed under ${filedUnder ?? "nothing"}` : `refused: ${press.reason}`,
  );
} finally {
  setClock(null);
  await cleanup();
}

console.log(
  failed === 0
    ? "\nA day is the member's, and a night is judged in the zone it was slept in."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
