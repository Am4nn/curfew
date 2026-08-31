import { describe, it, expect } from "vitest";
import {
  sleepActivity,
  sleepConfigSchema,
  type SleepConfig,
  validateSleepWindows,
} from "./index";
import type { Checkin } from "../types";

const IST = "Asia/Kolkata";
const PERIOD = "2026-08-31";

const config: SleepConfig = {
  night_open: "22:00",
  night_close: "22:45",
  wake_open: "06:00",
  wake_close: "07:00",
  confirm_open: "07:30",
  confirm_close: "07:45",
};

// Windows in IST for sleep_date 2026-08-31: night on the 31st, wake and confirm
// on the morning of Sep 1 (the noon-to-noon period spans both calendar days).
function checkin(step: string, iso: string): Checkin<Record<string, never>> {
  return { step, at: new Date(iso) };
}

const night = checkin("night", "2026-08-31T22:30:00+05:30");
const wake = checkin("wake", "2026-09-01T06:30:00+05:30");
const confirm = checkin("confirm", "2026-09-01T07:40:00+05:30");

describe("sleep.evaluate", () => {
  it("passes when all three land in-window", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      checkins: [night, wake, confirm],
    });
    expect(r.passed).toBe(true);
    expect(r.detail).toEqual({ night_ok: true, wake_ok: true, confirm_ok: true });
  });

  it("fails the day when one check-in is missing", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      checkins: [night, wake],
    });
    expect(r.passed).toBe(false);
    expect(r.detail).toEqual({ night_ok: true, wake_ok: true, confirm_ok: false });
  });

  it("does not count a check-in outside its window", () => {
    const lateNight = checkin("night", "2026-08-31T22:50:00+05:30");
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      checkins: [lateNight, wake, confirm],
    });
    expect(r.detail).toMatchObject({ night_ok: false });
    expect(r.passed).toBe(false);
  });

  it("counts the window boundaries as in-window", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      checkins: [
        checkin("night", "2026-08-31T22:00:00+05:30"),
        checkin("wake", "2026-09-01T07:00:00+05:30"),
        checkin("confirm", "2026-09-01T07:45:00+05:30"),
      ],
    });
    expect(r.passed).toBe(true);
  });

  it("ignores a check-in whose step does not match", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      checkins: [night, wake, checkin("wake", "2026-09-01T07:40:00+05:30")],
    });
    // A second wake press cannot satisfy confirm.
    expect(r.detail).toMatchObject({ confirm_ok: false });
  });

  it("exposes three steps for the UI", () => {
    expect(sleepActivity.steps(config, PERIOD).map((s) => s.key)).toEqual([
      "night",
      "wake",
      "confirm",
    ]);
  });

  it("resolves windows to absolute instants, morning steps on the next day", () => {
    const wins = sleepActivity.windows(config, PERIOD, IST);
    const night = wins.find((w) => w.step === "night")!;
    const wake = wins.find((w) => w.step === "wake")!;
    // Night 22:00 IST on the sleep_date; wake 06:00 IST the next morning.
    expect(night.opensAt.toISOString()).toBe(new Date("2026-08-31T22:00:00+05:30").toISOString());
    expect(wake.opensAt.toISOString()).toBe(new Date("2026-09-01T06:00:00+05:30").toISOString());
  });
});

describe("sleepConfigSchema", () => {
  it("accepts valid HH:mm windows", () => {
    expect(sleepConfigSchema.safeParse(config).success).toBe(true);
  });
  it("rejects a malformed time", () => {
    expect(sleepConfigSchema.safeParse({ ...config, night_open: "25:00" }).success).toBe(false);
  });
  it("rejects unknown keys", () => {
    expect(sleepConfigSchema.safeParse({ ...config, extra: "1" }).success).toBe(false);
  });
});

describe("validateSleepWindows", () => {
  it("accepts an ordered set of non-overlapping windows", () => {
    expect(validateSleepWindows(config, IST, PERIOD)).toEqual([]);
  });

  it("rejects a window that closes before it opens", () => {
    expect(
      validateSleepWindows({ ...config, night_open: "22:45", night_close: "22:00" }, IST, PERIOD),
    ).toContain("Night window closes before it opens.");
  });

  it("rejects a wake window that overlaps the night window", () => {
    expect(
      validateSleepWindows({ ...config, wake_open: "22:30" }, IST, PERIOD),
    ).toContain("Wake window overlaps the night window.");
  });

  it("rejects a confirm window that overlaps the wake window", () => {
    expect(
      validateSleepWindows({ ...config, confirm_open: "06:30" }, IST, PERIOD),
    ).toContain("Confirm window overlaps the wake window.");
  });
});
