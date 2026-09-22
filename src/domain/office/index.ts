import { z } from "zod";
import type { ActivityType } from "../types";
import { WEEKDAYS } from "../schedule";
import { windowSchema, oneWindow, windowInstants, within, clockLabel } from "../windows";
import { countPass } from "../pass";

// Office. Weekdays, inside a window (decision 46). The weekend is skipped by
// the engine's schedule, not by anything here: this module only knows that a
// check-in has to land between two times.

export const OFFICE_STEP = "arrive";

const officeConfigSchema = z.object({ window: windowSchema }).strict();
export type OfficeConfig = z.infer<typeof officeConfigSchema>;

const officeEvidenceSchema = z.object({}).strict();
export type OfficeEvidence = z.infer<typeof officeEvidenceSchema>;

export const officeActivity: ActivityType<OfficeConfig, OfficeEvidence> = {
  key: "office",
  name: "Office",
  description: "In by the time you said",
  icon: "office",
  category: "mind",

  defaults: {
    schedule: WEEKDAYS,
    dayBoundary: "midnight",
    config: { window: { open: "10:00", close: "14:00" } },
  },

  configSchema: officeConfigSchema,
  evidenceSchema: officeEvidenceSchema,

  evidence: { level: "optional", source: "live", detail: "Live camera." },
  checkin: { kind: "tap" },
  chart: { kind: "binary", heading: "IN OR NOT" },

  summary(config) {
    return `in the office between ${clockLabel(config.window.open)} and ${clockLabel(config.window.close)}`;
  },

  fields() {
    return [
      {
        kind: "timeRange",
        label: "Hours in the office",
        openKey: "window.open",
        closeKey: "window.close",
      },
    ];
  },

  steps(config) {
    return [
      {
        key: OFFICE_STEP,
        label: "Arrive",
        open: config.window.open,
        close: config.window.close,
      },
    ];
  },

  windows(config, periodStart, timezone) {
    return oneWindow(OFFICE_STEP, "Arrive", periodStart, timezone, config.window);
  },

  evaluate(input) {
    const window = windowInstants(input.periodStart, input.timezone, input.config.window);
    // A press outside the window does not count. Arriving at 6pm is not
    // arriving by 2pm.
    const inWindow = input.checkins.filter(
      (c) => c.step === OFFICE_STEP && within(c.at, window),
    );
    const result = countPass(inWindow, { min: 1 });
    return {
      passed: result.passed,
      detail: { arrived: result.passed, presses: input.checkins.length },
    };
  },
};
