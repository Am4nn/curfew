import { z } from "zod";
import { DateTime } from "luxon";
import type {
  ActivityType,
  FieldIssue,
  CheckinStep,
  CheckinWindow,
} from "../types";
import { EVERY_DAY } from "../schedule";
import { clockLabel } from "../windows";

// The sleep activity type. This module is the ONLY place that knows sleep has a
// night, a wake and a confirm step, and the only place `night_ok` and friends
// exist (invariant 6). Everything outside consumes { passed, detail }.

const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

/**
 * The confirm window, anchored to the wake press (item 17).
 *
 * It opens half an hour after you say you are up and stays open half an hour.
 * It is not a setting and cannot be: a confirm you place yourself is a confirm
 * you can place at an hour you are already up, and the confirm carries the only
 * photograph sleep asks for (decision 45), which is the whole reason it exists.
 */
const CONFIRM_DELAY_MINUTES = 30;
const CONFIRM_OPEN_MINUTES = 30;

/**
 * Four keys, and deliberately NOT `.strict()`.
 *
 * Config is insert-only and resolved as it stood on the period being judged
 * (invariant 5), so rows written before v3.2 still carry `confirm_open` and
 * `confirm_close`, and those rows are still the truth about how those nights
 * were scored. `windows` reads them off such a row and judges it the old way.
 *
 * Zod's default is to STRIP an unknown key rather than reject it, which is
 * exactly right here and is the whole reason `.strict()` is gone: an old row
 * still parses, so the configure screen opens on it, and every save writes the
 * current four keys because `saveUserActivity` stores what the schema returned.
 * A row that still has the retired pair is a row nobody has saved since, and
 * `bun run migrate:sleep` is what moves those forward on a date invariant 4
 * allows. The typo-catching `.strict()` bought is covered by the module being
 * typed `ActivityType<SleepConfig>`, which rejects a misspelled default at the
 * compiler rather than at runtime.
 */
export const sleepConfigSchema = z.object({
  night_open: HHMM,
  night_close: HHMM,
  wake_open: HHMM,
  wake_close: HHMM,
});

export type SleepConfig = z.infer<typeof sleepConfigSchema>;

/**
 * A pre-v3.2 config's own confirm window, or null.
 *
 * Read off the raw stored object rather than the parsed one, because the parse
 * is what strips them. Both have to be there and both have to be times: half a
 * window is not a window anybody was judged against.
 */
function retiredConfirm(config: SleepConfig): { open: string; close: string } | null {
  const raw = config as unknown as Record<string, unknown>;
  const open = raw.confirm_open;
  const close = raw.confirm_close;
  if (typeof open !== "string" || typeof close !== "string") return null;
  if (!HHMM.safeParse(open).success || !HHMM.safeParse(close).success) return null;
  return { open, close };
}

// The timestamp is the evidence for sleep, so the payload is empty.
const sleepEvidenceSchema = z.object({}).strict();
export type SleepEvidence = z.infer<typeof sleepEvidenceSchema>;

// The two windows that ARE clock times. Confirm is not one of them any more.
const CLOCK_STEPS = [
  { key: "night", label: "Night", open: "night_open", close: "night_close" },
  { key: "wake", label: "Wake", open: "wake_open", close: "wake_close" },
] as const;

// Absolute instant of a wall-clock "HH:mm" within a noon-to-noon period.
// The period starts at noon on `periodStart` and ends at noon the next day, so
// a time before noon (wake 06:00, confirm 07:30) lands on the following
// calendar day, while an evening time (night 22:00) stays on periodStart.
function instantWithin(
  periodStart: string,
  timezone: string,
  hhmm: string,
): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  const midnight = DateTime.fromISO(periodStart, { zone: timezone }).startOf("day");
  const day = h < 12 ? midnight.plus({ days: 1 }) : midnight;
  return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

/** The luxon pair a CheckinWindow carries, as the Dates it carries. */
function toWindow(w: {
  step: string;
  label: string;
  opensAt: DateTime;
  closesAt: DateTime;
}): CheckinWindow {
  return {
    step: w.step,
    label: w.label,
    opensAt: w.opensAt.toJSDate(),
    closesAt: w.closesAt.toJSDate(),
  };
}

/** "07:00" plus 60 is "08:00". Wraps at midnight, which no caller here does. */
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "HH:mm" as minutes since midnight, for the wake-time chart's axis. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** An instant's minutes since local midnight, in a given timezone. */
function minutesSinceMidnight(instant: Date, timezone: string): number {
  const dt = DateTime.fromJSDate(instant, { zone: timezone });
  return dt.hour * 60 + dt.minute;
}

