import { describe, it, expect } from "vitest";
import {
  sleepActivity,
  sleepConfigSchema,
  type SleepConfig,
  validateSleepWindows,
} from "./index";
import type { Schedule } from "../schedule";
import type { Checkin } from "../types";

const EVERY_DAY: Schedule = { kind: "days", days: [1, 2, 3, 4, 5, 6, 7] };
const IST = "Asia/Kolkata";
const PERIOD = "2026-08-31";

const config: SleepConfig = {
  night_open: "22:00",
  night_close: "22:45",
  wake_open: "06:00",
  wake_close: "07:00",
};

/**
 * A config as it was written before v3.2, with the confirm window as two clock
 * times. Rows like this still exist and are still the truth about how those
 * nights were judged (invariant 5), so the module still reads them.
 */
const retired = {
  ...config,
  confirm_open: "07:30",
  confirm_close: "07:45",
} as unknown as SleepConfig;

// Windows in IST for sleep_date 2026-08-31: night on the 31st, wake and confirm
// on the morning of Sep 1 (the noon-to-noon period spans both calendar days).
function checkin(step: string, iso: string): Checkin<Record<string, never>> {
  return { step, at: new Date(iso) };
}

const night = checkin("night", "2026-08-31T22:30:00+05:30");
const wake = checkin("wake", "2026-09-01T06:30:00+05:30");
// 30 minutes after the wake press, which is the first minute the confirm opens.
const confirm = checkin("confirm", "2026-09-01T07:00:00+05:30");

describe("sleep.evaluate", () => {
  it("passes when all three land in-window", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, wake, confirm],
    });
    expect(r.passed).toBe(true);
    expect(r.detail).toEqual({
      night_ok: true,
      wake_ok: true,
      confirm_ok: true,
      wake_at_minutes: 390,
      wake_window_open_minutes: 360,
      wake_window_close_minutes: 420,
    });
  });

  it("fails the day when one check-in is missing", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, wake],
    });
    expect(r.passed).toBe(false);
    expect(r.detail).toMatchObject({ night_ok: true, wake_ok: true, confirm_ok: false });
  });

  it("does not count a check-in outside its window", () => {
    const lateNight = checkin("night", "2026-08-31T22:50:00+05:30");
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
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
      schedule: EVERY_DAY,
      checkins: [
        checkin("night", "2026-08-31T22:00:00+05:30"),
        // The last minute of the wake window, so the confirm runs 7:30 to 8:00.
        checkin("wake", "2026-09-01T07:00:00+05:30"),
        checkin("confirm", "2026-09-01T08:00:00+05:30"),
      ],
    });
    expect(r.passed).toBe(true);
  });

  it("ignores a check-in whose step does not match", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, wake, checkin("wake", "2026-09-01T07:00:00+05:30")],
    });
    // A second wake press cannot satisfy confirm.
    expect(r.detail).toMatchObject({ confirm_ok: false });
  });

  it("reports the earliest wake press, in minutes since midnight", () => {
    const laterWake = checkin("wake", "2026-09-01T06:45:00+05:30");
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, laterWake, wake, confirm],
    });
    expect(r.detail).toMatchObject({ wake_at_minutes: 390 });
  });

  it("reports no wake time when there was no wake check-in", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, confirm],
    });
    expect(r.detail).toMatchObject({ wake_at_minutes: null });
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

