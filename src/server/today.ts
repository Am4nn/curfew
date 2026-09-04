import { DateTime } from "luxon";
import { getActivityType, type CheckinKind } from "@/domain";
import { listUserActivities } from "./activities";
import { getCheckinState } from "./checkin";
import { standingFor } from "./standing";
import { resolveUserTimezone } from "./config";
import { now } from "@/lib/clock";

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
  /** The period already passes on what is recorded. */
  done: boolean;
  /** A window is open and something can be pressed. */
  open: boolean;
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

  const rows: TodayRow[] = [];
  for (const activity of activities) {
    const type = getActivityType(activity.typeKey);
    const [state, standing] = await Promise.all([
      getCheckinState(userId, activity.typeKey),
      standingFor(userId, activity.typeKey),
    ]);
    if (!state) continue;

    const open = state.steps.find((s) => s.open) ?? null;
    const hint = state.steps.find((s) => s.hint)?.hint ?? null;
    const lastAt = state.recorded.at(-1)?.atLabel ?? null;

    const status = !state.scheduled
      ? "Not scheduled today"
      : state.passed
        ? (hint ?? (lastAt ? `Logged ${lastAt}` : "Done"))
        : open
          ? (hint ?? `${open.label} window closes ${open.closesLabel}`)
          : (hint ?? "No window open");

    rows.push({
      typeKey: activity.typeKey,
      name: type.name,
      icon: type.icon,
      kind: type.checkin.kind,
      streak: standing?.streak ?? 0,
      scheduled: state.scheduled,
      done: state.passed,
      open: open !== null && !state.passed,
      step: open?.key ?? null,
      status,
      nextStatus:
        state.scheduled && !state.passed ? (open?.nextHint ?? null) : null,
    });
  }

  // Everything due today, and how much of it is done. An unscheduled activity
  // is not a miss and is not counted.
  const due = rows.filter((r) => r.scheduled);
  return {
    rows,
    done: due.filter((r) => r.done).length,
    of: due.length,
  };
}

/** The user's own date, for the header and the greeting-free copy. */
export async function todayDate(userId: string): Promise<string> {
  const instant = await now();
  const timezone = await resolveUserTimezone(
    userId,
    instant.toISOString().slice(0, 10),
  );
  return DateTime.fromJSDate(instant, { zone: timezone }).toFormat("yyyy-MM-dd");
}
