"use client";

import Link from "next/link";
import type { TodayRow } from "@/server/today";
import { ActivityIcon, DeadFlame, Flame } from "./activity-icon";
import { CheckinButton } from "./checkin-button";
import { RestoreButton } from "./restore-sheet";

/**
 * One activity on Home: where it stands, and the one thing to do about it.
 *
 * It is a client component for two reasons. A counter's `+1` used to leave the
 * old count on screen until the server round trip returned, so pressing it
 * looked like nothing had happened for as long as the network took. The row
 * shows `nextStatus` the moment the press lands and the server's own text
 * replaces it when the refresh arrives. And a row that has just been recorded
 * carries a rule down its left for a few seconds, so the eye finds the thing
 * that changed without anything covering the screen (mock: V3Recorded).
 *
 * Both flags are owned by TodayBoard, because the count above the list has to
 * move at the same moment and for the same reason.
 *
 * They are two flags rather than one because they end at different times, and
 * conflating them was a bug. `recorded` is a moment and lasts a few seconds.
 * `optimistic` lasts only until the server's own render arrives: `nextStatus`
 * means "one more press than this row shows", so a row still substituting it
 * after the refresh reads one too high. Pressing a fourth glass showed 4, then
 * 5, then fell back to 4 when the mark timed out.
 *
 * `nextStatus` is written by the activity's module, like `status` is, so
 * nothing here knows what a glass or a meal is (invariant 6). The optimism is
 * only ever a display: the check-in is still an explicit POST (invariant 9),
 * and if it fails the button says so and the real status comes back.
 */