// The redesign. Every window in the app until v3.2 was a clock time in config;
// this one hangs off another press.
describe("the confirm window is anchored to the wake press", () => {
  const confirmIn = (checkins: Checkin<Record<string, never>>[]) =>
    sleepActivity.windows(config, PERIOD, IST, checkins).find((w) => w.step === "confirm")!;

  it("opens half an hour after the press and stays open half an hour", () => {
    const w = confirmIn([wake]);
    expect(w.waitingOn).toBeUndefined();
    expect(w.opensAt.toISOString()).toBe(new Date("2026-09-01T07:00:00+05:30").toISOString());
    expect(w.closesAt.toISOString()).toBe(new Date("2026-09-01T07:30:00+05:30").toISOString());
  });

  it("moves with the press rather than sitting at a fixed hour", () => {
    const early = confirmIn([checkin("wake", "2026-09-01T06:00:00+05:30")]);
    const late = confirmIn([checkin("wake", "2026-09-01T07:00:00+05:30")]);
    expect(early.opensAt.toISOString()).toBe(new Date("2026-09-01T06:30:00+05:30").toISOString());
    expect(late.opensAt.toISOString()).toBe(new Date("2026-09-01T07:30:00+05:30").toISOString());
  });

  it("is not anchored by a wake press outside the wake window", () => {
    // A press at 08:00 is not a wake check-in; it counts for nothing, so it
    // cannot open a confirm window either.
    const w = confirmIn([checkin("wake", "2026-09-01T08:00:00+05:30")]);
    expect(w.waitingOn?.step).toBe("wake");
  });

  it("waits when nothing has been pressed, at the widest it could be", () => {
    const w = confirmIn([]);
    expect(w.waitingOn?.step).toBe("wake");
    // The earliest it could open is 30 minutes after the wake window opens,
    // and the latest it could close is an hour after the wake window shuts.
    // Anything asking whether the night is over has to wait for the latter.
    expect(w.opensAt.toISOString()).toBe(new Date("2026-09-01T06:30:00+05:30").toISOString());
    expect(w.closesAt.toISOString()).toBe(new Date("2026-09-01T08:00:00+05:30").toISOString());
  });

  it("refuses a confirm half an hour too early", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      // Wake at 6:30, confirm at 6:45. Fifteen minutes is not thirty.
      checkins: [night, wake, checkin("confirm", "2026-09-01T06:45:00+05:30")],
    });
    expect(r.detail).toMatchObject({ confirm_ok: false });
  });

  it("refuses a confirm after the half hour has run out", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, wake, checkin("confirm", "2026-09-01T07:31:00+05:30")],
    });
    expect(r.detail).toMatchObject({ confirm_ok: false });
  });

  it("cannot be satisfied at all without a wake press", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config,
      schedule: EVERY_DAY,
      checkins: [night, checkin("confirm", "2026-09-01T07:00:00+05:30")],
    });
    expect(r.detail).toMatchObject({ wake_ok: false, confirm_ok: false });
  });
});

// Invariant 5: a period is judged against the config as it stood. A night
// scored under the old clock-time confirm keeps that verdict forever.
describe("a config written before v3.2", () => {
  it("keeps its own confirm window, at the clock times it was judged against", () => {
    const w = sleepActivity
      .windows(retired, PERIOD, IST, [wake])
      .find((x) => x.step === "confirm")!;
    expect(w.waitingOn).toBeUndefined();
    expect(w.opensAt.toISOString()).toBe(new Date("2026-09-01T07:30:00+05:30").toISOString());
    expect(w.closesAt.toISOString()).toBe(new Date("2026-09-01T07:45:00+05:30").toISOString());
  });

  it("still passes the night it passed", () => {
    const r = sleepActivity.evaluate({
      periodStart: PERIOD,
      timezone: IST,
      config: retired,
      schedule: EVERY_DAY,
      checkins: [night, wake, checkin("confirm", "2026-09-01T07:40:00+05:30")],
    });
    expect(r.passed).toBe(true);
  });
});

describe("sleepConfigSchema", () => {
  it("accepts valid HH:mm windows", () => {
    expect(sleepConfigSchema.safeParse(config).success).toBe(true);
  });
  it("rejects a malformed time", () => {
    expect(sleepConfigSchema.safeParse({ ...config, night_open: "25:00" }).success).toBe(false);
  });
  it("takes a pre-v3.2 row and drops the retired pair", () => {
    // Not `.strict()`, on purpose: an old row has to parse, or the configure
    // screen will not open for anybody who has not saved since v3.2. Dropping
    // the keys is what makes the next save write the current shape.
    const parsed = sleepConfigSchema.safeParse(retired);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual(config);
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

  it("rejects a wake window with no room for the confirm before noon", () => {
    // Up by 11:30, confirm at noon, and noon is where the night ends.
    expect(
      validateSleepWindows({ ...config, wake_open: "11:00", wake_close: "11:30" }, IST, PERIOD),
    ).toContain("Wake window must close an hour before noon, so the confirm fits.");
  });

  it("accepts a wake window that closes exactly an hour and a minute before noon", () => {
    expect(
      validateSleepWindows({ ...config, wake_open: "10:00", wake_close: "10:59" }, IST, PERIOD),
    ).toEqual([]);
  });
});

describe("the defaults", () => {
  it("are the windows v3.2 ships", () => {
    expect(sleepActivity.defaults.config).toEqual({
      night_open: "21:30",
      night_close: "23:00",
      wake_open: "05:30",
      wake_close: "07:00",
    });
  });

  it("leave room for the confirm inside the noon-to-noon day", () => {
    expect(validateSleepWindows(sleepActivity.defaults.config, IST, PERIOD)).toEqual([]);
  });
});
