import { getActivityType, type CheckinKind } from "@/domain";
import { listUserActivities } from "./activities";
import { getCheckinState } from "./checkin";
import { standingsFor } from "./standing";
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
}

export interface Today {
  rows: TodayRow[];
  done: number;
  of: number;
}

export async function todayFor(userId: string): Promise<Today> {
  const activities = (await listUserActivities(userId)).filter((a) => a.enabled);
  if (activities.length === 0) return { rows: [], done: 0, of: 0 };

  // Every standing at once, then every check-in state at once. The rows do not
  // depend on each other, and awaiting them one activity at a time made Home
  // as slow as its longest chain of round trips rather than its slowest query.
  const standings = await standingsFor(userId);
  const states = await Promise.all(
    activities.map((a) => getCheckinState(userId, a.typeKey)),
  );

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

    // A gap holds the control down, and the row has to say why or it reads as
    // an activity that has stopped working. The module writes the count, the
    // engine writes this, because the gap is the engine's rule.
    const waiting = state.steps.find((s) => s.waitingUntil)?.waitingUntil ?? null;
    const status =
      waiting && !open && state.scheduled ? `${base} Next counts ${waiting}.` : base;

    rows.push({
      typeKey: activity.typeKey,
      name: type.name,
      icon: type.icon,
      kind: type.checkin.kind,
      streak: standings.get(activity.typeKey)?.streak ?? 0,
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
  };
}

/** The user's own date, for the header and the greeting-free copy. */
export async function todayDate(userId: string): Promise<string> {
  return userDay(userId);
}