export function ActivityRow({
  row,
  graceLeft = 0,
  recorded = false,
  optimistic = false,
  onRecord,
}: {
  row: TodayRow;
  /** The account's pool, for the sheet behind a Restore. */
  graceLeft?: number;
  /** This row is the one that just landed: it carries the mark. */
  recorded?: boolean;
  /** The press is not in the server's render yet, so show where it is going. */
  optimistic?: boolean;
  /** A press on this row was recorded, before the refresh lands. */
  onRecord?: () => void;
}) {
  const status = optimistic && row.nextStatus ? row.nextStatus : row.status;

  // An abstinence type is answered here, on this row, and has no screen of its
  // own any more. It had one, and the screen was a heading, the same question
  // the row had already asked, two buttons and two paragraphs, reached by a
  // press, to record a single boolean. Nothing on it could not be said in the
  // space under the row.
  //
  // `declare` is the module's own `checkin.kind`, so this is not a list of
  // types: any type that declares itself answerable is answered here
  // (invariant 6).
  const declaring = row.kind === "declare" && row.open && row.step !== null;

  return (
    <div
      className={
        "relative border-b border-rule " + (row.scheduled ? "" : "opacity-[0.42]")
      }
    >
      <div className={"flex items-center gap-3 " + (declaring ? "pb-[11px] pt-[13px]" : "py-[13px]")}>
      {/* The mark for a row that just changed. Positioned rather than a border,
          so it sits out in the page margin and the divider under every row
          stays exactly where it was; always mounted, so it fades both ways
          rather than snapping on and off. */}
      <span
        aria-hidden="true"
        className={
          "absolute inset-y-0 left-[-11px] w-[2px] bg-pass transition-opacity duration-300 " +
          (recorded ? "opacity-100" : "opacity-0")
        }
      />
      <Link
        href={`/activities/${row.typeKey}`}
        className={"flex flex-none " + (row.scheduled ? "text-fg" : "text-muted")}
      >
        <ActivityIcon name={row.icon} size={20} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-center gap-[9px]">
          <span className="text-[14px]">{row.name}</span>
          {/* A rest day is not a broken streak, so an unscheduled row still
              carries its count. The whole row is at 0.42, so the flame dims
              with it rather than needing a duller treatment of its own. */}
          {row.grey ? (
            // GREY: the run that just ended, in the same place, gone out (item
            // 19). The number has NOT fallen. A week that came short and a day
            // that was missed both hold what they earned, and the flame going
            // out is what says the run is over.
            //
            // Asked BEFORE `streak > 0`, because a grey run still has a
            // positive count and would otherwise draw a live flame over a dead
            // one. This branch used to key off `restore` instead, which drew
            // nothing at all once an offer expired: a forty day run simply
            // disappeared from the row. Grey outlives the offer, so it does not.
            //
            // There may be nothing to press yet. A week goes grey the moment
            // its minimum is unreachable, and the price of forgiving it is not
            // final until the week ends, so the control below waits for
            // `restore` while this does not.
            //
            // The status line is left alone: it still says what the period is
            // doing, because that is still true, and a row that rewrites itself
            // to talk about grace has stopped being a row about the activity.
            <span className="flex items-center gap-1">
              <DeadFlame size={13} />
              <span className="text-[12px] leading-none text-muted tabular-nums">
                {row.streak}
              </span>
            </span>
          ) : row.streak > 0 ? (
            <span className="flex items-center gap-1">
              <Flame size={13} />
              <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-[12px] font-medium leading-none text-transparent tabular-nums">
                {row.streak}
              </span>
            </span>
          ) : null}
        </div>
        <span className="truncate text-[11.5px] text-muted">{status}</span>
      </div>

      {/* The tick and the control are not alternatives. A period can be passed
          and still take another press: a fourth gym session in a week of
          three, the meal that breaks the calorie limit, the evening's screen
          time after a morning reading came in under it. The row says both, and
          the control drops to the secondary treatment so a day already done
          does not shout at anyone. Where a press would do nothing the step is
          not open, so Sleep and Office read exactly as the mock draws them. */}
      {row.done || row.restore?.affordable || (row.open && row.step) ? (
        <div className="flex flex-none items-center gap-[10px]">
          {/* The other thing that differs. It sits BESIDE Check in rather than
              instead of it: the week ended, the activity did not, and checking
              in is still the thing to do today. Outlined, so it reads as the
              secondary offer it is while Check in keeps the filled treatment
              it has on every other row.

              Nothing here states the price. That belongs in the sheet, where
              the decision is. And there is no button at all when the pool
              cannot cover it: a disabled control is a thing to wonder about on
              the screen looked at most, and the grey flame alone is what a
              broken streak looked like before any of this existed. */}
          {row.restore?.affordable ? (
            <RestoreButton
              offer={{
                typeKey: row.typeKey,
                name: row.name,
                icon: row.icon,
                cost: row.restore.cost,
                restoresTo: row.restore.restoresTo,
                left: graceLeft,
              }}
            />
          ) : null}
          {row.done ? (
            <span className="flex items-center gap-[6px] text-[12px] text-pass">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="square"
                aria-hidden="true"
              >
                <path d="M4 12.5 9 17.5 20 6.5" />
              </svg>
              done
            </span>
          ) : null}
          {row.open && row.step && !declaring ? (
            row.kind === "counter" ? (
              <CheckinButton
                label="+1"
                typeKey={row.typeKey}
                step={row.step}
                onPressed={onRecord}
                className={"flex h-[34px] items-center px-[13px] text-[12px] disabled:opacity-60 " + control(row.done)}
              />
            ) : (
              <Link
                href={`/checkin/${row.typeKey}`}
                className={"flex h-[34px] items-center gap-[6px] px-[13px] text-[12px] " + control(row.done)}
              >
                {label(row)}
              </Link>
            )
          ) : null}
        </div>
      ) : null}
      </div>

      {/* The two answers, on their own line so neither is cramped and both are
          the same width: an honest pair of alternatives, not a suggestion and
          an escape. Already answered, they are the correction the module allows
          in as many words, so they stay and the row's own line says which one
          stands.

          The sizing is on the wrapper and the appearance on the button. They
          are not the same element, and putting both in one place is what made
          these come out small and shoved against the left edge. */}
      {declaring && row.step ? (
        <div className="flex gap-[10px] pb-[14px]">
          <CheckinButton
            label={row.answers.yes}
            busyLabel="Saving"
            typeKey={row.typeKey}
            step={row.step}
            evidence={{ held: true }}
            onPressed={onRecord}
            wrapperClassName="flex-1"
            className={
              "flex h-[42px] w-full items-center justify-center text-[13px] disabled:opacity-60 " +
              (row.done
                ? "border border-rule text-fg"
                : "border border-fg bg-fg font-semibold text-bg")
            }
          />
          <CheckinButton
            label={row.answers.no}
            busyLabel="Saving"
            typeKey={row.typeKey}
            step={row.step}
            evidence={{ held: false }}
            onPressed={onRecord}
            wrapperClassName="flex-1"
            className="flex h-[42px] w-full items-center justify-center border border-rule text-[13px] text-penalty disabled:opacity-60"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The word on the control.
 *
 * A declared day keeps its control, because the answer can be corrected:
 * "It held" and then, at ten o'clock, "I slipped". Calling that Check in was
 * wrong twice over. The check-in has happened, and what the button leads to is
 * a screen asking the same question again, so the row said a finished day was
 * unfinished.
 */
function label(row: TodayRow): string {
  if (row.kind === "camera") return "Log";
  if (row.kind === "declare" && row.recorded) return "Correct";
  return "Check in";
}

/** Filled while the day is still open, outlined once it is already passed. */
function control(done: boolean): string {
  return done ? "border border-rule text-fg" : "border border-fg bg-fg font-semibold text-bg";
}
