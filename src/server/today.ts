import {
  getActivityType,
  periodUnit,
  DEFAULT_ANSWERS,
  type CheckinKind,
  type DeclareAnswers,
} from "@/domain";
import { listUserActivities } from "./activities";
import { getCheckinState } from "./checkin";
import { standingsFor } from "./standing";
import { openOffers, graceState } from "./restore";
import { userDay } from "./config";

// Home's list: every activity a person tracks, where it stands right now, and
// the one thing they can do about it.
//
// The status line is the MODULE's, through the same `hint` the check-in screen
// uses, so "2 of 3 meals" is written once and by the type that knows what a
// meal is.

export interface TodayRow {
  typeKey: string;
  name: string;
  icon: string;
  kind: CheckinKind;
  /**
   * What a `declare` type's two buttons say, in its own words.
   *
   * The engine renders these and never reads them, which is what keeps
   * invariant 6: "It held" is right for an abstinence and wrong for Morning
   * sunlight, and only the module can know which.
   */
  answers: DeclareAnswers;
  streak: number;
  /** Not one of this activity's days: shown greyed, and not counted. */
  scheduled: boolean;
  /** The period already passes on what is recorded. Draws the tick. */
  done: boolean;
  /**
   * Something counted today. Counts toward the day at the top of Home.
   *
   * The same as `done` for the eleven types whose period is a day. Gym's is a
   * week, so a session this afternoon leaves `done` false until the week is
   * met, and the day's count would not move for work that plainly happened.
   */
  countedToday: boolean;
  /** A window is open and something can be pressed. */
  open: boolean;
  /**
   * Something is already recorded for this period, whatever it was.
   *
   * The control's word depends on it. A declared day that can still be
   * corrected is not a day waiting to be checked in.
   */
  recorded: boolean;
  /** The step to check in, when one is open. */
  step: string | null;
  status: string;
  /**
   * `status` as it would read once one more press of the open step lands.
   * Home shows it the moment the tick is pressed. Null when there is nothing
   * to press, or when the module writes no hint.
   */
  nextStatus: string | null;
  /**
   * The streak that just ended, and what it would cost to bring it back.
   *
   * Set whenever the offer is open. `affordable` is what decides the CONTROL:
   * not affordable means no Restore here at all, because a disabled one is a
   * thing to wonder about on the screen looked at most and there is nothing to
   * do about it from here. The grey flame still shows, which is what a broken
   * streak looked like before any of this, and the grace screen keeps the
   * offer, drops its button and says what it needs against what you have.
   */
  restore: { cost: number; restoresTo: number; affordable: boolean } | null;
  /**
   * The run has ended but the number has not fallen. GREY.
   *
   * Not the same as `restore` being set. A weekly week goes grey the moment its
   * minimum becomes unreachable, which is usually mid-week, and there is no
   * offer yet because the price is not final: nothing logged by Saturday is
   * three short, and two sessions over the weekend makes it one. So a row can
   * be grey with nothing to press, and that is the honest state to draw.
   */
  grey: boolean;
}

export interface Today {
  rows: TodayRow[];
  done: number;
  of: number;
  /**
   * Grace left in the pool this month.
   *
   * One number for the whole board rather than one a row: it is the account's,
   * not the activity's (item 19). The sheet behind a Restore states the price
   * against it.
   */
  graceLeft: number;
}

