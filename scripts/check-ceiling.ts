// Does the ceiling follow what you actually do?
//
//   bun run check:ceiling
//
// Reported as "in a group where I haven't added many of the activities it
// accepts, the ceiling is still 1000, why?".
//
// A group's breadth is the types you share over the types it accepts, and the
// ceiling is 250 + 750b. Share two of five and 1000 is out of reach, which is
// the rule as designed and the rule the person who asked for this wanted.
//
// `setShare` already refuses to share a type you do not track, so the two were
// meant to move together. `stopTracking` was the one place they came apart: it
// wrote the switch off and left the share row standing. The type could no
// longer produce a period, so it could never be missed, and it held the
// ceiling up for nothing. The sharing screen went on saying the group would be
// shown something it never would.
//
// So this tracks two types, shares both, stops tracking one, and asks what the
// group sees. And it asks the same question of the day BEFORE the stop, which
// has to answer the other way: a ceiling drops from today, it does not reach
// back and rewrite a day already scored (invariant 5).
//
// Local only. It builds a throwaway group and deletes it again.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  userApprovals,
  consentRecords,
  userSettings,
  userActivities,
  userActivityConfig,
  groups,
  groupMembers,
  groupActivityTypes,
  memberShares,
} from "@/db/schema";
import { defaultsFor, stopTracking } from "@/server/activities";
import { setShare, sharesFor } from "@/server/sharing";
import { ceilingFor } from "@/domain";
import { CONSENT_VERSION } from "@/server/consent";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:ceiling is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const id = `ceil-${randomUUID().slice(0, 6)}`;
const groupId = randomUUID();

/** Two of them, so breadth can be a half rather than only nought or one. */
const ACCEPTED = ["gym", "office"] as const;
const DROPPED = "gym";

async function cleanup() {
  await db.delete(memberShares).where(inArray(memberShares.userId, [id]));
  await db.delete(groupActivityTypes).where(inArray(groupActivityTypes.groupId, [groupId]));
  await db.delete(groupMembers).where(inArray(groupMembers.groupId, [groupId]));
  await db.delete(groups).where(inArray(groups.id, [groupId]));
  await db.delete(userActivityConfig).where(inArray(userActivityConfig.userId, [id]));
  await db.delete(userActivities).where(inArray(userActivities.userId, [id]));
  await db.delete(userSettings).where(inArray(userSettings.userId, [id]));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [id]));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, [id]));
  await db.delete(users).where(inArray(users.id, [id]));
}

/** Track a type, at the module's own defaults. */
async function track(typeKey: string) {
  const d = defaultsFor(typeKey);
  await db.insert(userActivities).values({
    userId: id,
    typeKey,
    enabled: true,
    effectiveAt: new Date(Date.now() - 60_000),
  });
  await db.insert(userActivityConfig).values({
    userId: id,
    typeKey,
    effectiveFrom: "2026-01-01",
    config: { schedule: d.schedule, config: d.config },
  });
}

/** What the scoring pass would see: breadth, and the ceiling it allows. */
async function seen(asOf: Date) {
  const shares = await sharesFor(groupId, id, asOf);
  const sharedKeys = new Set(shares.filter((s) => s.shared).map((s) => s.typeKey));
  const counted = ACCEPTED.filter((a) => sharedKeys.has(a));
  return {
    shared: [...sharedKeys].sort(),
    ceiling: ceilingFor(counted.length / ACCEPTED.length),
  };
}

try {
  await db.insert(users).values({
    id,
    name: "Ceiling check",
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

  await db.insert(groups).values({ id: groupId, name: `Ceiling ${id}`, createdBy: id });
  await db.insert(groupMembers).values({
    groupId,
    userId: id,
    role: "owner",
    joinedAt: "2026-01-01",
  });
  for (const typeKey of ACCEPTED) {
    await db.insert(groupActivityTypes).values({ groupId, typeKey, accepted: true });
    await track(typeKey);
  }

  // Both tracked and both shared: the whole of what the group accepts.
  for (const typeKey of ACCEPTED) {
    await setShare({
      groupId,
      userId: id,
      typeKey,
      shared: true,
      shareEvidence: false,
      changedBy: id,
    });
  }

  const before = await seen(new Date());
  check("sharing everything the group accepts reaches 1000", before.ceiling === 1000, before.ceiling);

  // The instant the day was judged on, before anything is stopped. Held apart
  // from the stop by enough time that no two rows can share a timestamp.
  const asItStood = new Date();
  await new Promise((r) => setTimeout(r, 50));

  await stopTracking(id, DROPPED);

  const after = await seen(new Date());
  check(
    "stopping an activity stops sharing it",
    !after.shared.includes(DROPPED),
    `still shared: ${after.shared.join(", ") || "nothing"}`,
  );
  check(
    "and the ceiling falls to what is still shared",
    after.ceiling === ceilingFor(1 / 2),
    `${after.ceiling}, wanted ${ceilingFor(1 / 2)}`,
  );

  // The half that keeps it honest. A ceiling that fell today must not have
  // fallen yesterday too, or every day already scored is judged against
  // sharing that did not stand on it.
  const then = await seen(asItStood);
  check(
    "yesterday is still judged on yesterday's sharing",
    then.ceiling === 1000 && then.shared.includes(DROPPED),
    `${then.ceiling} as of the earlier instant`,
  );
} finally {
  await cleanup();
}

console.log(
  failed === 0
    ? "\nThe ceiling is what you actually do."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
