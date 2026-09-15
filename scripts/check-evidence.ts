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
// It also answers the other half of the same question, which is what a group
// must NEVER see (item 15). A photograph belongs to the groups it was sent to,
// tagged at the check-in that sent it. So an untagged photograph of a shared
// type never reaches the group however the sharing is set, and a tag that was
// revoked does not come back when sharing is turned on again.
//
// Local only. It builds a throwaway group and deletes it again.
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
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
  userActivities,
  userActivityConfig,
} from "@/db/schema";
import { getActivityType } from "@/domain";
import { groupEvidence } from "@/server/group-view";
import { tagEvidence } from "@/server/evidence-tags";
import { setShare } from "@/server/sharing";
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
  // evidence_groups goes with the evidence rows: ON DELETE CASCADE.
  await db.delete(evidence).where(inArray(evidence.userId, [id]));
  await db.delete(memberShares).where(inArray(memberShares.userId, [id]));
  await db.delete(userActivities).where(inArray(userActivities.userId, [id]));
  await db.delete(userActivityConfig).where(inArray(userActivityConfig.userId, [id]));
  await db.delete(groupActivityTypes).where(inArray(groupActivityTypes.groupId, [groupId]));
  await db.delete(groupMembers).where(inArray(groupMembers.groupId, [groupId]));
  await db.delete(groups).where(inArray(groups.id, [groupId]));
  await db.delete(userSettings).where(inArray(userSettings.userId, [id]));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [id]));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, [id]));
  await db.delete(users).where(inArray(users.id, [id]));
}

/**
 * One evidence row, optionally sent to the group.
 *
 * `sent` is what a real check-in does one line after it confirms the
 * photograph: tag it with the groups being shown this activity at that moment.
 * A row without it is a photograph no group was ever sent, which is what every
 * photograph taken before this group existed is.
 */
async function photo(minutesAgo: number, confirmed: boolean, sent = false) {
  const at = DateTime.now().minus({ minutes: minutesAgo });
  const [row] = await db
    .insert(evidence)
    .values({
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
    })
    .returning({ id: evidence.id });
  if (sent) await tagEvidence(row.id, [groupId], at.toJSDate());
  return row.id;
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

  // Tracked, because setShare refuses to share a type you do not do, and the
  // un-share half of this check goes through setShare rather than around it.
  const type = getActivityType(TYPE);
  await db.insert(userActivityConfig).values({
    userId: id,
    typeKey: TYPE,
    config: {
      schedule: {
        schedule: type.defaults.schedule,
        dayBoundary: type.defaults.dayBoundary,
        grace: type.defaults.grace,
        minGap: type.defaults.minGap ?? 0,
      },
      config: type.defaults.config,
    },
    effectiveFrom: "2026-01-01",
  });
  await db.insert(userActivities).values({
    userId: id,
    typeKey: TYPE,
    enabled: true,
    effectiveAt: DateTime.fromISO("2026-01-01").toJSDate(),
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

  // The photograph, an hour ago, sent to the group. Then the abandoned
  // uploads, all of them more recent, which is the ordinary case: you open the
  // camera more often than you finish.
  await photo(60, true, true);
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

  // Nothing the group was not sent.
  //
  // Turning sharing on says what happens next. It was handing over everything
  // that had ever happened: join on a Tuesday having tracked this for a year
  // and the feed opened on a year of photographs nobody in the group had ever
  // been entitled to see.
  //
  // `joined_at` narrowed that and did not close it, because it is a date: a
  // member who joined at two in the afternoon still saw that morning. So the
  // row below is the whole back catalogue in one: a month old, confirmed, of a
  // shared type, from a member whose join date is older still. Every filter
  // the old function had lets it through. It is not tagged, so it was never
  // sent, so the group does not see it.
  const old = await photo(60 * 24 * 30, true);
  const joined = DateTime.now().minus({ days: 90 }).toFormat("yyyy-MM-dd");
  await db
    .update(groupMembers)
    .set({ joinedAt: joined })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, id)));

  const since = await groupEvidence(groupId, id);
  check(
    "a photograph the group was never sent stays out of the feed",
    since.length === 1 && !since.some((f) => f.id === old),
    `${since.length} items back, member joined ${joined}`,
  );

  // Un-sharing takes back what was sent, and re-sharing does not undo that.
  await setShare({
    groupId,
    userId: id,
    typeKey: TYPE,
    shared: true,
    shareEvidence: false,
    changedBy: id,
  });
  check("un-sharing photographs empties the feed", (await groupEvidence(groupId, id)).length === 0);

  await setShare({
    groupId,
    userId: id,
    typeKey: TYPE,
    shared: true,
    shareEvidence: true,
    changedBy: id,
  });
  check(
    "and sharing again does not bring them back",
    (await groupEvidence(groupId, id)).length === 0,
  );

  // What it DOES do is start a new record: the next photograph is sent, and
  // that one the group keeps.
  await photo(1, true, true);
  const after = await groupEvidence(groupId, id);
  check(
    "what is sent after that is shown",
    after.length === 1,
    `${after.length} items back`,
  );
} finally {
  await cleanup();
}

console.log(
  failed === 0
    ? "\nWhat you shared is what the group sees."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
