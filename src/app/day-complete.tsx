"use client";

import { useEffect, useState } from "react";
import { ActivityIcon } from "./activity-icon";

/**
 * The last activity of the day, stamped.
 *
 * The mock is V3DayComplete. A clerk stamps the form and not the line item, so
 * the stamp lands on the date, with the day's list under it compressed to one
 * row of icons. Home is dimmed rather than blacked out: the rows stay faintly
 * legible, so it reads as something that happened to the screen you were on
 * instead of a place you were sent to.
 *
 * It fires when the last scheduled activity closes, which is once a day at
 * most and on a bad day never. That scarcity is the whole design. Curfew does
 * not congratulate, so there is no sentence here telling anyone they did well:
 * it states the date and the fact, and goes.
 *
 * Seen-ness is kept in localStorage, per day, and nowhere else. It is a
 * per-device display nicety, not a fact about the record, so it earns no event
 * and no column (invariant 1). Storage that throws or comes back empty means
 * the stamp shows again, which is the harmless failure of the two.
 */

const KEY = "curfew:day-complete";
const HOLD_MS = 2600;

export function DayComplete({
  /** The user's own day, as the server resolved it. Client clocks are not used. */
  dateKey,
  /** The same day, spelled the way the stamp says it. */
  dateLabel,
  /** One per activity that was due today, in the order Home lists them. */
  icons,
}: {
  dateKey: string;
  dateLabel: string;
  icons: string[];
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(KEY);
    } catch {
      // A private window, or site data switched off. Show it.
    }
    if (seen === dateKey) return;
    try {
      window.localStorage.setItem(KEY, dateKey);
    } catch {
      // Nothing to do. Worst case it appears again on the next load.
    }
    setShow(true);
    const timer = setTimeout(() => setShow(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [dateKey]);

  if (!show) return null;

  return (
    <div
      role="status"
      onClick={() => setShow(false)}
      className="scrim-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-[26px]"
      style={{ backgroundColor: "var(--scrim-93)" }}
    >
      <div className="stamp-in flex flex-col items-center gap-[6px] border-[3px] border-pass px-[30px] py-4 text-pass">
        <span className="text-[38px] font-semibold leading-none tracking-[0.08em]">
          COMPLETE
        </span>
        <span className="text-[12px] tracking-[0.24em] opacity-75">{dateLabel}</span>
      </div>
      <div className="flex items-center gap-[14px] text-pass opacity-85">
        {icons.map((icon, i) => (
          <ActivityIcon key={`${icon}-${i}`} name={icon} size={17} />
        ))}
      </div>
      <span className="text-[12.5px] text-muted">Everything you scheduled, done.</span>
    </div>
  );
}
