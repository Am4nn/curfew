import { z } from "zod";
import { DateTime } from "luxon";
import type {
  ActivityType,
  FieldIssue,
  CheckinStep,
  CheckinWindow,
} from "../types";
import { EVERY_DAY } from "../schedule";

// The sleep activity type. This module is the ONLY place that knows sleep has a
// night, a wake and a confirm step, and the only place `night_ok` and friends
// exist (invariant 6). Everything outside consumes { passed, detail }.

const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

export const sleepConfigSchema = z
  .object({
    night_open: HHMM,
    night_close: HHMM,
    wake_open: HHMM,
    wake_close: HHMM,
    confirm_open: HHMM,
    confirm_close: HHMM,
  })
  .strict();

export type SleepConfig = z.infer<typeof sleepConfigSchema>;

// The timestamp is the evidence for sleep, so the payload is empty.
export const sleepEvidenceSchema = z.object({}).strict();
export type SleepEvidence = z.infer<typeof sleepEvidenceSchema>;

const STEPS = [
  { key: "night", label: "Night", open: "night_open", close: "night_close" },
  { key: "wake", label: "Wake", open: "wake_open", close: "wake_close" },
  { key: "confirm", label: "Confirm", open: "confirm_open", close: "confirm_close" },
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
  const resolved = STEPS.map((step) => ({
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

  const [night, wake, confirm] = resolved;
  if (night.closesAt > wake.opensAt) {
    errors.push("Wake window overlaps the night window.");
  }
  if (wake.closesAt > confirm.opensAt) {
    errors.push("Confirm window overlaps the wake window.");
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
  const resolved = STEPS.map((step) => ({
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

  const [night, wake, confirm] = resolved;
  if (night.closesAt > wake.opensAt) {
    issues.push({
      path: "wake_open",
      message: "Wake overlaps the night window. They cannot share a minute.",
    });
  }
  if (wake.closesAt > confirm.opensAt) {
    issues.push({
      path: "confirm_open",
      message: "Confirm overlaps the wake window. They cannot share a minute.",
    });
  }
  return issues;
}

export const sleepActivity: ActivityType<SleepConfig, SleepEvidence> = {
  key: "sleep",
  name: "Sleep",
  description: "Three timed check-ins a night",
  icon: "sleep",

  // Sleep is the reason dayBoundary exists: a 00:30 press belongs to the night
  // that just ended, so its day runs noon to noon.
  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "noon",
    grace: 2,
    config: {
      night_open: "22:00",
      night_close: "00:30",
      wake_open: "06:30",
      wake_close: "07:45",
      confirm_open: "07:45",
      confirm_close: "11:00",
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
  chart: "windowed",

  facts: [
    {
      title: "Judged noon to noon",
      sub: "A late night belongs to the night before.",
    },
  ],

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
        kind: "timeRange",
        label: "Confirm window",
        openKey: "confirm_open",
        closeKey: "confirm_close",
      },
    ];
  },

  // Three pairs of times that may not cross each other. No object schema can
  // say that, so the module says it, against the paths that are wrong.
  validate(config) {
    return sleepIssues(config);
  },

  steps(config: SleepConfig): CheckinStep[] {
    return STEPS.map((s) => ({
      key: s.key,
      label: s.label,
      open: config[s.open],
      close: config[s.close],
    }));
  },

  windows(config, periodStart, timezone): CheckinWindow[] {
    return STEPS.map((s) => ({
      step: s.key,
      label: s.label,
      opensAt: instantWithin(periodStart, timezone, config[s.open]).toJSDate(),
      closesAt: instantWithin(periodStart, timezone, config[s.close]).toJSDate(),
    }));
  },

  evaluate(input) {
    const wins = this.windows(input.config, input.periodStart, input.timezone);
    const ok = (step: string) => {
      const w = wins.find((x) => x.step === step)!;
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
