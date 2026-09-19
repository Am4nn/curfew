// Is a button offered exactly when a press would count?
//
//   bun run check:offer
//
// Home used to withdraw the control the moment the period passed, which is not
// the same question and came apart in three ways:
//
//   Food passes at its meal count with the calories under the limit, so the
//   meal that would BREAK the limit was the one Home refused to take. The day
//   then scored as passed on what was recorded before it.
//   An abstinence type passes the moment you say it held, which withdrew the
//   correction its own module deliberately allows.
//   Gym passes its week on the third session, and a fourth day at the gym still
//   counts toward the streak.
//
// The other half of the same line: a control must never be offered that the
// write path would refuse. Office arrives once a day and Gym counts one session
// a calendar day, so neither is offered again once it has happened.
//
// Every check here reads `todayFor`, which is Home's own list, and then asks
// `performCheckin` whether it agrees. The two disagreeing IS the bug.
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
import { getActivityType, EVERY_DAY } from "@/domain";
import type { Schedule } from "@/domain";
import { CONSENT_VERSION } from "@/server/consent";
import {
  performCheckin,
  getCheckinState,
  type CheckinStepView,
} from "@/server/checkin";
import { todayFor, type TodayRow } from "@/server/today";
import { now, setClock } from "@/lib/clock";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:offer is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

const ZONE = "Asia/Kolkata";
let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const id = `offer-${randomUUID().slice(0, 6)}`;

/**
 * Track a type, with its config and schedule under this script's control.
 *
 * Both overrides matter. Office opens 10 AM to 2 PM and Sugar-free 8 PM to
 * midnight, so a script taking their defaults passes or fails on the hour it
 * happens to run. What is being checked here is not the window.
 */
async function track(
  typeKey: string,
  over: { config?: unknown; schedule?: Schedule; minGap?: number } = {},
) {
  const type = getActivityType(typeKey);
  await db.insert(userActivityConfig).values({
    userId: id,
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
    userId: id,
    typeKey,
    enabled: true,
    effectiveAt: new Date("2026-01-01T00:00:00+05:30"),
  });
}