// Validate a complete nightly schedule against the same absolute instants used
// for check-ins and scoring. Wall-clock ordering is insufficient because the
// wake and confirm windows belong to the following calendar morning.
export function validateSleepWindows(
  config: SleepConfig,
  timezone: string,
  forPeriodStart: string,
): string[] {
  const resolved = CLOCK_STEPS.map((step) => ({
    ...step,
    opensAt: instantWithin(forPeriodStart, timezone, config[step.open]),
    closesAt: instantWithin(forPeriodStart, timezone, config[step.close]),
  }));
  const periodOpensAt = DateTime.fromISO(forPeriodStart, { zone: timezone })
    .startOf("day")
    .set({ hour: 12 });
  const periodClosesAt = periodOpensAt.plus({ days: 1 });
  const errors: string[] = [];

  for (const window of resolved) {
    if (window.opensAt >= window.closesAt) {
      errors.push(`${window.label} window closes before it opens.`);
    }
    if (window.opensAt < periodOpensAt || window.closesAt >= periodClosesAt) {
      errors.push(`${window.label} window must stay within the noon-to-noon day.`);
    }
  }

  const [night, wake] = resolved;
  if (night.closesAt > wake.opensAt) {
    errors.push("Wake window overlaps the night window.");
  }
  // The confirm hangs off the wake press, so the latest it can finish is an
  // hour after the wake window shuts. That has to land inside the same
  // noon-to-noon day, or a night could end after the day it belongs to.
  if (wake.closesAt.plus({ minutes: CONFIRM_DELAY_MINUTES + CONFIRM_OPEN_MINUTES }) >= periodClosesAt) {
    errors.push("Wake window must close an hour before noon, so the confirm fits.");
  }

  return errors;
}
/**
 * The same rules as validateSleepWindows, reported against the field they
 * belong to so the configure screen can mark them in place (decision 47).
 */
export function sleepIssues(config: SleepConfig): FieldIssue[] {
  const zone = "UTC";
  const day = "2026-01-05";
  const resolved = CLOCK_STEPS.map((step) => ({
    ...step,
    opensAt: instantWithin(day, zone, config[step.open]),
    closesAt: instantWithin(day, zone, config[step.close]),
  }));
  const periodOpensAt = DateTime.fromISO(day, { zone }).startOf("day").set({ hour: 12 });
  const periodClosesAt = periodOpensAt.plus({ days: 1 });
  const issues: FieldIssue[] = [];

  for (const window of resolved) {
    if (window.opensAt >= window.closesAt) {
      issues.push({ path: window.open, message: "The window closes before it opens." });
    }
    if (window.opensAt < periodOpensAt || window.closesAt >= periodClosesAt) {
      issues.push({
        path: window.open,
        message: "The window must stay inside the noon-to-noon day.",
      });
    }
  }

  const [night, wake] = resolved;
  if (night.closesAt > wake.opensAt) {
    issues.push({
      path: "wake_open",
      message: "Wake overlaps the night window. They cannot share a minute.",
    });
  }
  if (wake.closesAt.plus({ minutes: CONFIRM_DELAY_MINUTES + CONFIRM_OPEN_MINUTES }) >= periodClosesAt) {
    issues.push({
      path: "wake_open",
      message: "The confirm runs an hour after this closes, and has to finish before noon.",
    });
  }
  return issues;
}