export async function todayFor(userId: string): Promise<Today> {
  const activities = (await listUserActivities(userId)).filter((a) => a.enabled);
  if (activities.length === 0) return { rows: [], done: 0, of: 0, graceLeft: 0 };

  // Every standing at once, then every check-in state at once. The rows do not
  // depend on each other, and awaiting them one activity at a time made Home
  // as slow as its longest chain of round trips rather than its slowest query.
  const standings = await standingsFor(userId);
  const [states, offers, grace] = await Promise.all([
    Promise.all(activities.map((a) => getCheckinState(userId, a.typeKey))),
    openOffers(userId),
    graceState(userId),
  ]);

  const rows: TodayRow[] = [];
  activities.forEach((activity, i) => {
    const type = getActivityType(activity.typeKey);
    const state = states[i];
    if (!state) return;

    const open = state.steps.find((s) => s.open) ?? null;
    const hint = state.steps.find((s) => s.hint)?.hint ?? null;
    const lastAt = state.recorded.at(-1)?.atLabel ?? null;

    const base = !state.scheduled
      ? "Not scheduled today"
      : state.passed
        ? (hint ?? (lastAt ? `Logged ${lastAt}` : "Done"))
        : open
          ? (hint ?? `${open.label} window closes ${open.closesLabel}`)
          : (hint ?? "No window open");

    // Three things the engine has to say about its own rules, because a row
    // that does not say them reads as broken.
    //
    // A gap holds the control down, and without a word the activity looks like
    // it has stopped working.
    //
    // A met period that still offers a control is the other way round, and it
    // was reported as a bug within an hour of being built: four meals logged,
    // the count met, and Food "just keeps on asking for Log". It was not
    // asking. Once a repeating step has met the period, the control is an
    // offer rather than a demand, and nothing on the row drew that line. Saying
    // so is the engine's job and not the module's: what counts is the module's
    // business, whether another press would still be taken is this one's.
    // And a GREY WEEK, which is the third. "0 of 3 this week" beside a dead
    // flame reads as a bug rather than as a week that is over, so the engine
    // says which it is. No number and no activity word in it: what the week
    // counts is the module's business (invariant 6) and `base` has said it.
    //
    // WEEKLY ONLY, and the guard is load-bearing. A daily miss greys too now,
    // and without this every missed glass of water read "1 of 8 today. This
    // week can no longer be made." A daily row needs no sentence anyway: the
    // dead flame says the run ended and there is no ambiguity about what a
    // missed day was. The comment here used to be a warning to whoever made
    // daily grey; they were me, I did not read it, and the simulation did.
    const grey =
      (standings.get(activity.typeKey)?.grey ?? false) &&
      periodUnit(activity.schedule.schedule) === "week";
    const waiting = state.steps.find((s) => s.waitingUntil)?.waitingUntil ?? null;
    const status = !state.scheduled
      ? base
      : grey
        ? `${base} This week can no longer be made.`
        : waiting && !open
          ? `${base} Next counts ${waiting}.`
          : state.passed && open
            ? `${base} Another still counts.`
            : base;

    rows.push({
      typeKey: activity.typeKey,
      name: type.name,
      icon: type.icon,
      kind: type.checkin.kind,
      answers: type.checkin.answers ?? DEFAULT_ANSWERS,
      streak: standings.get(activity.typeKey)?.streak ?? 0,
      grey: standings.get(activity.typeKey)?.grey ?? false,
      scheduled: state.scheduled,
      done: state.passed,
      countedToday: state.countedToday,
      // Offered when another press would count, NOT when the period is still
      // failing. Those came apart in three places at once.
      //
      // A week of three gym sessions passes on Wednesday, and Thursday's
      // session is a fourth day at the gym that adds to the streak: the row
      // said done and drew no control, so it could not be recorded from Home.
      // Food and Screen are the same line from the other side, and worse. Food
      // passes at three meals under the calorie limit, so the meal that would
      // break the limit was the one Home refused to take, and the day scored as
      // passed on what was recorded before it. An abstinence type passes the
      // moment you say it held, which withdrew the correction its own module
      // allows ("I slipped" after "It held").
      //
      // Where another press does nothing, the step is already not open: the
      // window has closed, or the module's `countsNow` says no, or it is a step
      // that happens once a period and has happened. Sleep and Office are
      // unchanged for exactly that reason. Nothing here learns what a type
      // means (invariant 6), and nothing is offered that the write path would
      // refuse: an unscheduled day is refused, so it is not offered either.
      open: state.scheduled && open !== null,
      recorded: state.recorded.length > 0,
      step: open?.key ?? null,
      restore: (() => {
        const offer = offers.find((o) => o.typeKey === activity.typeKey);
        return offer
          ? {
              cost: offer.cost,
              restoresTo: offer.restoresTo,
              affordable: offer.affordable,
            }
          : null;
      })(),
      status,
      nextStatus: state.scheduled ? (open?.nextHint ?? null) : null,
    });
  });

  // Everything due today, and how much of it is done. An unscheduled activity
  // is not a miss and is not counted.
  //
  // Counted on `countedToday`, not `done`. They differ only for a period
  // longer than a day, and there they differ in both directions: a gym session
  // this afternoon moves this, where `done` would wait for the week; and once
  // the week is met nothing more is wanted today, so it counts then too. A
  // rest day in a met week is not a shortfall.
  const due = rows.filter((r) => r.scheduled);
  return {
    rows,
    done: due.filter((r) => r.countedToday).length,
    of: due.length,
    graceLeft: grace.left,
  };
}

/** The user's own date, for the header and the greeting-free copy. */
export async function todayDate(userId: string): Promise<string> {
  return userDay(userId);
}
