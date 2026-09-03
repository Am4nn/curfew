// Seed the local preview database with mock data covering every app state.
// Local only: refuses to run unless LOCAL_MODE=1, so it can never touch a
// real database. Wipes the app tables and rebuilds a deterministic world, then
// runs the real scorer so scores, outcomes and the ledger are authentic.
//
//   bun run local:seed   (which loads .env.local via dotenv-cli)

import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  userApprovals,
  groups,
  groupActivityTypes,
  groupActivityRules,
  memberShares,
  groupMembers,
  groupInvites,
  userSettings,
  userActivityConfig,
  events,
} from "@/db/schema";
import { getActivityType } from "@/domain";
import { scoreAll } from "@/server/scoring";

if (process.env.LOCAL_MODE !== "1") {
  console.error("Refusing to seed: LOCAL_MODE is not 1. This script is local-only.");
  process.exit(1);
}

const TZ = "Asia/Kolkata";
const DEFAULT_WINDOWS = {
  night_open: "22:00",
  night_close: "22:45",
  wake_open: "06:00",
  wake_close: "07:00",
  confirm_open: "07:30",
  confirm_close: "07:45",
};
const HISTORY_DAYS = 45;

const anchor = DateTime.utc().startOf("day");
const configFrom = anchor.minus({ days: 60 }).toFormat("yyyy-MM-dd");

// Deterministic people. The admin id must match PREVIEW_USER in src/lib/preview.
const PEOPLE = [
  { id: "preview-admin", name: "Preview Admin", email: "preview@curfew.local", status: "approved", isAdmin: true, role: "admin" },
  { id: "preview-alex", name: "Alex Rivera", email: "alex@curfew.local", status: "approved", isAdmin: false, role: "member" },
  { id: "preview-sam", name: "Sam Okafor", email: "sam@curfew.local", status: "approved", isAdmin: false, role: "member" },
  { id: "preview-riya", name: "Riya Shah", email: "riya@curfew.local", status: "approved", isAdmin: false, role: "member" },
  { id: "preview-pat", name: "Pat Nguyen", email: "pat@curfew.local", status: "pending", isAdmin: false, role: "member" },
  { id: "preview-dana", name: "Dana Cole", email: "dana@curfew.local", status: "approved", isAdmin: false, role: "member", disabled: true },
] as const;

// Per-user check-in pattern: return which steps happened for a given day index.
// Missing a required step fails the night, which drives streaks, grace and fines.
function stepsFor(userId: string, dayIndex: number): string[] {
  const all = ["night", "wake", "confirm"];
  switch (userId) {
    case "preview-admin":
      return dayIndex % 7 === 0 ? ["night", "wake"] : all; // occasional missed confirm
    case "preview-alex":
      return dayIndex % 5 === 0 ? ["night", "wake"] : all;
    case "preview-sam":
      return dayIndex % 6 === 0 ? [] : all; // occasional full miss
    case "preview-riya":
      return dayIndex === 3 ? ["night", "wake"] : all; // near perfect
    default:
      return all;
  }
}

