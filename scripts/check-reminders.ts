// Is a reminder sent only when a press would count?
//
//   bun run check:reminders
//
// The sibling of `check:offer`, one step further out:
//
//   check:offer      a button is there when a press would count.
//   check:reminders  a reminder is sent only when a press would count.
//
// Telling somebody to do a thing the write path would refuse is the same class
// of bug as offering them a control that would be refused, and it is worse in
// one way: a control that does nothing is discovered by pressing it, while a
// wrong notification is read on a lock screen by somebody who cannot check.
//
// The peer half is tested POSITIVE FIRST, deliberately. A group line that
// silently never fires is indistinguishable from a group where nobody did
// anything, so a test that only proves nothing leaks would pass forever against
// a function that returns null on every path. v3.1 shipped exactly that bug in
// the evidence path and it went unnoticed until somebody asked why the group
// tab was empty.
//
// Local only. It builds two throwaway accounts and a group, and deletes them.
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  users,
  userApprovals,
  consentRecords,
  userSettings,
  userActivities,
  userActivityConfig,
  userPauses,
  activityStreaks,
  activityScores,
  activityOutcomes,
  activityReminders,
  reputationDaily,
  events,
  evidence,
  groups,
  groupMembers,
  groupActivityTypes,
  memberShares,
} from "@/db/schema";
import { getActivityType, type Schedule } from "@/domain";
import { CONSENT_VERSION } from "@/server/consent";
import { performCheckin, getCheckinState } from "@/server/checkin";
import {
  cuesFor,
  outstandingFor,
  peersOn,
  slotFor,
  type Quiet,
} from "@/server/reminders";

/** The band every member gets until they change it. See migrations/0028. */
const QUIET: Quiet = { from: "21:30", to: "08:00", custom: false };
import { declarePause } from "@/server/pause";
import { now, setClock } from "@/lib/clock";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:reminders is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

const ZONE = "Asia/Kolkata";
let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const id = `remind-${randomUUID().slice(0, 6)}`;
const peer = `peer-${randomUUID().slice(0, 6)}`;
const groupId = randomUUID();
const ids = [id, peer];

// A Tuesday, mid-afternoon, so every all-day window is open and no default cue
// has fired yet.
const TUESDAY = DateTime.fromISO("2026-03-10T14:00", { zone: ZONE });

async function member(userId: string, name: string) {
  await db.insert(users).values({
    id: userId,
    name,
    email: `${userId}@example.invalid`,
    emailVerified: true,
  });
  await db
    .insert(userApprovals)
    .values({ userId, status: "approved", decidedAt: new Date() });
  await db.insert(consentRecords).values({ userId, version: CONSENT_VERSION });
  await db
    .insert(userSettings)
    .values({ userId, timezone: ZONE, effectiveFrom: "2026-01-01" });
}

async function track(
  userId: string,
  typeKey: string,
  over: { config?: unknown; schedule?: Schedule; minGap?: number } = {},
) {
  const type = getActivityType(typeKey);
  await db.insert(userActivityConfig).values({
    userId,
    typeKey,
    effectiveFrom: "2026-01-01",
    config: {
      schedule: {
        schedule: over.schedule ?? type.defaults.schedule,
        dayBoundary: type.defaults.dayBoundary,
        minGap: over.minGap ?? 0,
      },
      config: over.config ?? type.defaults.config,
    },
  });
  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: true,
    effectiveAt: new Date("2026-01-01T00:00:00+05:30"),
  });
}

