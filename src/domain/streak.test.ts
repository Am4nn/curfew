import { describe, it, expect } from "vitest";
import { streakOver, graceLeft, EMPTY, type StreakDay } from "./streak";
import { EVERY_DAY, WEEKDAYS, type Schedule } from "./schedule";

// Build a run of days from a compact string: "." missed, "x" done.
function days(startDate: string, pattern: string): StreakDay[] {
  const [y, m, d] = startDate.split("-").map(Number);
  return [...pattern].map((c, i) => ({
    date: new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
    done: c === "x",
  }));
}

const ANY3: Schedule = { kind: "minimum", perWeek: 3 };

describe("every-day activities", () => {
  it("each passed day adds one", () => {
    const r = streakOver(days("2026-09-07", "xxxxx"), EVERY_DAY, 0);
    expect(r.current).toBe(5);
    expect(r.best).toBe(5);
  });

  it("a missed day resets to zero", () => {
    const r = streakOver(days("2026-09-07", "xxx.xx"), EVERY_DAY, 0);
    expect(r.current).toBe(2);
    expect(r.best).toBe(3);
  });

  it("best survives a reset", () => {
    const r = streakOver(days("2026-09-07", "xxxxx.x"), EVERY_DAY, 0);
    expect(r.current).toBe(1);
    expect(r.best).toBe(5);
  });

  it("an empty run is zero, not an error", () => {
    expect(streakOver([], EVERY_DAY, 0).current).toBe(0);
  });

  it("continues from an earlier state instead of recomputing", () => {
    const first = streakOver(days("2026-09-07", "xxx"), EVERY_DAY, 0);
    const second = streakOver(days("2026-09-10", "xx"), EVERY_DAY, 0, first);
    expect(second.current).toBe(5);
    expect(second.best).toBe(5);
  });
});

describe("grace", () => {
  it("holds the run where it is rather than adding to it", () => {
    // A missed day is not a completed day, so 3 stays 3, it does not become 4.
    const r = streakOver(days("2026-09-07", "xxx.x"), EVERY_DAY, 1);
    expect(r.current).toBe(4);
    expect(r.steps.map((s) => s.current)).toEqual([1, 2, 3, 3, 4]);
    expect(r.steps[3].graceUsed).toBe(true);
  });

  it("runs out within a month and then the run breaks", () => {
    const r = streakOver(days("2026-09-07", "x.x.x.x"), EVERY_DAY, 2);
    // Two misses absorbed, the third breaks it.
    expect(r.steps.filter((s) => s.graceUsed)).toHaveLength(2);
    expect(r.current).toBe(1);
  });

  it("is per calendar month and does not carry over", () => {
    // Misses on 30 Sep and 4 Oct, one allowance in each month.
    const r = streakOver(days("2026-09-28", "xx.xxx.xx"), EVERY_DAY, 1);
    expect(r.graceSpent).toEqual({ "2026-09": 1, "2026-10": 1 });
    expect(r.current).toBeGreaterThan(0);
  });

  it("reports what is left this month", () => {
    const r = streakOver(days("2026-09-07", "x.x"), EVERY_DAY, 2);
    expect(graceLeft(r, "2026-09", 2)).toBe(1);
    expect(graceLeft(r, "2026-10", 2)).toBe(2);
    expect(graceLeft(EMPTY, "2026-09", 2)).toBe(2);
  });
});

describe("chosen-weekday activities", () => {
  // 2026-09-07 is a Monday.
  it("skips the weekend rather than breaking on it", () => {
    // Mon to Fri done, Sat and Sun missed, then Mon again.
    const r = streakOver(days("2026-09-07", "xxxxx..x"), WEEKDAYS, 0);
    expect(r.current).toBe(6);
  });

  it("a missed weekday still breaks it", () => {
    const r = streakOver(days("2026-09-07", "xx.xx"), WEEKDAYS, 0);
    expect(r.current).toBe(2);
    expect(r.best).toBe(2);
  });

  it("a check-in on an unscheduled day adds nothing", () => {
    // Only the weekend was done. Nothing scheduled happened at all.
    const r = streakOver(days("2026-09-12", "xx"), WEEKDAYS, 0);
    expect(r.current).toBe(0);
    expect(r.steps).toHaveLength(0);
  });
});

describe("frequency activities", () => {
  it("adds a day per session, above the minimum too", () => {
    // Six sessions in a week of any-3 adds six.
    const r = streakOver(days("2026-09-07", "xxx.xxx"), ANY3, 0);
    expect(r.current).toBe(6);
  });

  it("counts up live during the week", () => {
    const r = streakOver(days("2026-09-07", "xx"), ANY3, 0);
    // Two sessions so far. The week has not closed, so nothing is taken back.
    expect(r.steps.map((s) => s.current)).toEqual([1, 2]);
    expect(r.current).toBe(2);
  });

  it("the worked example from ACTIVITIES.md", () => {
    // Starting streak 12. Week 1 six sessions, week 2 three, week 3 two.
    const start = { current: 12, best: 12, graceSpent: {} };
    const week1 = streakOver(days("2026-09-07", "xxx.xxx"), ANY3, 0, start);
    expect(week1.current).toBe(18);

    const week2 = streakOver(days("2026-09-14", "xxx...."), ANY3, 0, week1);
    expect(week2.current).toBe(21);

    const week3 = streakOver(days("2026-09-21", "xx....."), ANY3, 0, week2);
    expect(week3.current).toBe(0);
  });

  it("grace returns the run to the value the week opened on", () => {
    const start = { current: 21, best: 21, graceSpent: {} };
    const r = streakOver(days("2026-09-21", "xx....."), ANY3, 1, start);
    // Not 23: the week failed, so its two days do not count. Not 0: grace held.
    expect(r.current).toBe(21);
    expect(r.steps.at(-1)?.graceUsed).toBe(true);
  });

  it("best keeps the high water mark even when days are taken back", () => {
    const start = { current: 21, best: 21, graceSpent: {} };
    const r = streakOver(days("2026-09-21", "xx....."), ANY3, 0, start);
    expect(r.current).toBe(0);
    expect(r.best).toBe(23);
  });

  it("judges each week on its own", () => {
    // Week 1 meets 3, week 2 does not.
    const r = streakOver(days("2026-09-07", "xxx....xx....."), ANY3, 0);
    expect(r.current).toBe(0);
    expect(r.best).toBe(5);
  });

  it("a week straddling a month end spends the month of its Monday", () => {
    // Mon 28 Sep to Sun 4 Oct, one session against a minimum of three.
    const r = streakOver(days("2026-09-28", "x......"), ANY3, 1);
    expect(r.graceSpent).toEqual({ "2026-09": 1 });
  });
});
