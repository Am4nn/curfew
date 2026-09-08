// Does the first thing you ever do count?
//
//   bun run check:streak
//
// A streak is the one number that moves the instant you press a button, and it
// is maintained in three places: the press bumps it, the close rebuilds it, and
// `verify` diffs the two. This checks the case all three of them got wrong at
// once, which is the very first one a member meets.
//
// `bumpStreak` has no stored row to add to the first time a type is counted, so
// it rebuilds instead. The rebuild read `activity_scores`, found nothing,
// because nothing has closed yet, and returned an empty history: the session
// that had just happened was thrown away and the streak read 0. For a daily
// type the overnight close repaired it. For gym, whose period is a week, a new
// member saw 0 for up to seven days after going to the gym.
//
// Local only. It builds a throwaway account and deletes it again.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  users,
  userApprovals,
  consentRecords,
  userSettings,
  userActivities,
  userActivityConfig,
  activityStreaks,
  activityScores,
  activityOutcomes,
  reputationDaily,
  events,
  evidence,
} from "@/db/schema";
import { getActivityType } from "@/domain";
import { CONSENT_VERSION } from "@/server/consent";
import { readStreak, closeStreaks, recomputeStreak } from "@/server/streak";
import { performCheckin, getCheckinState } from "@/server/checkin";
import { now } from "@/lib/clock";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:streak is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const id = `streakc-${randomUUID().slice(0, 6)}`;

async function track(typeKey: string, config?: unknown) {
  const type = getActivityType(typeKey);
  await db.insert(userActivityConfig).values({
    userId: id,
    typeKey,
    effectiveFrom: "2026-01-01",
    config: {
      schedule: {
        schedule: type.defaults.schedule,
        dayBoundary: type.defaults.dayBoundary,
        grace: type.defaults.grace,
      },
      config: config ?? type.defaults.config,
    },
  });
  await db.insert(userActivities).values({
    userId: id,
    typeKey,
    enabled: true,
    effectiveAt: new Date("2026-01-01T00:00:00+05:30"),
  });
}

/** A press, with the photograph the type asks for if it asks for one. */
async function press(typeKey: string, step: string, tag: string) {
  const state = await getCheckinState(id, typeKey);
  if (!state) throw new Error(`${typeKey} is not tracked`);
  const type = getActivityType(typeKey);
  const idem = `${id}-${tag}`;
  let evidenceKey: string | undefined;

  if (type.evidence.level === "required") {
    evidenceKey = `check-streak/${idem}.png`;
    const at = await now();
    await db.insert(evidence).values({
      userId: id,
      typeKey,
      step,
      periodStart: state.period,
      idem,
      objectKey: evidenceKey,
      contentType: "image/jpeg",
      bytes: 1000,
      requestedAt: at,
      deleteAfter: DateTime.fromJSDate(at, { zone: "utc" })
        .plus({ days: 60 })
        .toFormat("yyyy-MM-dd"),
    });
  }

  return performCheckin(id, null, { typeKey, step, idem, evidence: {}, evidenceKey });
}

async function cleanup() {
  await db.delete(reputationDaily).where(inArray(reputationDaily.userId, [id]));
  await db.delete(activityOutcomes).where(inArray(activityOutcomes.userId, [id]));
  await db.delete(activityScores).where(inArray(activityScores.userId, [id]));
  await db.delete(activityStreaks).where(inArray(activityStreaks.userId, [id]));
  await db.delete(evidence).where(inArray(evidence.userId, [id]));
  await db.delete(events).where(inArray(events.userId, [id]));
  await db.delete(userActivityConfig).where(inArray(userActivityConfig.userId, [id]));
  await db.delete(userActivities).where(inArray(userActivities.userId, [id]));
  await db.delete(userSettings).where(inArray(userSettings.userId, [id]));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [id]));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, [id]));
  await db.delete(users).where(inArray(users.id, [id]));
}

try {
  await db.insert(users).values({
    id,
    name: "Streak check",
    email: `${id}@example.invalid`,
    emailVerified: true,
  });
  await db.insert(userApprovals).values({ userId: id, status: "approved", decidedAt: new Date() });
  await db.insert(consentRecords).values({ userId: id, version: CONSENT_VERSION });
  await db.insert(userSettings).values({
    userId: id,
    timezone: "Asia/Kolkata",
    effectiveFrom: "2026-01-01",
  });

  // A WEEKLY type, which is the one that stayed wrong for a week.
  await track("gym");
  const gym = await press("gym", "session", "gym");
  check("the first gym session is recorded", gym.ok, JSON.stringify(gym));
  check("and it counts at once", (await readStreak(id, "gym"))?.current === 1, `${(await readStreak(id, "gym"))?.current}`);

  // The close is the half that used to take it away again.
  await closeStreaks(id);
  check(
    "and a page read does not take it back",
    (await readStreak(id, "gym"))?.current === 1,
    `${(await readStreak(id, "gym"))?.current}`,
  );
  check(
    "and a rebuild from events agrees",
    (await recomputeStreak(id, "gym"))?.current === 1,
    `${(await recomputeStreak(id, "gym"))?.current}`,
  );

  // A second session the same day is one day at the gym, not two.
  await press("gym", "session", "gym2");
  await closeStreaks(id);
  check(
    "a second session the same day adds nothing",
    (await readStreak(id, "gym"))?.current === 1,
    `${(await readStreak(id, "gym"))?.current}`,
  );

  // A DAILY type, whose first day is the same case one period shorter. Its
  // window is widened to the whole day because office arrives between 10 AM and
  // 2 PM by default, and this check is not about the hour it runs at.
  await track("office", { window: { open: "00:00", close: "23:59" } });
  const office = await press("office", "arrive", "office");
  check("the first office arrival is recorded", office.ok, JSON.stringify(office));
  check(
    "and it counts at once too",
    (await readStreak(id, "office"))?.current === 1,
    `${(await readStreak(id, "office"))?.current}`,
  );
  await closeStreaks(id);
  check(
    "and survives the read",
    (await readStreak(id, "office"))?.current === 1,
    `${(await readStreak(id, "office"))?.current}`,
  );
} finally {
  await cleanup();
}

console.log(
  failed === 0
    ? "\nThe first thing you ever do counts, and the next read does not take it back."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