export const sleepActivity: ActivityType<SleepConfig, SleepEvidence> = {
  key: "sleep",
  name: "Sleep",
  description: "Three timed check-ins a night",
  icon: "sleep",
  category: "sleep",
  measure: "consistency",

  // Sleep is the reason dayBoundary exists: a 00:30 press belongs to the night
  // that just ended, so its day runs noon to noon.
  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "noon",
    config: {
      night_open: "21:30",
      night_close: "23:00",
      wake_open: "05:30",
      wake_close: "07:00",
    },
  },

  configSchema: sleepConfigSchema,
  evidenceSchema: sleepEvidenceSchema,

  // Required on the confirm window only (decision 45). Proving you woke is the
  // one moment a photo says anything; a photo at 22:00 says nothing.
  evidence: {
    level: "required",
    source: "live",
    steps: ["confirm"],
    detail: "On the confirm window. Live camera.",
  },
  checkin: { kind: "camera" },
  chart: { kind: "windowed", heading: "WAKE TIME" },

  facts: [
    {
      title: "Judged noon to noon",
      sub: "A late night belongs to the night before.",
    },
  ],

  summary(config) {
    return (
      `in bed between ${clockLabel(config.night_open)} and ${clockLabel(config.night_close)}, ` +
      `up between ${clockLabel(config.wake_open)} and ${clockLabel(config.wake_close)}, ` +
      `then a photograph ${CONFIRM_DELAY_MINUTES} minutes after you say you are up`
    );
  },

  fields() {
    return [
      {
        kind: "timeRange",
        label: "Night window",
        openKey: "night_open",
        closeKey: "night_close",
      },
      {
        kind: "timeRange",
        label: "Wake window",
        openKey: "wake_open",
        closeKey: "wake_close",
      },
      {
        kind: "fixed",
        label: "Confirm window",
        value: `${CONFIRM_DELAY_MINUTES} min after wake`,
        note: `Open for ${CONFIRM_OPEN_MINUTES} minutes. Not a setting, or you could place it where you are already up.`,
      },
    ];
  },

  // Three pairs of times that may not cross each other. No object schema can
  // say that, so the module says it, against the paths that are wrong.
  validate(config) {
    return sleepIssues(config);
  },

  steps(config: SleepConfig): CheckinStep[] {
    const retired = retiredConfirm(config);
    return [
      ...CLOCK_STEPS.map((s) => ({
        key: s.key,
        label: s.label,
        open: config[s.open],
        close: config[s.close],
      })),
      {
        key: "confirm",
        label: "Confirm",
        // A step's open and close are clock times, and the confirm's are not
        // known until Wake is pressed. The widest it could be is what goes
        // here; the real pair is on the WINDOW, which is what anything that
        // matters reads.
        open: retired?.open ?? addMinutes(config.wake_open, CONFIRM_DELAY_MINUTES),
        close:
          retired?.close ??
          addMinutes(config.wake_close, CONFIRM_DELAY_MINUTES + CONFIRM_OPEN_MINUTES),
      },
    ];
  },

  windows(config, periodStart, timezone, checkins = []): CheckinWindow[] {
    const clock = CLOCK_STEPS.map((s) => ({
      step: s.key,
      label: s.label,
      opensAt: instantWithin(periodStart, timezone, config[s.open]),
      closesAt: instantWithin(periodStart, timezone, config[s.close]),
    }));
    const wake = clock[1];

    // A config row written before v3.2 keeps the clock-time confirm it was
    // judged against. Invariant 5: a period is resolved as its config stood,
    // and rewriting those nights to the new rule is exactly what that forbids.
    const retired = retiredConfirm(config);
    if (retired) {
      return [
        ...clock.map(toWindow),
        toWindow({
          step: "confirm",
          label: "Confirm",
          opensAt: instantWithin(periodStart, timezone, retired.open),
          closesAt: instantWithin(periodStart, timezone, retired.close),
        }),
      ];
    }

    // The wake press this confirm hangs off. The earliest one inside the wake
    // window, for the same reason `evaluate` plots the earliest: a second press
    // cannot move a window somebody may already be inside. There can only be
    // one anyway, since the step does not repeat, but saying which makes that a
    // property of this module rather than of the engine's spent-step guard.
    const pressed = checkins
      .filter(
        (c) =>
          c.step === "wake" &&
          c.at.getTime() >= wake.opensAt.toMillis() &&
          c.at.getTime() <= wake.closesAt.toMillis(),
      )
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

    if (pressed) {
      const from = DateTime.fromJSDate(pressed.at, { zone: timezone });
      return [
        ...clock.map(toWindow),
        toWindow({
          step: "confirm",
          label: "Confirm",
          opensAt: from.plus({ minutes: CONFIRM_DELAY_MINUTES }),
          closesAt: from.plus({
            minutes: CONFIRM_DELAY_MINUTES + CONFIRM_OPEN_MINUTES,
          }),
        }),
      ];
    }

    // Nothing to anchor to yet. The pair is the widest it could turn out to
    // be, so anything asking whether the night is over waits until it cannot
    // still be running, and `waitingOn` stops a press landing in the meantime.
    return [
      ...clock.map(toWindow),
      {
        step: "confirm",
        label: "Confirm",
        opensAt: wake.opensAt.plus({ minutes: CONFIRM_DELAY_MINUTES }).toJSDate(),
        closesAt: wake.closesAt
          .plus({ minutes: CONFIRM_DELAY_MINUTES + CONFIRM_OPEN_MINUTES })
          .toJSDate(),
        waitingOn: {
          step: "wake",
          message: `Opens ${CONFIRM_DELAY_MINUTES} minutes after you press Wake.`,
        },
      },
    ];
  },

  evaluate(input) {
    const wins = this.windows(
      input.config,
      input.periodStart,
      input.timezone,
      input.checkins,
    );
    const ok = (step: string) => {
      const w = wins.find((x) => x.step === step)!;
      // A window still waiting on another press has not started, so nothing
      // can be inside it. Without this the confirm was satisfiable with no
      // wake press at all: the fallback pair is the widest the window COULD
      // be, and a press landing in it would have counted against a window that
      // never opened.
      if (w.waitingOn) return false;
      const open = w.opensAt.getTime();
      const close = w.closesAt.getTime();
      return input.checkins.some(
        (c) => c.step === step && c.at.getTime() >= open && c.at.getTime() <= close,
      );
    };
    const night_ok = ok("night");
    const wake_ok = ok("wake");
    const confirm_ok = ok("confirm");

    // The earliest wake press, as minutes since local midnight, for the stats
    // chart's scatter plot. Computed in the period's own timezone so the plot
    // never depends on whichever timezone later reads it (invariant 5's
    // resolve-as-scored applies to this too, not only pass/fail).
    const wakeCheckins = input.checkins
      .filter((c) => c.step === "wake")
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    const wake_at_minutes = wakeCheckins.length
      ? minutesSinceMidnight(wakeCheckins[0].at, input.timezone)
      : null;

    return {
      passed: night_ok && wake_ok && confirm_ok,
      detail: {
        night_ok,
        wake_ok,
        confirm_ok,
        wake_at_minutes,
        wake_window_open_minutes: minutesOf(input.config.wake_open),
        wake_window_close_minutes: minutesOf(input.config.wake_close),
      },
    };
  },
};
