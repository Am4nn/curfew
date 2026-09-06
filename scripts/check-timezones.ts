// Days belong to the member, not to Greenwich.
//
//   bun run check:timezones
//
// When a config change takes effect. Every effective-dated write is dated
// "tomorrow" (invariant 4), and tomorrow is a day in the member's own zone.
// Read in UTC, a change saved late in the evening in Kiritimati landed on a
// date that member was already living, so it took effect at once and rewrote a
// period in progress. Saved in the morning in Midway it landed two of their
// days out and did nothing tomorrow.
//
// Local only. It builds two throwaway accounts, pins the clock, and deletes
// everything it made.
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
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
import { userDay } from "@/server/config";
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

} finally {
  setClock(null);
  await cleanup();
}

console.log(
  failed === 0 ? "\nTomorrow is the member's, not Greenwich's." : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
