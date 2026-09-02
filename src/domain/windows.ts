import { z } from "zod";
import { DateTime } from "luxon";
import type { CheckinWindow } from "./types";

// Resolving a wall-clock window to absolute instants, for the modules that have
// one. A helper the modules call, not something the engine applies on their
// behalf: a module still decides what its windows mean and how many it has.
//
// Without this, ten modules would each reimplement "22:00 to 00:30 crosses
// midnight", and one of them would get it wrong.

export const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

export const windowSchema = z.object({ open: HHMM, close: HHMM }).strict();
export type Window = z.infer<typeof windowSchema>;

/**
 * One window on a midnight-boundary day, as absolute instants.
 *
 * A close at or before the open means the window crosses midnight: Sugar-free
 * running 20:00 to 00:00 closes at the start of the next day, not fourteen
 * hours earlier on the same one.
 */
export function windowInstants(
  periodStart: string,
  timezone: string,
  window: Window,
): { opensAt: Date; closesAt: Date } {
  const day = DateTime.fromISO(periodStart, { zone: timezone }).startOf("day");
  const [oh, om] = window.open.split(":").map(Number);
  const [ch, cm] = window.close.split(":").map(Number);

  const opensAt = day.set({ hour: oh, minute: om });
  let closesAt = day.set({ hour: ch, minute: cm });
  if (closesAt <= opensAt) closesAt = closesAt.plus({ days: 1 });

  return { opensAt: opensAt.toJSDate(), closesAt: closesAt.toJSDate() };
}

/** The single-window case, which is nine of the twelve types. */
export function oneWindow(
  step: string,
  label: string,
  periodStart: string,
  timezone: string,
  window: Window,
): CheckinWindow[] {
  const { opensAt, closesAt } = windowInstants(periodStart, timezone, window);
  return [{ step, label, opensAt, closesAt }];
}

/** A window covering the whole day, for types that accept a check-in any time. */
export const ALL_DAY: Window = { open: "00:00", close: "00:00" };

/**
 * "20:00" as "8:00 PM". Times are 12-hour with AM or PM everywhere in the UI
 * (CLAUDE.md voice), and the stored value stays 24-hour.
 */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Was this check-in inside its window? */
export function within(at: Date, window: { opensAt: Date; closesAt: Date }): boolean {
  const t = at.getTime();
  return t >= window.opensAt.getTime() && t <= window.closesAt.getTime();
}
