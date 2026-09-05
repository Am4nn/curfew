import { and, eq, sql } from "drizzle-orm";
import { db } from "../../src/db";
import {
  events,
  evidence,
  ledgerEntries,
  finePostings,
  groupSettings,
  groupActivityRules,
  groupInvites,
  groupMembers,
  activityOutcomes,
  userApprovals,
} from "../../src/db/schema";
import { getActivityType } from "../../src/domain";
import { performCheckin } from "../../src/server/checkin";
import { requestUpload } from "../../src/server/evidence";
import { localPathFor } from "../../src/server/r2";
import { setShare, setAccepted, setFineRule } from "../../src/server/sharing";
import { memberStandings, groupEvidence, standingIn, groupBalances } from "../../src/server/group-view";
import { scoreUser, settleFines } from "../../src/server/scoring";
import { deletionSummary } from "../../src/server/deletion";
import { recordSettlement, getGroupLedgerRows } from "../../src/server/ledger";
import { acceptInvite, declineInvite, leaveGroup } from "../../src/server/groups";
import { reportEvidence, openReports, reviewReport, banUser } from "../../src/server/reports";
import { assertMember } from "../../src/server/membership";
import { requireCapability, hasAdminAccess } from "../../src/server/admin";
import { roleCapabilities } from "../../src/lib/capabilities";
import { CAPABILITIES_FOR_TEST } from "./capabilities";
import { check, refuses, section, skipped } from "./harness";
import type { World } from "./world";

// Everything that can be attacked by calling the server's own functions. No
// HTTP: these are the guards themselves, tried directly, so a round that holds
// here says the rule exists, and `http.ts` says the routes actually reach it.

