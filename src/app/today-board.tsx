"use client";

import { useEffect, useState } from "react";
import type { TodayRow } from "@/server/today";
import { ActivityRow } from "./activity-row";
import { DayComplete } from "./day-complete";

/**
 * Today's count and today's rows, and the only thing on Home that knows a
 * check-in just landed.
 *
 * The mock is V3Recorded. A partial day gets nothing over the top: the count
 * rolls, the newly-filled segment grows left to right, the row that changed
 * carries a rule down its left, and all of it is gone a few seconds later. It
 * costs no screen and interrupts nothing, which is the only reason it still
 * holds up when someone logs four glasses of water in a minute.
 *
 * Two things can put a row into that state, and both arrive here the same way.
 * A counter's `+1` is pressed on this screen and says so through `onRecord`. A
 * check-in made on `/checkin/<key>` navigates back to `/?done=<key>`, which is
 * `initialRecorded`. Neither records anything: the check-in was an explicit
 * POST before either got here (invariant 9), and the param is a display hint
 * that a GET cannot turn into a check-in.
 */

/** How long the row keeps its rule, and how long the old count hangs about. */
const HOLD_MS = 4200;

export function TodayBoard({
  rows,
  done,
  of,
  initialRecorded,
  dateLabel,
  dueIcons,
}: {
  rows: TodayRow[];
  done: number;
  of: number;
  /** The type key named by `?done=`, when Home was reached from a check-in. */
  initialRecorded: string | null;
  /** The day, for the stamp, spelled by the server (invariant 8). */
  dateLabel: string;
  /** The activities that were due today, for the stamp's one line of icons. */
  dueIcons: string[];
}) {
  const [recorded, setRecorded] = useState<string | null>(initialRecorded);

  // `?done=` describes a moment, and a moment does not survive a reload. Taking
  // it out of the URL means refreshing this page does not replay the roll or
  // re-stamp a day that was finished ten minutes ago. history.replaceState
  // rather than router.replace: nothing needs re-fetching, only the address bar
  // is wrong.
  useEffect(() => {
    if (!initialRecorded) return;
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      // Nothing depends on it. Worst case a reload replays the moment.
    }
  }, [initialRecorded]);

  // The mark is a moment, not a state. It goes on its own, so a screen left
  // open does not sit there claiming something just happened.
  useEffect(() => {
    if (!recorded) return;
    const timer = setTimeout(() => setRecorded(null), HOLD_MS);
    return () => clearTimeout(timer);
  }, [recorded]);

  // Once the server render arrives, the recorded row is done and the count has
  // already moved. The number it moved from is therefore this one minus one,
  // which is the only place the "3 → 4" comes from: nothing stores the old
  // count, and nothing needs to.
  const rolled = recorded !== null && rows.some((r) => r.typeKey === recorded && r.done);
  const from = rolled && done > 0 ? done - 1 : null;

  // The stamp marks the check-in that finished the day, so it needs both: one
  // just landed, and there is nothing left open. Opening Home on a day already
  // finished shows nothing, because nothing just happened.
  const justFinishedTheDay = recorded !== null && of > 0 && done === of;

  return (
    <>
      <section className="flex flex-col gap-[6px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">TODAY</span>
        <div className="flex items-baseline gap-[10px]">
          {/* One slot, two numbers. The old one lifts out of it and the new one
              rises into it, which is what a roll is. Side by side it would be
              two numbers, and the one that stays would sit a digit to the
              right of where it belongs. */}
          <span className="relative flex leading-none">
            {from !== null ? (
              <span
                aria-hidden="true"
                className="roll-out absolute left-0 top-0 text-[38px] font-semibold leading-none tabular-nums text-muted"
              >
                {from}
              </span>
            ) : null}
            <span
              key={done}
              className={
                "text-[38px] font-semibold leading-none tabular-nums " +
                (from !== null ? "roll-in" : "")
              }
            >
              {done}
            </span>
          </span>
          <span className="text-[15px] text-muted">of {of} done</span>
        </div>
        <div className="mt-[6px] flex gap-1">
          {Array.from({ length: of }, (_, i) => {
            const filled = i < done;
            // The segment this check-in filled grows into place. Every other
            // one is drawn as it always was.
            const growing = filled && from !== null && i === done - 1;
            return (
              <div key={i} className={"h-[3px] flex-1 " + (filled ? "" : "bg-rule")}>
                {filled ? (
                  <div className={"h-[3px] bg-fg " + (growing ? "fill-right" : "w-full")} />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col">
        {rows.map((row) => (
          <ActivityRow
            key={row.typeKey}
            row={row}
            recorded={recorded === row.typeKey}
            onRecord={() => setRecorded(row.typeKey)}
          />
        ))}
      </section>

      {justFinishedTheDay ? (
        <DayComplete dateLabel={dateLabel} icons={dueIcons} />
      ) : null}
    </>
  );
}
