import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../src/db";
import {
  users,
  groups,
  groupMembers,
  groupInvites,
  groupActivityTypes,
  groupActivityRules,
  groupSettings,
  memberShares,
  events,
  evidence,
  activityScores,
  activityStreaks,
  activityOutcomes,
  reputationDaily,
  ledgerEntries,
  finePostings,
  userApprovals,
  consentRecords,
  reports,
  userActivities,
  userActivityConfig,
} from "../../src/db/schema";
import { getActivityType } from "../../src/domain";
import { previewEnabled, PREVIEW_USER } from "../../src/lib/preview";
import { CONSENT_VERSION } from "../../src/server/consent";

// The world every round runs against: three people it made itself, two groups,
// and two activity types.
//
// IT BORROWS NOBODY. The first version looked up a real account by a hardcoded
// email and then scored it, wrote ledger rows against it, and deleted its
// activity_scores and reputation_daily on the way out. That is a destructive
// test pointed at a live person, and it is also why the round could only ever
// run against the preview database: no local fixture has that email, so the
// script died on its first insert.
//
// Everything here is created and destroyed by the run, so it is the same round
// against a throwaway local database and against preview.

export interface World {
  tag: string;
  /** An admin the run created. Every moderation round acts as this one. */
  admin: string;
  /** A plain member of `mine`, for the escalation rounds. */
  peer: string;
  /** In neither group. Every "somebody else's" round acts as this one. */
  stranger: string;
  /** The group `admin` and `peer` are in. */
  mine: string;
  /** The group only `stranger` is in. Nothing about it is any of ours. */
  theirs: string;
  /** A pending invite into `theirs`, addressed to the stranger's own email. */
  invite: string;
  /**
   * A group the HTTP identity IS in, for the positive control.
   *
   * Null when there is no fixed identity to add, or when that account is not in
   * this database. Without it a sweep that found nothing would be
   * indistinguishable from a sweep whose detector never worked.
   */
  control: string | null;
  today: string;
  back: string;
  /** Evidence-required, live camera. */
  TYPE: string;
  /** No evidence at all. */
  OPEN: string;
}

const TYPE = "supplements";
const OPEN = "water";

/**
 * In LOCAL_MODE every request is PREVIEW_USER, whoever the database says.
 *
 * That is what makes an HTTP sweep possible at all: the identity is fixed, so
 * building a world this identity has no right to and then asking for it over
 * HTTP is exactly an access-control test. The round adds that account to
 * nothing.
 */
export function fixedHttpIdentity(): string | null {
  return previewEnabled() ? PREVIEW_USER.id : null;
}

