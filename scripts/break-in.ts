import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  groupActivityTypes,
  groupActivityRules,
  memberShares,
  events,
  evidence,
  activityScores,
  activityOutcomes,
  reputationDaily,
  ledgerEntries,
  userActivities,
  userActivityConfig,
} from "../src/db/schema";
import { getActivityType } from "../src/domain";
import { performCheckin } from "../src/server/checkin";
import { requestUpload } from "../src/server/evidence";
import { setShare, setAccepted, setFineRule } from "../src/server/sharing";
import { memberStandings, groupEvidence, standingIn } from "../src/server/group-view";
import { scoreUser } from "../src/server/scoring";
import { deletionSummary } from "../src/server/deletion";
import { assertMember } from "../src/server/membership";

// Break our own app. Every item on the TRUST-SAFETY.md security round, tried
// for real against the real database, with what falls over reported rather than
// swallowed. `bun run break-in`, and it exits non-zero if anything gives.
//
// It creates its own people, groups and activities, and removes all of them at
// the end. Run it against preview, never production.

let failures = 0;
function check(name: string, held: boolean, detail = "") {
  if (!held) failures += 1;
  console.log(`${held ? "held  " : "BROKE "} ${name}${detail ? "  " + detail : ""}`);
}

const TAG = `brk-${randomUUID().slice(0, 6)}`;
const [me] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, "125aryaaman@gmail.com"))
  .limit(1);

// Two extra people and two groups: one I am in, one I am not.
const peer = `${TAG}-peer`;
const stranger = `${TAG}-stranger`;
for (const id of [peer, stranger]) {
  await db.insert(users).values({
    id,
    name: `Break ${id.slice(-7)}`,
    email: `${id}@example.invalid`,
    emailVerified: true,
  });
}

const mine = randomUUID();
const theirs = randomUUID();
const today = new Date().toISOString().slice(0, 10);
const back = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

await db.insert(groups).values([
  { id: mine, name: `${TAG} mine`, createdBy: me.id },
  { id: theirs, name: `${TAG} theirs`, createdBy: stranger },
]);
await db.insert(groupMembers).values([
  { groupId: mine, userId: me.id, role: "owner", joinedAt: back },
  { groupId: mine, userId: peer, role: "member", joinedAt: back },
  { groupId: theirs, userId: stranger, role: "owner", joinedAt: back },
]);

// Two types on purpose: one that needs a photo, to prove it cannot be skipped,
// and one that needs none, so the replay and back-dating tests are testing
// idempotency rather than the photo rule.
const TYPE = "supplements"; // required, live camera
const OPEN = "water"; // no evidence at all
for (const key of [TYPE, OPEN]) {
  const t = getActivityType(key);
  const schedule = {
    schedule: t.defaults.schedule,
    dayBoundary: t.defaults.dayBoundary,
    grace: 0,
  };
  for (const id of [me.id, peer, stranger]) {
    await db
      .insert(userActivityConfig)
      .values({
        userId: id,
        typeKey: key,
        effectiveFrom: back,
        config: { schedule, config: t.defaults.config },
      })
      .onConflictDoNothing();
    await db.insert(userActivities).values({
      userId: id,
      typeKey: key,
      enabled: true,
      effectiveAt: new Date(`${back}T00:00:00Z`),
    });
  }
}

for (const [gid, owner] of [
  [mine, me.id],
  [theirs, stranger],
] as const) {
  for (const key of [TYPE, OPEN]) {
    await db.insert(groupActivityTypes).values({
      groupId: gid,
      typeKey: key,
      accepted: true,
      effectiveAt: new Date(`${back}T00:00:00Z`),
      changedBy: owner,
    });
  }
}
for (const [gid, uid] of [
  [mine, me.id],
  [mine, peer],
  [theirs, stranger],
] as const) {
  for (const key of [TYPE, OPEN]) {
    await db.insert(memberShares).values({
      groupId: gid,
      userId: uid,
      typeKey: key,
      shared: true,
      shareEvidence: true,
      effectiveAt: new Date(`${back}T00:00:00Z`),
      changedBy: uid,
    });
  }
}

