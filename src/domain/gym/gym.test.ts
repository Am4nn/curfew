import { describe, it, expect } from "vitest";
import { gymActivity, gymConfigSchema, GYM_STEP } from "./index";
import { periodUnit } from "../schedule";

const IST = "Asia/Kolkata";
const WEEK = "2026-09-07"; // a Monday

function session(iso: string) {
  return { step: GYM_STEP, at: new Date(iso), evidence: {} };
}

function evaluate(checkins: ReturnType<typeof session>[], sessionsPerWeek = 3) {
  return gymActivity.evaluate({
    periodStart: WEEK,
    timezone: IST,
    config: { sessionsPerWeek },
    checkins,
  });
}

describe("gym declaration", () => {
  it("is judged by the week, derived from its schedule", () => {
    expect(periodUnit(gymActivity.defaults.schedule)).toBe("week");
  });

  it("requires live evidence with no per-step narrowing", () => {
    expect(gymActivity.evidence).toEqual({
      level: "required",
      source: "live",
      detail: "Live camera, on every session.",
    });
  });

  it("has one step spanning the day, since it has no windows", () => {
    const steps = gymActivity.steps(gymActivity.defaults.config, WEEK);
    expect(steps).toHaveLength(1);
    expect(steps[0].key).toBe(GYM_STEP);
  });

  // The engine refuses a second check-in against a step that does not repeat,
  // once per PERIOD, and gym's period is the week. Without this the type could
  // never reach its own minimum through the UI: one session would be recorded
  // and every later press refused as a duplicate, while the config asked for
  // three. Found by pressing Save twice on two different days.
  it("repeats, because its period is a week and it needs several", () => {
    const [step] = gymActivity.steps(gymActivity.defaults.config, WEEK);
    expect(step.repeats).toBe(true);
    expect(gymActivity.defaults.config.sessionsPerWeek).toBeGreaterThan(1);
  });

  // The one-a-day limit is countsNow's job, not the step's. Both have to be
  // true at once or the type is wrong in one direction or the other.
  it("still counts at most one session a day", () => {
    const config = gymActivity.defaults.config;
    const today = new Date();
    const input = {
      periodStart: WEEK,
      timezone: IST,
      config,
      step: GYM_STEP,
      checkins: [{ step: GYM_STEP, at: today, evidence: {} }],
    };
    expect(gymActivity.countsNow?.(input)).toBe(false);
    expect(gymActivity.countsNow?.({ ...input, checkins: [] })).toBe(true);
  });

  it("its window covers the whole week", () => {
    const [w] = gymActivity.windows(gymActivity.defaults.config, WEEK, IST);
    const spanDays = (w.closesAt.getTime() - w.opensAt.getTime()) / 86_400_000;
    expect(spanDays).toBe(7);
  });

  it("rejects a config with an unknown field", () => {
    expect(() => gymConfigSchema.parse({ sessionsPerWeek: 3, extra: 1 })).toThrow();
  });

  it("rejects a minimum outside one to seven", () => {
    expect(() => gymConfigSchema.parse({ sessionsPerWeek: 0 })).toThrow();
    expect(() => gymConfigSchema.parse({ sessionsPerWeek: 8 })).toThrow();
  });
});

describe("gym evaluate", () => {
  it("passes on the minimum", () => {
    const r = evaluate([
      session("2026-09-07T18:00+05:30"),
      session("2026-09-09T18:00+05:30"),
      session("2026-09-11T18:00+05:30"),
    ]);
    expect(r.passed).toBe(true);
    expect(r.detail.sessions).toBe(3);
  });

  it("fails below it", () => {
    const r = evaluate([
      session("2026-09-07T18:00+05:30"),
      session("2026-09-09T18:00+05:30"),
    ]);
    expect(r.passed).toBe(false);
    expect(r.detail.sessions).toBe(2);
  });

  it("counts a day once however many times you press", () => {
    // The case that would otherwise let one enthusiastic Tuesday pass a week.
    const r = evaluate([
      session("2026-09-08T07:00+05:30"),
      session("2026-09-08T13:00+05:30"),
      session("2026-09-08T19:00+05:30"),
    ]);
    expect(r.passed).toBe(false);
    expect(r.detail.sessions).toBe(1);
  });

  it("counts days in the user's timezone, not UTC", () => {
    // 2026-09-08T20:00Z is 01:30 on the 9th in IST. Two distinct days there,
    // one day in UTC.
    const r = evaluate(
      [session("2026-09-08T14:00Z"), session("2026-09-08T20:00Z")],
      2,
    );
    expect(r.detail.sessions).toBe(2);
    expect(r.passed).toBe(true);
  });

  it("ignores check-ins for another step", () => {
    const r = evaluate([
      session("2026-09-07T18:00+05:30"),
      { step: "not-a-session", at: new Date("2026-09-08T18:00+05:30"), evidence: {} },
    ], 2);
    expect(r.detail.sessions).toBe(1);
    expect(r.passed).toBe(false);
  });

  it("an empty week fails without throwing", () => {
    expect(evaluate([]).passed).toBe(false);
  });

  it("reports the days it counted, for the module's own detail", () => {
    const r = evaluate([
      session("2026-09-07T18:00+05:30"),
      session("2026-09-09T18:00+05:30"),
    ]);
    expect(r.detail.days).toEqual(["2026-09-07", "2026-09-09"]);
    expect(r.detail.required).toBe(3);
  });
});