async function press(userId: string, typeKey: string, step: string, tag: string) {
  const state = await getCheckinState(userId, typeKey);
  if (!state) throw new Error(`${typeKey} is not tracked`);
  const type = getActivityType(typeKey);
  const idem = `${userId}-${tag}`;
  let evidenceKey: string | undefined;

  if (type.evidence.level === "required") {
    evidenceKey = `check-reminders/${idem}.png`;
    const at = await now();
    await db.insert(evidence).values({
      userId,
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
  return performCheckin(userId, null, { typeKey, step, idem, evidence: {}, evidenceKey });
}

const has = async (typeKey: string) =>
  (await outstandingFor(id)).some((o) => o.typeKey === typeKey);

const names = async () => (await outstandingFor(id)).map((o) => o.typeKey).join(",");

async function cleanup() {
  await db.delete(memberShares).where(eq(memberShares.groupId, groupId));
  await db.delete(groupActivityTypes).where(eq(groupActivityTypes.groupId, groupId));
  await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  await db.delete(groups).where(eq(groups.id, groupId));
  await db.delete(reputationDaily).where(inArray(reputationDaily.userId, ids));
  await db.delete(activityOutcomes).where(inArray(activityOutcomes.userId, ids));
  await db.delete(activityScores).where(inArray(activityScores.userId, ids));
  await db.delete(activityStreaks).where(inArray(activityStreaks.userId, ids));
  await db.delete(activityReminders).where(inArray(activityReminders.userId, ids));
  await db.delete(userPauses).where(inArray(userPauses.userId, ids));
  await db.delete(evidence).where(inArray(evidence.userId, ids));
  await db.delete(events).where(inArray(events.userId, ids));
  await db.delete(userActivityConfig).where(inArray(userActivityConfig.userId, ids));
  await db.delete(userActivities).where(inArray(userActivities.userId, ids));
  await db.delete(userSettings).where(inArray(userSettings.userId, ids));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, ids));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

try {
  setClock(TUESDAY.toJSDate());
  await member(id, "Reminder check");
  await member(peer, "Peer");

  // -----------------------------------------------------------------------
  // The positive case, first, because everything below is a way of returning
  // nothing and a broken function returns nothing beautifully.
  // -----------------------------------------------------------------------

  // Water, because it takes no fields: a press is a press. The minimum gap is
  // set here rather than on a second type so that the same activity proves both
  // the positive case and the gap case, one after the other.
  await track(id, "water", { config: { glasses: 8 }, minGap: 120 });
  check("an open, unpressed, scheduled activity is outstanding", await has("water"), await names());

  // -----------------------------------------------------------------------
  // The five ways the write path would refuse a press
  // -----------------------------------------------------------------------

  // 1. Not one of this activity's days. Tuesday is weekday 2.
  await track(id, "reading", { schedule: { kind: "days", days: [1, 3, 4, 5, 6, 7] } });
  check("a day the activity is not scheduled is not", !(await has("reading")), await names());

  // 2. The period already passes on what is recorded.
  await track(id, "supplements", { config: { dosesPerDay: 1 } });
  await press(id, "supplements", "dose", "dose1");
  check("an activity already done today is not", !(await has("supplements")), await names());

  // 3. Sleep's confirm, before the wake press. `windows()` hands back the
  //    widest that window could turn out to be, marked waitingOn, and those
  //    times are a BOUND. Scheduling a reminder against them announces a window
  //    that has not started and may never open at those times.
  //    outstandingFor picks `s.open && s.closesAt !== null`, so the claim to
  //    prove is about the STEP: it has no instant to schedule against, and it
  //    is not open. Asserting "sleep is not outstanding" would be wrong as well
  //    as weak, because at 6:45 AM the WAKE step is legitimately open and sleep
  //    should be reminded about.
  await track(id, "sleep");
  setClock(TUESDAY.plus({ days: 1 }).set({ hour: 6, minute: 45 }).toJSDate());
  const sleep = await getCheckinState(id, "sleep");
  const confirm = sleep?.steps.find((s) => s.key === "confirm");
  check(
    "sleep's confirm is waiting on the wake press",
    confirm?.waitingOn != null,
    confirm?.waitingOn?.message,
  );
  check(
    "and carries no closing instant while it waits",
    confirm?.closesAt === null,
    String(confirm?.closesAt),
  );
  check(
    "and is not open, so nothing can schedule against a bound",
    confirm?.open === false,
    `open=${confirm?.open}`,
  );
  const sleepRow = (await outstandingFor(id)).find((o) => o.typeKey === "sleep");
  check(
    "sleep is outstanding on its WAKE window, which is a real one",
    sleepRow !== undefined && sleepRow.closesAt.getTime() > 0,
    sleepRow ? sleepRow.closesLabel : "not outstanding",
  );
  setClock(TUESDAY.toJSDate());

  // 4. A declared pause is a day with nothing scheduled on it.
  //
  //    Declared for TOMORROW and then walked into, because declarePause refuses
  //    a pause that starts today: backdating one would turn a miss that already
  //    happened into a day that was never scheduled (decision 15). Inserting
  //    the row directly would dodge that rule and test a state the app cannot
  //    actually reach.
  check("water is outstanding before the pause", await has("water"), await names());
  await declarePause(id, "2026-03-11", "2026-03-17");
  check("declaring one for tomorrow changes nothing today", await has("water"), await names());

  setClock(TUESDAY.plus({ days: 1 }).toJSDate());
  check(
    "and nothing at all is outstanding once it starts",
    (await outstandingFor(id)).length === 0,
    await names(),
  );

  setClock(TUESDAY.toJSDate());
  await db.delete(userPauses).where(inArray(userPauses.userId, [id]));
  check("and it comes back when the pause is gone", await has("water"), await names());

  // 5. A minimum gap still running. Water's next glass cannot be pressed for
  //    another two hours, so nothing may say it can. Last, because it is the
  //    one check that leaves water unable to be pressed.
  const landed = await press(id, "water", "glass", "glass-gap");
  check("the press the test depends on actually landed", landed.ok, JSON.stringify(landed));
  check("an activity inside its minimum gap is not outstanding", !(await has("water")), await names());

  // -----------------------------------------------------------------------
  // Cues
  // -----------------------------------------------------------------------

  const closesAt = TUESDAY.set({ hour: 20, minute: 0 }).toJSDate();
  const cue = (chosen: string[], typeKey: string) =>
    cuesFor({
      closesAt,
      timezone: ZONE,
      instant: TUESDAY.toJSDate(),
      typeKey,
      chosen,
      quiet: QUIET,
    }).map(
      (d) => DateTime.fromJSDate(d, { zone: ZONE }).toFormat("HH:mm"),
    );

  // STEPS, not reading, and the swap is the point. This asserted the
  // ENGINE'S fallback and used reading as its example of a type that declares
  // no times of its own. C6 gave reading a cue on 2026-09-23, so the example
  // stopped being one and this check went red for two days while every push
  // said "CI runs the slow half".
  //
  // Steps declares none and its window is the whole day, which is the shape
  // the fallback exists for. If it ever declares one, this fails again and
  // says so, which is the check working rather than the check being brittle.
  check(
    "the engine counts back from the close",
    cue([], "steps").join(",") === "18:00,19:15,19:50",
    cue([], "steps").join(","),
  );
  check(
    "a module's own times win over the engine's",
    cue([], "food").join(",") === "09:00,13:30,20:00",
    cue([], "food").join(","),
  );
  check(
    "and what the member chose wins over both",
    cue(["07:30"], "food").join(",") === "07:30",
    cue(["07:30"], "food").join(","),
  );
  check(
    "a chosen time inside the default quiet band is honoured, because they chose it",
    cue(["23:15"], "food").join(",") === "23:15",
    cue(["23:15"], "food").join(","),
  );

  // The cap is what makes this work for the eight types whose window is the
  // whole day: their real close is midnight, and counting back from it puts
  // three notifications between 10 PM and midnight about a day already lost.
  const midnight = TUESDAY.plus({ days: 1 }).startOf("day").toJSDate();
  const late = cuesFor({
    closesAt: midnight,
    timezone: ZONE,
    instant: TUESDAY.toJSDate(),
    typeKey: "steps",
    chosen: [],
    quiet: QUIET,
  }).map((d) => DateTime.fromJSDate(d, { zone: ZONE }).toFormat("HH:mm"));
  check("an all-day window is capped to the evening", late.join(",") === "19:30,20:45,21:20", late.join(","));

  check(
    "the slot is the member's own local date and tick",
    slotFor(TUESDAY.set({ minute: 22 }).toJSDate(), ZONE, 15) === "2026-03-10T14:15",
    slotFor(TUESDAY.set({ minute: 22 }).toJSDate(), ZONE, 15),
  );

  // -----------------------------------------------------------------------
  // What a notification is allowed to say about an untouched activity.
  //
  // THE BUG THIS EXISTS FOR. `hint` and `remind` are different sentences and
  // the notification path must take the second. Water's hint at zero is
  // "0 of 8 today.", a perfectly good line under a control and, on a lock
  // screen, a claim of progress: the old copy read it as one, picked its
  // "nearly done" bank off it, and told somebody with nothing logged that they
  // were almost there. Twice, in production.
  // -----------------------------------------------------------------------

  setClock(TUESDAY.toJSDate());
  await track(id, "study", { config: { minutesTarget: 45 } });

  const fresh = (await outstandingFor(id)).find((o) => o.typeKey === "study");
  check("an untouched activity is outstanding at all", !!fresh, await names());
  check(
    "and what it offers a notification counts DOWN, not up",
    fresh?.left === "45 minutes of study to go.",
    fresh?.left,
  );

  // Study is the starkest case of the two sentences being different, which is
  // why it is the one used here: its `hint` at zero explains the RULE, which is
  // the right line under a control on the configure screen and says nothing a
  // person on a lock screen could act on.
  const screen = (await getCheckinState(id, "study"))!.steps.find((s) => s.hint);
  check(
    "the check-in screen says something else entirely",
    screen?.hint === "Target is 45. Anything at or above counts.",
    screen?.hint,
  );
  check(
    "and a notification never carries the screen's sentence",
    (await outstandingFor(id)).every((o) => o.left !== screen?.hint),
    (await outstandingFor(id)).map((o) => o.left).join(" | "),
  );

  // The engine's fallback, for a module that writes no `remind` at all. It must
  // still be a sentence somebody can act on rather than an empty string.
  check(
    "every outstanding row has something to say",
    (await outstandingFor(id)).every((o) => o.left.length > 0),
    (await outstandingFor(id)).map((o) => `${o.typeKey}=${o.left}`).join(" | "),
  );

  // The deadline the sentence quotes and the deadline the cues count back from
  // are one function now. They used to be two, and for gym, whose window is the
  // whole WEEK, the cue fired on Tuesday evening while the sentence named
  // Sunday.
  check(
    "the deadline a row reports is never past its own close",
    (await outstandingFor(id)).every((o) => o.deadline <= o.closesAt),
    (await outstandingFor(id))
      .map((o) => `${o.typeKey} ${o.deadline.toISOString()} vs ${o.closesAt.toISOString()}`)
      .join(" | "),
  );

  // -----------------------------------------------------------------------
  // Peers. The positive case first.
  // -----------------------------------------------------------------------

  await track(peer, "water", { config: { glasses: 8 } });
  await db.insert(groups).values({ id: groupId, name: "Morning Crew", createdBy: id });
  await db.insert(groupMembers).values([
    { groupId, userId: id, role: "owner", joinedAt: "2026-01-01" },
    { groupId, userId: peer, role: "member", joinedAt: "2026-01-01" },
  ]);
  await db.insert(groupActivityTypes).values({ groupId, typeKey: "water", accepted: true });
  await db.insert(memberShares).values([
    { groupId, userId: id, typeKey: "water", shared: true, shareEvidence: false },
    { groupId, userId: peer, typeKey: "water", shared: true, shareEvidence: false },
  ]);

  const period = (await getCheckinState(id, "water"))!.period;
  check("nobody has logged it yet", (await peersOn(id, "water", period)) === null);

  const peerPress = await press(peer, "water", "glass", "glass1");
  check("the peer's press landed", peerPress.ok, JSON.stringify(peerPress));
  let seen = await peersOn(id, "water", period);
  check("a peer who shares it and logged it is named", seen?.names[0] === "Peer", JSON.stringify(seen));
  check("and the group is named with them", seen?.groupName === "Morning Crew", seen?.groupName);

  // Unshared: the group cannot see it, so neither can this.
  await db
    .update(memberShares)
    .set({ shared: false })
    .where(and(eq(memberShares.groupId, groupId), eq(memberShares.userId, peer)));
  seen = await peersOn(id, "water", period);
  check("an activity they have not shared here is invisible", seen === null, JSON.stringify(seen));

  await db
    .update(memberShares)
    .set({ shared: true })
    .where(and(eq(memberShares.groupId, groupId), eq(memberShares.userId, peer)));
  check("and visible again once shared", (await peersOn(id, "water", period)) !== null);

  // Left the group.
  await db
    .update(groupMembers)
    .set({ leftAt: "2026-03-01" })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, peer)));
  check("somebody who left the group is not", (await peersOn(id, "water", period)) === null);
  await db
    .update(groupMembers)
    .set({ leftAt: null })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, peer)));

  // Disabled or banned: the same filter scoring uses, for the same reason.
  await db
    .update(userApprovals)
    .set({ disabledAt: new Date() })
    .where(eq(userApprovals.userId, peer));
  check("and neither is a disabled account", (await peersOn(id, "water", period)) === null);
  await db
    .update(userApprovals)
    .set({ disabledAt: null })
    .where(eq(userApprovals.userId, peer));
  check("back once restored", (await peersOn(id, "water", period)) !== null);

  setClock(null);
} finally {
  setClock(null);
  await cleanup();
}

console.log(
  failed === 0
    ? "\nA reminder is sent only when a press would count, and a group line only says what the group can see."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
