// Does a photograph you shared reach the group?
//
//   bun run check:evidence
//
// Reported as "I uploaded evidence and the tab says Nothing shared here yet",
// and the sharing was set correctly, which is what made it worth chasing.
//
// `groupEvidence` selected on the member, ordered by `confirmed_at DESC`, took
// the first 20 and THEN dropped the unconfirmed ones. Postgres sorts nulls
// first on DESC, so every abandoned upload sorted above every real photograph.
// Opening the camera and not sending leaves one behind, and twenty of those
// filled the page, all twenty were dropped in the loop, and the tab said
// nothing had ever been shared.
//
// So this builds exactly that: one confirmed photograph, and more abandoned
// uploads than the page holds, taken later. The photograph has to come back.
//
// Local only. It builds a throwaway group and deletes it again.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  users,
  userApprovals,
  consentRecords,
  userSettings,
  groups,
  groupMembers,
  groupActivityTypes,
  memberShares,
  evidence,
} from "@/db/schema";
import { groupEvidence } from "@/server/group-view";
import { CONSENT_VERSION } from "@/server/consent";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:evidence is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const id = `ev-${randomUUID().slice(0, 6)}`;
const groupId = randomUUID();
const TYPE = "gym";
/**
 * More abandoned uploads than a page of the feed holds, and more than the
 * function's own default of 40. The account this was reported from had 38.
 */
const ABANDONED = 45;

async function cleanup() {
  await db.delete(evidence).where(inArray(evidence.userId, [id]));
  await db.delete(memberShares).where(inArray(memberShares.userId, [id]));
  await db.delete(groupActivityTypes).where(inArray(groupActivityTypes.groupId, [groupId]));
  await db.delete(groupMembers).where(inArray(groupMembers.groupId, [groupId]));
  await db.delete(groups).where(inArray(groups.id, [groupId]));
  await db.delete(userSettings).where(inArray(userSettings.userId, [id]));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [id]));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, [id]));
  await db.delete(users).where(inArray(users.id, [id]));
}

/** One evidence row. Confirmed means a check-in happened against it. */
async function photo(minutesAgo: number, confirmed: boolean) {
  const at = DateTime.now().minus({ minutes: minutesAgo });
  await db.insert(evidence).values({
    userId: id,
    typeKey: TYPE,
    step: "session",
    periodStart: at.toFormat("yyyy-MM-dd"),
    idem: `${id}-${randomUUID().slice(0, 8)}`,
    objectKey: `check-evidence/${randomUUID()}.jpg`,
    contentType: "image/jpeg",
    bytes: 1000,
    requestedAt: at.toJSDate(),
    confirmedAt: confirmed ? at.toJSDate() : null,
    deleteAfter: at.plus({ days: 60 }).toFormat("yyyy-MM-dd"),
  });
}

try {
  await db.insert(users).values({
    id,
    name: "Evidence check",
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

  await db.insert(groups).values({ id: groupId, name: `Evidence ${id}`, createdBy: id });
  await db.insert(groupMembers).values({
    groupId,
    userId: id,
    role: "owner",
    joinedAt: "2026-01-01",
  });
  await db.insert(groupActivityTypes).values({ groupId, typeKey: TYPE, accepted: true });
  await db.insert(memberShares).values({
    groupId,
    userId: id,
    typeKey: TYPE,
    shared: true,
    shareEvidence: true,
  });

  // The photograph, an hour ago. Then the abandoned uploads, all of them more
  // recent, which is the ordinary case: you open the camera more often than
  // you finish.
  await photo(60, true);
  for (let i = 0; i < ABANDONED; i += 1) await photo(i + 1, false);

  const feed = await groupEvidence(groupId, id);
  check(
    "a shared photograph reaches the group",
    feed.length === 1,
    `${feed.length} items back`,
  );
  check(
    "and nothing unconfirmed comes with it",
    feed.every((f) => f.at !== null),
    feed.map((f) => f.at).join(", "),
  );

  // And the page size counts photographs, not rows that will be thrown away.
  const paged = await groupEvidence(groupId, id, { limit: 1 });
  check("a page of one holds the photograph", paged.length === 1, `${paged.length}`);
} finally {
  await cleanup();
}

console.log(
  failed === 0
    ? "\nWhat you shared is what the group sees."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