async function main() {
  console.log("wiping preview data");
  await db.execute(sql`TRUNCATE TABLE
    ledger_entries, activity_outcomes, activity_scores, events,
    user_activity_config, user_settings, activity_rules,
    group_invites, group_members, member_shares, group_activity_rules,
    group_activity_types, groups,
    user_approvals, sessions, accounts, users
    RESTART IDENTITY CASCADE`);

  // People and their approval state.
  for (const p of PEOPLE) {
    await db.insert(users).values({
      id: p.id,
      name: p.name,
      email: p.email,
      emailVerified: true,
      image: null,
    });
    await db.insert(userApprovals).values({
      userId: p.id,
      status: p.status,
      isAdmin: p.isAdmin,
      role: p.role,
      requestedAt: new Date(),
      decidedAt: p.status === "pending" ? null : new Date(),
      decidedBy: p.status === "pending" ? null : "preview-admin",
      disabledAt: "disabled" in p && p.disabled ? new Date() : null,
    });
  }

  // Default config so every user resolves a timezone, windows and rules.
  await db.insert(userSettings).values({ userId: null, timezone: TZ, effectiveFrom: configFrom });
  await db.insert(userActivityConfig).values({
    userId: null,
    typeKey: "sleep",
    config: DEFAULT_WINDOWS,
    effectiveFrom: configFrom,
  });
  // Groups, members, the types they accept and what each member shares.
  const groupSpecs = [
    { name: "Night Owls", members: ["preview-admin", "preview-alex", "preview-sam"] },
    { name: "Early Risers", members: ["preview-admin", "preview-riya"] },
  ];
  for (const g of groupSpecs) {
    const groupId = randomUUID();
    await db.insert(groups).values({ id: groupId, name: g.name, createdBy: "preview-admin" });
    for (const uid of g.members) {
      await db.insert(groupMembers).values({
        groupId,
        userId: uid,
        role: uid === "preview-admin" ? "owner" : "member",
        joinedAt: configFrom,
      });
    }
    // The group accepts Sleep, fines a miss INR 50, and every member shares it.
    await db.insert(groupActivityTypes).values({
      groupId,
      typeKey: "sleep",
      accepted: true,
      changedBy: "preview-admin",
    });
    await db.insert(groupActivityRules).values({
      groupId,
      typeKey: "sleep",
      fineMode: "flat",
      fineAmount: 5000, // INR 50.00 in minor units
      currency: "INR",
      effectiveFrom: configFrom,
      changedBy: "preview-admin",
    });
    for (const uid of g.members) {
      await db.insert(memberShares).values({
        groupId,
        userId: uid,
        typeKey: "sleep",
        shared: true,
        shareEvidence: true,
        changedBy: uid,
      });
    }
    // A pending outgoing invite so the group detail shows the invites list.
    await db.insert(groupInvites).values({
      groupId,
      email: "newcomer@curfew.local",
      invitedBy: "preview-admin",
      status: "pending",
    });
  }

  // A group the admin is NOT in, with a pending invite to the admin's own email,
  // so the dashboard shows an incoming invite to accept.
  const outsideGroupId = randomUUID();
  await db.insert(groups).values({ id: outsideGroupId, name: "Weekend Club", createdBy: "preview-alex" });
  await db.insert(groupMembers).values({ groupId: outsideGroupId, userId: "preview-alex", role: "owner", joinedAt: configFrom });
  await db.insert(groupActivityTypes).values({ groupId: outsideGroupId, typeKey: "sleep", accepted: true, changedBy: "preview-alex" });
  await db.insert(groupInvites).values({ groupId: outsideGroupId, email: "preview@curfew.local", invitedBy: "preview-alex", status: "pending" });

  // Check-in events for the active members across the last HISTORY_DAYS closed
  // periods. Today (dayIndex 0) is intentionally left blank so the check-in
  // screen shows an open, unpressed window when you scrub the clock into it.
  const sleep = getActivityType("sleep");
  const members = ["preview-admin", "preview-alex", "preview-sam", "preview-riya"];
  let eventCount = 0;
  for (const uid of members) {
    for (let i = HISTORY_DAYS; i >= 1; i--) {
      const period = anchor.minus({ days: i }).toFormat("yyyy-MM-dd");
      const wins = sleep.windows(DEFAULT_WINDOWS, period, TZ);
      const doSteps = stepsFor(uid, i);
      for (const w of wins) {
        if (!doSteps.includes(w.step)) continue;
        const mid = new Date((w.opensAt.getTime() + w.closesAt.getTime()) / 2);
        await db.insert(events).values({
          userId: uid,
          type: `checkin.sleep.${w.step}`,
          payload: { type_key: "sleep", step: w.step, period_start: period, evidence: {} },
          occurredAt: mid,
        });
        eventCount++;
      }
    }
  }
  console.log(`inserted ${eventCount} check-in events`);

  console.log("scoring the seeded history");
  const result = await scoreAll({});
  console.log(`scored ${result.users} user(s)`);
  console.log("preview seed complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