export async function build(): Promise<World> {
  const tag = `brk-${randomUUID().slice(0, 6)}`;
  const admin = `${tag}-admin`;
  const peer = `${tag}-peer`;
  const stranger = `${tag}-stranger`;

  const today = new Date().toISOString().slice(0, 10);
  const back = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

  for (const id of [admin, peer, stranger]) {
    await db.insert(users).values({
      id,
      name: `Break ${id.slice(-8)}`,
      email: `${id}@example.invalid`,
      emailVerified: true,
    });
    await db.insert(userApprovals).values({
      userId: id,
      status: "approved",
      isAdmin: id === admin,
      role: id === admin ? "admin" : "member",
      decidedAt: new Date(),
    });
    await db.insert(consentRecords).values({ userId: id, version: CONSENT_VERSION });
  }

  const mine = randomUUID();
  const theirs = randomUUID();
  await db.insert(groups).values([
    { id: mine, name: `${tag} mine`, createdBy: admin },
    { id: theirs, name: `${tag} theirs`, createdBy: stranger },
  ]);
  await db.insert(groupMembers).values([
    { groupId: mine, userId: admin, role: "owner", joinedAt: back },
    { groupId: mine, userId: peer, role: "member", joinedAt: back },
    { groupId: theirs, userId: stranger, role: "owner", joinedAt: back },
  ]);

  // Two types on purpose: one that needs a photo, to prove it cannot be
  // skipped, and one that needs none, so the replay and back-dating rounds test
  // idempotency rather than the photo rule.
  for (const key of [TYPE, OPEN]) {
    const t = getActivityType(key);
    const schedule = {
      schedule: t.defaults.schedule,
      dayBoundary: t.defaults.dayBoundary,
      grace: 0,
    };
    for (const id of [admin, peer, stranger]) {
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
    [mine, admin],
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
    [mine, admin],
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

  // An invite into the group none of this is ours, addressed to the stranger.
  // Two rounds want it: one tries to accept somebody else's invite, and the
  // HTTP sweep asks for its join screen.
  const [invite] = await db
    .insert(groupInvites)
    .values({
      groupId: theirs,
      email: `${stranger}@example.invalid`,
      invitedBy: stranger,
    })
    .returning({ id: groupInvites.id });

  // The positive control: a group the HTTP identity is genuinely in, named the
  // same way as the one it is not. The sweep asserts this one DOES come back,
  // so "nothing leaked" means the detector was working rather than looking at
  // the wrong string.
  let control: string | null = null;
  const identity = fixedHttpIdentity();
  if (identity) {
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, identity))
      .limit(1);
    if (exists) {
      control = randomUUID();
      await db.insert(groups).values({ id: control, name: `${tag} control`, createdBy: identity });
      await db
        .insert(groupMembers)
        .values({ groupId: control, userId: identity, role: "owner", joinedAt: back });
    }
  }

  return {
    tag, admin, peer, stranger, mine, theirs, invite: invite.id, control,
    today, back, TYPE, OPEN,
  };
}

/** Put the database back exactly as it was found. */
export async function teardown(w: World): Promise<void> {
  const ids = [w.admin, w.peer, w.stranger];
  const groupIds = w.control ? [w.mine, w.theirs, w.control] : [w.mine, w.theirs];

  await db.delete(reports).where(inArray(reports.subjectId, ids));
  await db.delete(reports).where(inArray(reports.reporterId, ids));
  await db.delete(ledgerEntries).where(inArray(ledgerEntries.groupId, groupIds));
  await db.delete(finePostings).where(inArray(finePostings.groupId, groupIds));
  await db.delete(activityOutcomes).where(inArray(activityOutcomes.groupId, groupIds));
  await db.delete(reputationDaily).where(inArray(reputationDaily.userId, ids));
  await db.delete(activityScores).where(inArray(activityScores.userId, ids));
  await db.delete(activityStreaks).where(inArray(activityStreaks.userId, ids));
  await db.delete(evidence).where(inArray(evidence.userId, ids));
  await db.delete(events).where(inArray(events.userId, ids));
  await db.delete(events).where(sql`${events.payload}->>'idem' LIKE ${w.tag + "%"}`);
  await db.delete(groupInvites).where(inArray(groupInvites.groupId, groupIds));
  await db.delete(memberShares).where(inArray(memberShares.groupId, groupIds));
  await db.delete(groupSettings).where(inArray(groupSettings.groupId, groupIds));
  await db.delete(groupActivityRules).where(inArray(groupActivityRules.groupId, groupIds));
  await db.delete(groupActivityTypes).where(inArray(groupActivityTypes.groupId, groupIds));
  await db.delete(groupMembers).where(inArray(groupMembers.groupId, groupIds));
  await db.delete(groups).where(inArray(groups.id, groupIds));
  await db.delete(userActivityConfig).where(inArray(userActivityConfig.userId, ids));
  await db.delete(userActivities).where(inArray(userActivities.userId, ids));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, ids));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

/** Whether anything the run made is still there. Called after teardown. */
export async function leftovers(w: World): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(inArray(users.id, [w.admin, w.peer, w.stranger])));
  const [g] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groups)
    .where(inArray(groups.id, w.control ? [w.mine, w.theirs, w.control] : [w.mine, w.theirs]));
  return (row?.n ?? 0) + (g?.n ?? 0);
}

export { eq, and, sql, inArray };