console.log("\n--- 1. check-in replay ---");
const idem = `${TAG}aaaaaaaa`;
const first = await performCheckin(me.id, null, {
  typeKey: OPEN, step: "glass", idem, evidence: {},
});
check("the first press records", first.ok, JSON.stringify(first));
const replay = await performCheckin(me.id, null, {
  typeKey: OPEN, step: "glass", idem, evidence: {},
});
check("a replayed press records nothing", !replay.ok && replay.reason === "duplicate",
  JSON.stringify(replay));
const rows = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(events)
  .where(and(eq(events.userId, me.id), sql`${events.payload}->>'idem' = ${idem}`));
check("exactly one row exists for that press", rows[0].n === 1, `${rows[0].n} rows`);

console.log("\n--- 2. back-dating a check-in ---");
const backdated = await performCheckin(me.id, null, {
  typeKey: OPEN,
  step: "glass",
  idem: `${TAG}bbbbbbbb`,
  // A client trying to claim a period that closed days ago.
  period_start: back,
  occurred_at: `${back}T09:00:00Z`,
  evidence: {},
} as never);
check("an unknown field is refused outright",
  !backdated.ok && backdated.reason === "invalid", JSON.stringify(backdated));

const stored = await db
  .select({ period: sql<string>`${events.payload}->>'period_start'`, at: events.occurredAt })
  .from(events)
  .where(and(eq(events.userId, me.id), sql`${events.payload}->>'idem' = ${idem}`));
check("the period is the server's, not the client's", stored[0]?.period === today,
  `stored ${stored[0]?.period}, today ${today}`);
check("the timestamp is the server's", Math.abs(stored[0].at.getTime() - Date.now()) < 120_000);

console.log("\n--- 3. another group's evidence ---");
try {
  await groupEvidence(theirs, me.id);
  check("a non-member cannot read a group's evidence", false, "it returned rows");
} catch (e) {
  check("a non-member cannot read a group's evidence", true, (e as Error).message);
}
try {
  await memberStandings(theirs, me.id);
  check("a non-member cannot read standings", false, "it returned rows");
} catch (e) {
  check("a non-member cannot read standings", true, (e as Error).message);
}
try {
  await standingIn(theirs, me.id);
  check("a non-member cannot read a standing", false, "it returned a standing");
} catch (e) {
  check("a non-member cannot read a standing", true, (e as Error).message);
}

console.log("\n--- 4. escalating to owner ---");
try {
  await setAccepted({ groupId: mine, typeKey: "water", accepted: true, changedBy: peer });
  check("a member cannot change what a group accepts", false, "it worked");
} catch (e) {
  check("a member cannot change what a group accepts", true, (e as Error).message);
}
try {
  await setFineRule({
    groupId: mine, typeKey: OPEN, fineAmount: 9999, currency: "INR",
    effectiveFrom: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    changedBy: peer,
  });
  check("a member cannot set a fine", false, "it worked");
} catch (e) {
  check("a member cannot set a fine", true, (e as Error).message);
}
try {
  await setShare({
    groupId: mine, userId: me.id, typeKey: OPEN,
    shared: false, shareEvidence: false, changedBy: peer,
  });
  check("nobody can un-share on another member's behalf", false, "it worked");
} catch (e) {
  check("nobody can un-share on another member's behalf", true, (e as Error).message);
}

console.log("\n--- 5. back-dating a fine rule ---");
try {
  await setFineRule({
    groupId: mine, typeKey: OPEN, fineAmount: 5000, currency: "INR",
    effectiveFrom: back, changedBy: me.id,
  });
  check("a fine cannot be back-dated onto closed periods", false, "it worked");
} catch (e) {
  check("a fine cannot be back-dated onto closed periods", true, (e as Error).message);
}

console.log("\n--- 6. scrubbing reputation by un-sharing ---");
await scoreUser(me.id);
const before = await standingIn(mine, me.id);
await setShare({
  groupId: mine, userId: me.id, typeKey: OPEN,
  shared: false, shareEvidence: false, changedBy: me.id,
});
await scoreUser(me.id);
const after = await standingIn(mine, me.id);
check("un-sharing does not raise the score", after.score <= before.score,
  `${before.score.toFixed(1)} -> ${after.score.toFixed(1)}`);