/** A press, with the photograph the type asks for if it asks for one. */
async function press(typeKey: string, step: string, tag: string, payload: unknown = {}) {
  const state = await getCheckinState(id, typeKey);
  if (!state) throw new Error(`${typeKey} is not tracked`);
  const type = getActivityType(typeKey);
  const idem = `${id}-${tag}`;
  let evidenceKey: string | undefined;

  if (type.evidence.level === "required") {
    evidenceKey = `check-offer/${idem}.png`;
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

  return performCheckin(id, null, { typeKey, step, idem, evidence: payload, evidenceKey });
}

/** The row as Home would draw it. */
async function row(typeKey: string): Promise<TodayRow> {
  const found = (await todayFor(id)).rows.find((r) => r.typeKey === typeKey);
  if (!found) throw new Error(`${typeKey} is not on the board`);
  return found;
}

const shape = (r: TodayRow) =>
  `scheduled=${r.scheduled} done=${r.done} today=${r.countedToday} open=${r.open}` +
  ` recorded=${r.recorded} "${r.status}"`;

/**
 * One STEP as the check-in screen would draw it.
 *
 * Home draws one row an activity, so a type with three steps collapses to one
 * `open`. Sleep's confirm has to be asked for on its own: the night can be open
 * while the confirm is waiting on a press that has not happened.
 */
async function stepOf(typeKey: string, step: string): Promise<CheckinStepView> {
  const state = await getCheckinState(id, typeKey);
  if (!state) throw new Error(`${typeKey} is not tracked`);
  const found = state.steps.find((s) => s.key === step);
  if (!found) throw new Error(`${typeKey} has no step ${step}`);
  return found;
}

const shape2 = (s: CheckinStepView) =>
  `open=${s.open} inWindow=${s.inWindow} counts=${s.counts} waitingOn=${s.waitingOn?.message ?? "none"}`;

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
    name: "Offer check",
    email: `${id}@example.invalid`,
    emailVerified: true,
  });
  await db.insert(userApprovals).values({ userId: id, status: "approved", decidedAt: new Date() });
  await db.insert(consentRecords).values({ userId: id, version: CONSENT_VERSION });
  await db.insert(userSettings).values({
    userId: id,
    timezone: ZONE,
    effectiveFrom: "2026-01-01",
  });

  const today = DateTime.now().setZone(ZONE);
  const allDay = { open: "00:00", close: "23:59" };

  // ---------------------------------------------------------------------
  // A passed day that can still take a press, which is the whole change.
  // ---------------------------------------------------------------------

  // One meal, 600 calories, limit 700: the day passes on what is recorded and
  // the second meal is the one that breaks it.
  await track("food", { config: { meals: 1, calorieLimit: 700 } });
  await press("food", "meal", "meal1", { calories: 600 });

  let food = await row("food");
  check("a passed day is still marked done", food.done, shape(food));
  check("and the meal that would break the limit is still offered", food.open, shape(food));
  // Reported as "Food I logged 4 times but it just keeps on asking for Log",
  // within an hour of the line above being built. It was not asking. A control
  // on a met period is an offer, and a row that does not draw that distinction
  // reads as an activity that has not noticed it is finished.
  check(
    "and the row says the control is an offer, not a demand",
    food.status.includes("Another still counts"),
    food.status,
  );

  const second = await press("food", "meal", "meal2", { calories: 600 });
  check("and the press Home offered is one the server takes", second.ok, JSON.stringify(second));

  food = await row("food");
  check("and the day stops passing once it lands", !food.done, shape(food));
  // Calories only accumulate, so a day over its limit is decided. The row used
  // to state the two numbers and leave the reader to compare them.
  check(
    "and the row says the day is lost, not just the numbers",
    food.status.includes("does not count"),
    food.status,
  );

  // Abstinence. The module allows a correction in as many words: someone who
  // taps "It held" and then corrects themselves is telling the truth the second
  // time. Saying it held passes the day, so Home used to take the correction
  // away at the moment it became possible.
  await track("sugarfree", { config: { window: allDay, cutoff: null } });
  await press("sugarfree", "declare", "held", { held: true });

  let sugar = await row("sugarfree");
  check("saying it held passes the day", sugar.done, shape(sugar));
  check("and the correction is still reachable", sugar.open, shape(sugar));
  // What the control is called hangs on this. A day that has been declared is
  // not a day waiting to be checked in, so the button says Correct.
  check("and the row knows the declaration stands", sugar.recorded, shape(sugar));

  // And it says WHICH answer stands. Without this the row read "Logged
  // 10:15 PM" either way, so the one type whose whole record is a yes or a no
  // was the one type that never said which.
  check(
    "and the row says which answer stands",
    sugar.status.includes("held"),
    sugar.status,
  );

  await press("sugarfree", "declare", "slipped", { held: false });
  sugar = await row("sugarfree");
  check("and the correction is taken", !sugar.done, shape(sugar));
  check(
    "and the row says so in words",
    sugar.status.includes("slipped"),
    sugar.status,
  );

  // ---------------------------------------------------------------------
  // Where it does not apply: a press that would do nothing is not offered.
  // ---------------------------------------------------------------------

  // Office arrives once a day. The write path refuses the second, so the row
  // must not invite it.
  //
  // Scheduled every day here, because office is Monday to Friday by default and
  // this check is about a SECOND press being refused, not about which weekday
  // it runs on. Left as the default it answered "not scheduled today" every
  // Saturday and Sunday and took three checks down with it, which nobody saw
  // until CI first ran on a weekend.
  await track("office", { config: { window: allDay }, schedule: EVERY_DAY });
  await press("office", "arrive", "arrive1");

  const office = await row("office");
  check("an arrival that has happened is done", office.done, shape(office));
  check("and no second arrival is offered", !office.open, shape(office));
  const openSteps = (await getCheckinState(id, "office"))?.steps.filter((s) => s.open) ?? [];
  check(
    "and the check-in screen has nothing open either",
    openSteps.length === 0,
    openSteps.map((s) => s.key).join(", "),
  );
  const again = await press("office", "arrive", "arrive2");
  check(
    "and the server refuses one, which is why",
    !again.ok && again.reason === "duplicate",
    JSON.stringify(again),
  );

  // Gym counts one session a calendar day, and says so itself through
  // `countsNow`. The week is nowhere near passed, so this is the module's
  // answer being honoured rather than the period's.
  await track("gym");
  // Gym's period is a WEEK, so its first session passes nothing. The day at
  // the top of Home still has to move: a session this afternoon is plainly a
  // thing done today, and the count read from `passed` sat there while it
  // happened.
  const dayBefore = (await todayFor(id)).done;
  await press("gym", "session", "gym1");
  const dayAfter = (await todayFor(id)).done;
  check(
    "a gym session moves today's count, a week before it passes",
    dayAfter === dayBefore + 1,
    `${dayBefore} -> ${dayAfter}`,
  );

  const gym = await row("gym");
  check("and today is counted while the week is not", gym.countedToday && !gym.done, shape(gym));
  check("a week still short is not done", !gym.done, shape(gym));
  check("and today's second session is not offered", !gym.open, shape(gym));
  const gymAgain = await press("gym", "session", "gym2");
  check(
    "and the server refuses that one too",
    !gymAgain.ok && gymAgain.reason === "already_counted",
    JSON.stringify(gymAgain),
  );

  // ---------------------------------------------------------------------
  // The gap. Eight glasses in eight seconds is not a day anybody had.
  // ---------------------------------------------------------------------

  await track("water", { config: { glasses: 8 }, minGap: 30 });
  const first = await press("water", "glass", "glass1");
  check("the first glass is taken", first.ok, JSON.stringify(first));

  const soon = await press("water", "glass", "glass2");
  check(
    "and the next one inside the gap is refused",
    !soon.ok && soon.reason === "too_soon",
    JSON.stringify(soon),
  );

  const gapped = await row("water");
  check("and no control is offered while it runs", !gapped.open, shape(gapped));
  check(
    "and the row says when the next one counts",
    gapped.status.includes("Next counts"),
    gapped.status,
  );

  // A day this activity is not scheduled on. The write path refuses it as
  // unscheduled, so nothing is offered for it either.
  const tomorrow = ((today.weekday % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  await track("steps", { schedule: { kind: "days", days: [tomorrow] } });

  const water = await row("steps");
  check("an unscheduled day is not scheduled", !water.scheduled, shape(water));
  check("and nothing is recorded against it", !water.recorded, shape(water));
  check("and offers nothing", !water.open, shape(water));
  const early = await press("steps", "count", "steps1");
  check(
    "and the server refuses it, which is why",
    !early.ok && early.reason === "unscheduled",
    JSON.stringify(early),
  );

  // ---------------------------------------------------------------------
  // A window anchored to another press, which is sleep's confirm (item 17).
  //
  // Every window in the app until v3.2 was a clock time in config, so "is a
  // control offered exactly when a press would count" had one answer for every
  // type: compare the clock to two numbers. This one has no times at all until
  // Wake is pressed, and the two halves of that question can now disagree in a
  // way they could not before: a screen showing the widest the window could be
  // would offer a Confirm at an hour the write path refuses.
  //
  // This is the only block that pins the clock. It goes last for that reason.
  // ---------------------------------------------------------------------

  const night = DateTime.fromISO("2026-03-10", { zone: ZONE });
  setClock(night.set({ hour: 22 }).toJSDate());
  await track("sleep"); // the module's own windows: 9:30 PM to 11 PM, 5:30 to 7 AM

  let confirm = await stepOf("sleep", "confirm");
  check(
    "the confirm says what it is waiting for rather than showing times",
    confirm.waitingOn !== null && confirm.opensLabel === "" && confirm.closesLabel === "",
    `${confirm.waitingOn?.message ?? "no wait"} opens="${confirm.opensLabel}"`,
  );
  check("and is not open", !confirm.open && !confirm.inWindow, shape2(confirm));

  const tooEarly = await press("sleep", "confirm", "confirm-before-wake");
  check(
    "and the server refuses a confirm before the wake press",
    !tooEarly.ok && tooEarly.reason === "closed",
    JSON.stringify(tooEarly),
  );
  check(
    "with the module's own sentence, not a closing time it does not have",
    !tooEarly.ok && tooEarly.message === confirm.waitingOn?.message,
    !tooEarly.ok ? tooEarly.message : "",
  );

  await press("sleep", "night", "night1");

  // Six in the morning, inside the wake window.
  //
  // The wake event is inserted with its own timestamp rather than pressed.
  // `recordEvent` leaves occurred_at to the DATABASE clock (invariant 8), which
  // does not move when the app clock is scrubbed, so a press made here would be
  // stamped with the real hour and would not sit in the window it was made in.
  // The anchor is a precondition; what is being checked is the confirm.
  const wakeAt = night.plus({ days: 1 }).set({ hour: 6 }).toJSDate();
  setClock(wakeAt);
  const wakePeriod = (await getCheckinState(id, "sleep"))!.period;
  await db.insert(events).values({
    userId: id,
    type: "checkin.sleep.wake",
    payload: {
      type_key: "sleep",
      step: "wake",
      period_start: wakePeriod,
      idem: `${id}-wake1`,
      evidence: {},
    },
    occurredAt: wakeAt,
  });

  confirm = await stepOf("sleep", "confirm");
  check(
    "the wake press is recorded",
    (await stepOf("sleep", "wake")).count === 1,
    `${(await stepOf("sleep", "wake")).count} presses`,
  );
  check(
    "the confirm now has times, half an hour out",
    confirm.waitingOn === null && confirm.opensLabel === "6:30 AM",
    `opens="${confirm.opensLabel}" closes="${confirm.closesLabel}"`,
  );
  check("and closes half an hour after that", confirm.closesLabel === "7:00 AM", confirm.closesLabel);
  check("and is not open yet", !confirm.open, shape2(confirm));

  const stillEarly = await press("sleep", "confirm", "confirm-too-soon");
  check(
    "and the server refuses a confirm inside the half hour",
    !stillEarly.ok && stillEarly.reason === "closed",
    JSON.stringify(stillEarly),
  );

  // And half an hour later it is offered, and taken.
  setClock(night.plus({ days: 1 }).set({ hour: 6, minute: 35 }).toJSDate());
  confirm = await stepOf("sleep", "confirm");
  check("half an hour after the press the confirm is offered", confirm.open, shape2(confirm));

  const taken = await press("sleep", "confirm", "confirm-on-time");
  check("and the press it offers is one the server takes", taken.ok, JSON.stringify(taken));

  setClock(null);
} finally {
  await cleanup();
}

console.log(
  failed === 0
    ? "\nA button is offered when a press would count, and never otherwise."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
