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
 * It marks a MOMENT, not a state, and that distinction is the whole design.
 * The first version asked "has this day been stamped yet" and kept the answer
 * in localStorage, which made it a state, and a state kept per browser: a
 * second device had never written the key, so it stamped the same day again on
 * a day nothing had happened. Storing it properly would mean a row per user per
 * day, which is mutable state for a display, and invariant 1 says to say so
 * rather than add it.
 *
 * So it stores nothing. It fires when a check-in lands in this session and that
 * check-in completed the day, which is the moment it is describing. Opening
 * Home later, on any device, shows nothing, because nothing just happened.
 */

/** How long it sits there before it starts leaving. */
const HOLD_MS = 2600;
/** And how long it takes to go. Matches .overlay-out in globals.css. */
const LEAVE_MS = 360;

export function DayComplete({
  /** The day the stamp names, as the server resolved it. Client clocks are not used. */
  dateLabel,
  /** One per activity that was due today, in the order Home lists them. */
  icons,
}: {
  dateLabel: string;
  icons: string[];
}) {
  // "in" is the stamp landing and holding, "out" is it going. It has to be a
  // phase rather than an unmount, because a stamp that cuts makes the screen
  // flick instead of clear.
  const [phase, setPhase] = useState<"in" | "out" | "none">("in");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("out"), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Leaving is timed rather than hung off animationend, so a browser that
  // refuses the animation still gets rid of it.
  useEffect(() => {
    if (phase !== "out") return;
    const timer = setTimeout(() => setPhase("none"), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "none") return null;

  return (
    <div
      role="status"
      onClick={() => setPhase("out")}
      className={
        "fixed inset-0 z-40 flex flex-col items-center justify-center gap-[26px] " +
        (phase === "out" ? "overlay-out" : "scrim-in")
      }
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