export async function run(w: World): Promise<void> {
  const { admin, peer, stranger, mine, theirs, TYPE, OPEN, back, today, tag } = w;

  section("1. check-in replay");
  const idem = `${tag}aaaaaaaa`;
  const first = await performCheckin(admin, null, {
    typeKey: OPEN, step: "glass", idem, evidence: {},
  });
  check("the first press records", first.ok, JSON.stringify(first));
  const replay = await performCheckin(admin, null, {
    typeKey: OPEN, step: "glass", idem, evidence: {},
  });
  check(
    "a replayed press records nothing",
    !replay.ok && replay.reason === "duplicate",
    JSON.stringify(replay),
  );
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, admin), sql`${events.payload}->>'idem' = ${idem}`));
  check("exactly one row exists for that press", rows[0].n === 1, `${rows[0].n} rows`);

  section("2. back-dating a check-in");
  const backdated = await performCheckin(admin, null, {
    typeKey: OPEN,
    step: "glass",
    idem: `${tag}bbbbbbbb`,
    period_start: back,
    occurred_at: `${back}T09:00:00Z`,
    evidence: {},
  } as never);
  check(
    "an unknown field is refused outright",
    !backdated.ok && backdated.reason === "invalid",
    JSON.stringify(backdated),
  );

  const stored = await db
    .select({ period: sql<string>`${events.payload}->>'period_start'`, at: events.occurredAt })
    .from(events)
    .where(and(eq(events.userId, admin), sql`${events.payload}->>'idem' = ${idem}`));
  check(
    "the period is the server's, not the client's",
    stored[0]?.period === today,
    `stored ${stored[0]?.period}, today ${today}`,
  );
  check("the timestamp is the server's", Math.abs(stored[0].at.getTime() - Date.now()) < 120_000);

  section("3. another group's data");
  await refuses("a non-member cannot read a group's evidence", () => groupEvidence(theirs, admin));
  await refuses("a non-member cannot read standings", () => memberStandings(theirs, admin));
  await refuses("a non-member cannot read a standing", () => standingIn(theirs, admin));
  await refuses("a non-member cannot read a ledger", () => getGroupLedgerRows(theirs, admin));
  await refuses("a non-member cannot read balances", () => groupBalances(theirs, admin));

  section("4. escalating to owner");
  await refuses("a member cannot change what a group accepts", () =>
    setAccepted({ groupId: mine, typeKey: OPEN, accepted: true, changedBy: peer }));
  await refuses("a member cannot set a fine", () =>
    setFineRule({
      groupId: mine, typeKey: OPEN, fineAmount: 9999, currency: "INR",
      effectiveFrom: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      changedBy: peer,
    }));
  await refuses("nobody can un-share on another member's behalf", () =>
    setShare({
      groupId: mine, userId: admin, typeKey: OPEN,
      shared: false, shareEvidence: false, changedBy: peer,
    }));
  await refuses("a stranger cannot change another group's rules", () =>
    setAccepted({ groupId: theirs, typeKey: OPEN, accepted: false, changedBy: admin }));

  section("5. back-dating a fine rule");
  await refuses("a fine cannot be back-dated onto closed periods", () =>
    setFineRule({
      groupId: mine, typeKey: OPEN, fineAmount: 5000, currency: "INR",
      effectiveFrom: back, changedBy: admin,
    }));

  section("6. scrubbing reputation by un-sharing");
  await scoreUser(admin);
  const before = await standingIn(mine, admin);
  await setShare({
    groupId: mine, userId: admin, typeKey: OPEN,
    shared: false, shareEvidence: false, changedBy: admin,
  });
  await scoreUser(admin);
  const after = await standingIn(mine, admin);
  check(
    "un-sharing does not raise the score",
    after.score <= before.score,
    `${before.score.toFixed(1)} -> ${after.score.toFixed(1)}`,
  );
  await setShare({
    groupId: mine, userId: admin, typeKey: OPEN,
    shared: true, shareEvidence: true, changedBy: admin,
  });

  section("7. uploads");
  const bad = await requestUpload(admin, {
    typeKey: TYPE, step: "dose", idem: `${tag}cccccccc`,
    contentType: "application/pdf", bytes: 1000,
  });
  check("a non-image content type is refused", !bad.ok, JSON.stringify(bad));
  const huge = await requestUpload(admin, {
    typeKey: TYPE, step: "dose", idem: `${tag}dddddddd`,
    contentType: "image/jpeg", bytes: 50_000_000,
  });
  check("an enormous upload is refused", !huge.ok, JSON.stringify(huge));

  section("8. object keys");
  // The key is built from the caller's id and their idempotency key, so the
  // only part a client controls is the idem. If it could carry a slash the key
  // would leave the caller's own prefix, and on the local store it would leave
  // the store.
  const traversal = await requestUpload(admin, {
    typeKey: TYPE, step: "dose", idem: "../../../../etc/passwd",
    contentType: "image/jpeg", bytes: 500,
  });
  check("an idempotency key cannot carry a path", !traversal.ok, JSON.stringify(traversal));
  const mineKey = await requestUpload(admin, {
    typeKey: TYPE, step: "dose", idem: `${tag}kkkkkkkk`,
    contentType: "image/jpeg", bytes: 500,
  });
  check(
    "the key the server issues is under the caller's own prefix",
    mineKey.ok && mineKey.objectKey.startsWith(`ev/${admin}/`),
    mineKey.ok ? mineKey.objectKey : JSON.stringify(mineKey),
  );
  for (const attempt of ["../secrets", "ev/../../etc/passwd", "/etc/passwd", "ev/x/../../../y"]) {
    check(`the local store refuses "${attempt}"`, localPathFor(attempt) === null);
  }

  section("9. a check-in claiming somebody else's photo");
  const ticket = await requestUpload(peer, {
    typeKey: TYPE, step: "dose", idem: `${tag}eeeeeeee`,
    contentType: "image/jpeg", bytes: 500,
  });
  if (ticket.ok) {
    const theft = await performCheckin(admin, null, {
      typeKey: TYPE, step: "dose", idem: `${tag}ffffffff`,
      evidenceKey: ticket.objectKey, evidence: {},
    });
    check("a photo from another user cannot be claimed", !theft.ok, JSON.stringify(theft));
  }

  section("10. a required photo cannot be skipped");
  const noPhoto = await performCheckin(peer, null, {
    typeKey: TYPE, step: "dose", idem: `${tag}gggggggg`, evidence: {},
  });
  check(
    "a required photo is required",
    !noPhoto.ok && noPhoto.reason === "no_photo",
    JSON.stringify(noPhoto),
  );

  section("11. money");
  await db.insert(ledgerEntries).values({
    groupId: mine, typeKey: TYPE, fromUserId: admin, toUserId: peer,
    fromUserName: "Break-in admin", toUserName: "Break-in peer",
    amount: 5000, currency: "INR", kind: "fine", periodStart: back,
  });

  await refuses("a settlement cannot be zero", () =>
    recordSettlement({ groupId: mine, payerUserId: admin, payeeUserId: peer, amount: 0 }));
  await refuses("a settlement cannot be negative", () =>
    recordSettlement({ groupId: mine, payerUserId: admin, payeeUserId: peer, amount: -5000 }));
  await refuses("a settlement cannot be a fraction of a minor unit", () =>
    recordSettlement({ groupId: mine, payerUserId: admin, payeeUserId: peer, amount: 12.5 }));
  await refuses("nobody can settle with themselves", () =>
    recordSettlement({ groupId: mine, payerUserId: admin, payeeUserId: admin, amount: 100 }));
  // The action checks both sides are members before it records anything, so
  // this is the guard it depends on.
  await refuses("a stranger is not a member to settle with", () => assertMember(mine, stranger));

  const owedBefore = await groupBalances(mine, admin);
  await recordSettlement({ groupId: mine, payerUserId: admin, payeeUserId: peer, amount: 5000 });
  const owedAfter = await groupBalances(mine, admin);
  check(
    "a settlement clears what it pays",
    (owedBefore.find((b) => b.userId === peer)?.netOwed ?? 0) === 5000 &&
      owedAfter.find((b) => b.userId === peer) === undefined,
    `${owedBefore.find((b) => b.userId === peer)?.netOwed} -> ${owedAfter.find((b) => b.userId === peer)?.netOwed ?? 0}`,
  );
  // Overpaying is allowed and must not vanish: it turns the debt around rather
  // than being absorbed, or a payer could quietly gift money into nothing.
  await recordSettlement({ groupId: mine, payerUserId: admin, payeeUserId: peer, amount: 700 });
  const over = await groupBalances(mine, admin);
  check(
    "an overpayment turns the debt around rather than vanishing",
    over.find((b) => b.userId === peer)?.netOwed === -700,
    `${over.find((b) => b.userId === peer)?.netOwed}`,
  );

  section("12. a fine is charged once, whatever runs it");
  // A missed period with a creditor, written as outcomes because the point is
  // the settling, not the scoring. Two settlers race for it.
  const racePeriod = back;
  await db.insert(activityOutcomes).values([
    {
      groupId: mine, userId: admin, typeKey: OPEN, periodStart: racePeriod,
      passed: false, fineAmount: 50000, currency: "INR", rulesVersion: null,
    },
    {
      groupId: mine, userId: peer, typeKey: OPEN, periodStart: racePeriod,
      passed: true, fineAmount: 0, currency: "INR", rulesVersion: null,
    },
  ]);
  await Promise.all([settleFines(admin), settleFines(admin)]);
  const postings = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(finePostings)
    .where(and(eq(finePostings.groupId, mine), eq(finePostings.fromUserId, admin)));
  const shares = await db
    .select({ total: sql<number>`coalesce(sum(amount), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.groupId, mine),
        eq(ledgerEntries.fromUserId, admin),
        eq(ledgerEntries.kind, "fine"),
        eq(ledgerEntries.periodStart, racePeriod),
        // The type as well as the period. A posting is keyed on all four, and
        // the money round above left a fine of its own on this same day: without
        // this the sum picked both up and reported a double-charge that was the
        // fixture's, not the app's.
        eq(ledgerEntries.typeKey, OPEN),
      ),
    );
  check("two settlers racing post one fine", postings[0].n === 1, `${postings[0].n} postings`);
  check(
    "and its shares sum to exactly the fine",
    Number(shares[0].total) === 50000,
    `${shares[0].total} of 50000`,
  );

  section("13. two presses at once");
  const raceIdem = `${tag}rrrrrrrr`;
  const both = await Promise.all([
    performCheckin(peer, null, { typeKey: OPEN, step: "glass", idem: raceIdem, evidence: {} }),
    performCheckin(peer, null, { typeKey: OPEN, step: "glass", idem: raceIdem, evidence: {} }),
  ]);
  const raced = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, peer), sql`${events.payload}->>'idem' = ${raceIdem}`));
  check(
    "two identical presses at once record one event",
    raced[0].n === 1,
    `${raced[0].n} rows, results ${both.map((b) => (b.ok ? "ok" : b.reason)).join("/")}`,
  );

  section("14. invites");
  const [foreign] = await db
    .select({ id: groupInvites.id, email: groupInvites.email })
    .from(groupInvites)
    .where(eq(groupInvites.id, w.invite));
  await refuses("an invite cannot be accepted from another email", () =>
    acceptInvite(foreign.id, admin, `${admin}@example.invalid`));
  await refuses("nor declined by someone it is not addressed to", () =>
    declineInvite(foreign.id, `${admin}@example.invalid`));
  const stillOut = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, theirs), eq(groupMembers.userId, admin)));
  check("and nobody joined on the way past", stillOut[0].n === 0, `${stillOut[0].n} rows`);

  // Its own recipient may accept it, once, and a revoked one is spent.
  const ownInvite = await db
    .insert(groupInvites)
    .values({ groupId: mine, email: `${stranger}@example.invalid`, invitedBy: admin })
    .returning({ id: groupInvites.id });
  await acceptInvite(ownInvite[0].id, stranger, `${stranger}@example.invalid`);
  await refuses("an accepted invite cannot be used again", () =>
    acceptInvite(ownInvite[0].id, stranger, `${stranger}@example.invalid`));
  const joined = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, mine), eq(groupMembers.userId, stranger)));
  check("accepting twice is one membership", joined[0].n === 1, `${joined[0].n} rows`);

  const revoked = await db
    .insert(groupInvites)
    .values({ groupId: mine, email: `${peer}@example.invalid`, invitedBy: admin })
    .returning({ id: groupInvites.id });
  await declineInvite(revoked[0].id, `${peer}@example.invalid`);
  await refuses("a declined invite is spent", () =>
    acceptInvite(revoked[0].id, peer, `${peer}@example.invalid`));

  section("15. leaving");
  await refuses("the last owner cannot walk out on a group with members left", () =>
    leaveGroup(mine, admin));
  await leaveGroup(mine, stranger);
  await refuses("and someone who left cannot read it any more", () =>
    standingIn(mine, stranger));
  const debtSurvives = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.groupId, mine));
  check("leaving does not erase the ledger", debtSurvives[0].n > 0, `${debtSurvives[0].n} rows`);

  section("16. the admin console's gate");
  check("a plain member has no admin access", (await hasAdminAccess(peer)) === false);
  check(
    "the list of capabilities tried here is complete",
    CAPABILITIES_FOR_TEST.length === roleCapabilities("admin").length,
    `${CAPABILITIES_FOR_TEST.length} tried, ${roleCapabilities("admin").length} exist`,
  );
  for (const capability of CAPABILITIES_FOR_TEST) {
    await refuses(`a plain member is refused ${capability}`, () =>
      requireCapability(peer, capability));
  }

  section("17. moderation");
  {
    const t = await requestUpload(peer, {
      typeKey: TYPE, step: "dose", idem: `${tag}hhhhhhhh`,
      contentType: "image/jpeg", bytes: 400,
    });
    if (t.ok) {
      await fetch(t.url.startsWith("http") ? t.url : `http://localhost:3000${t.url}`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: Buffer.from("stand-in for a photo"),
      }).catch(() => undefined);
      await performCheckin(peer, null, {
        typeKey: TYPE, step: "dose", idem: `${tag}hhhhhhhh`,
        evidenceKey: t.objectKey, evidence: {},
      });

      const [row] = await db
        .select({ id: evidence.id })
        .from(evidence)
        .where(eq(evidence.objectKey, t.objectKey));

      if (row) {
        await refuses("a non-member cannot report into a group", () =>
          reportEvidence({ reporterId: stranger, evidenceId: row.id, groupId: mine, reason: "nsfw" }));

        await reportEvidence({
          reporterId: admin, evidenceId: row.id, groupId: mine, reason: "nsfw", note: "test",
        });
        const open1 = (await openReports()).filter((r) => r.subjectId === peer);
        check("the report reaches the admin queue", open1.length === 1, `${open1.length}`);

        await reportEvidence({
          reporterId: admin, evidenceId: row.id, groupId: mine, reason: "nsfw",
        });
        const open2 = (await openReports()).filter((r) => r.subjectId === peer);
        check("reporting twice is still one report", open2.length === 1, `${open2.length}`);

        await reviewReport({
          adminId: admin, reportId: open2[0].id, outcome: "upheld", removePhoto: true,
        });
        const [gone] = await db
          .select({ deletedAt: evidence.deletedAt })
          .from(evidence)
          .where(eq(evidence.id, row.id));
        check("upholding a report removes the photo", gone?.deletedAt !== null);
        check(
          "a decided report leaves the queue",
          (await openReports()).filter((r) => r.subjectId === peer).length === 0,
        );
      } else {
        skipped("the moderation round", "the photo never confirmed");
      }
    } else {
      skipped("the moderation round", `no upload ticket: ${JSON.stringify(t)}`);
    }

    // A debt of the peer's, so "the ban did not clear it" is a claim about
    // something rather than about an empty table.
    await db.insert(ledgerEntries).values({
      groupId: mine, typeKey: OPEN, fromUserId: peer, toUserId: admin,
      fromUserName: "Break-in peer", toUserName: "Break-in admin",
      amount: 2500, currency: "INR", kind: "fine", periodStart: today,
    });
    const owedBeforeBan = await db
      .select({ total: sql<number>`coalesce(sum(amount), 0)::int` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.groupId, mine), eq(ledgerEntries.fromUserId, peer)));

    await banUser({ adminId: admin, userId: peer, reason: "test" });
    const [banned] = await db
      .select({ disabledAt: userApprovals.disabledAt, reason: userApprovals.disabledReason })
      .from(userApprovals)
      .where(eq(userApprovals.userId, peer));
    check(
      "a ban blocks the account and records why",
      banned?.disabledAt !== null && banned?.reason === "test",
    );
    const owedAfterBan = await db
      .select({ total: sql<number>`coalesce(sum(amount), 0)::int` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.groupId, mine), eq(ledgerEntries.fromUserId, peer)));
    check(
      "a ban does not clear what they owe",
      Number(owedBeforeBan[0].total) > 0 &&
        Number(owedAfterBan[0].total) === Number(owedBeforeBan[0].total),
      `${owedBeforeBan[0].total} -> ${owedAfterBan[0].total}`,
    );
    await refuses("an admin cannot ban themselves", () =>
      banUser({ adminId: admin, userId: admin, reason: "x" }));
  }

  section("18. deleting an account with money outstanding");
  const summary = await deletionSummary(admin);
  check(
    "the deletion screen names the money owed",
    summary.outstanding.length > 0,
    JSON.stringify(summary.outstanding),
  );

  section("19. membership is checked, not assumed");
  await refuses("assertMember refuses a non-member", () => assertMember(theirs, admin));

  section("20. rate limits");
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    // rateLimit fails OPEN when Upstash is unreachable or unconfigured, which
    // is deliberate: losing a check-in to our own outage punishes the user. So
    // an environment without it cannot test the ceiling, and saying "held"
    // would be a lie.
    skipped("the check-in ceiling", "no UPSTASH_REDIS_REST_URL in this environment");
  } else {
    const perMinute = 20;
    let refused: string | null = null;
    for (let i = 0; i < perMinute + 4 && refused === null; i += 1) {
      const r = await performCheckin(stranger, null, {
        typeKey: OPEN,
        step: "glass",
        idem: `${tag}rate${String(i).padStart(4, "0")}`,
        evidence: {},
      });
      if (!r.ok && r.reason === "rate_limited") refused = `after ${i + 1}`;
    }
    check("the check-in ceiling refuses a flood", refused !== null, refused ?? "never refused");
  }

  // Config the later rounds left behind, so the world teardown has less to
  // guess at. Everything else is keyed to the run's own groups and people.
  await db.delete(groupSettings).where(eq(groupSettings.groupId, mine));
  await db.delete(groupActivityRules).where(eq(groupActivityRules.groupId, mine));
}