// Put it back for the rest of the run.
await setShare({
  groupId: mine, userId: me.id, typeKey: OPEN,
  shared: true, shareEvidence: true, changedBy: me.id,
});

console.log("\n--- 7. uploading a non-image and something enormous ---");
const bad = await requestUpload(me.id, {
  typeKey: TYPE, step: "dose", idem: `${TAG}cccccccc`,
  contentType: "application/pdf", bytes: 1000,
});
check("a non-image content type is refused", !bad.ok, JSON.stringify(bad));
const huge = await requestUpload(me.id, {
  typeKey: TYPE, step: "dose", idem: `${TAG}dddddddd`,
  contentType: "image/jpeg", bytes: 50_000_000,
});
check("an enormous upload is refused", !huge.ok, JSON.stringify(huge));

console.log("\n--- 8. a check-in claiming somebody else's photo ---");
const ticket = await requestUpload(peer, {
  typeKey: TYPE, step: "dose", idem: `${TAG}eeeeeeee`,
  contentType: "image/jpeg", bytes: 500,
});
if (ticket.ok) {
  const theft = await performCheckin(me.id, null, {
    typeKey: TYPE, step: "dose", idem: `${TAG}ffffffff`,
    evidenceKey: ticket.objectKey, evidence: {},
  });
  check("a photo from another user cannot be claimed", !theft.ok, JSON.stringify(theft));
}

console.log("\n--- 9. a required photo cannot be skipped ---");
const noPhoto = await performCheckin(peer, null, {
  typeKey: TYPE, step: "dose", idem: `${TAG}gggggggg`, evidence: {},
});
check("a required photo is required", !noPhoto.ok && noPhoto.reason === "no_photo",
  JSON.stringify(noPhoto));

console.log("\n--- 10. deleting an account with money outstanding ---");
await db.insert(ledgerEntries).values({
  groupId: mine, typeKey: TYPE, fromUserId: me.id, toUserId: peer,
  amount: 5000, currency: "INR", kind: "fine", periodStart: back,
});
const summary = await deletionSummary(me.id);
check("the deletion screen names the money owed", summary.outstanding.length > 0,
  JSON.stringify(summary.outstanding));

console.log("\n--- 11. membership is checked, not assumed ---");
try {
  await assertMember(theirs, me.id);
  check("assertMember refuses a non-member", false, "it passed");
} catch {
  check("assertMember refuses a non-member", true);
}

// Clean up everything this script made.
const ids = [peer, stranger];
await db.delete(ledgerEntries).where(inArray(ledgerEntries.groupId, [mine, theirs]));
await db.delete(activityOutcomes).where(inArray(activityOutcomes.groupId, [mine, theirs]));
await db.delete(reputationDaily).where(inArray(reputationDaily.groupId, [mine, theirs]));
await db.delete(reputationDaily).where(inArray(reputationDaily.userId, [me.id, ...ids]));
await db.delete(activityScores).where(inArray(activityScores.userId, [me.id, ...ids]));
await db.delete(evidence).where(sql`${evidence.idem} LIKE ${TAG + "%"}`);
await db.delete(events).where(sql`${events.payload}->>'idem' LIKE ${TAG + "%"}`);
await db.delete(memberShares).where(inArray(memberShares.groupId, [mine, theirs]));
await db.delete(groupActivityRules).where(inArray(groupActivityRules.groupId, [mine, theirs]));
await db.delete(groupActivityTypes).where(inArray(groupActivityTypes.groupId, [mine, theirs]));
await db.delete(groupMembers).where(inArray(groupMembers.groupId, [mine, theirs]));
await db.delete(groups).where(inArray(groups.id, [mine, theirs]));
await db
  .delete(userActivityConfig)
  .where(and(inArray(userActivityConfig.userId, [me.id, ...ids]), eq(userActivityConfig.effectiveFrom, back)));
await db
  .delete(userActivities)
  .where(and(inArray(userActivities.userId, [me.id, ...ids]), sql`effective_at <= ${new Date(`${back}T00:00:01Z`)}`));
await db.delete(users).where(inArray(users.id, ids));

console.log(`\n${failures === 0 ? "nothing broke" : `${failures} BROKE`}`);
process.exit(failures === 0 ? 0 : 1);
