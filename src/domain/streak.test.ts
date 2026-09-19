import { describe, it, expect } from "vitest";
import { streakOver, restoreOffer, EMPTY, type StreakDay } from "./streak";
import { EVERY_DAY, WEEKDAYS, type Schedule } from "./schedule";

// Build a run of days from a compact string: "." missed, "x" done, "g" a
// missed day somebody spent grace on afterwards.
function days(startDate: string, pattern: string): StreakDay[] {
  const [y, m, d] = startDate.split("-").map(Number);
  return [...pattern].map((c, i) => ({
    date: new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
    done: c === "x",
    graced: c === "g" ? true : undefined,
  }));
}

const ANY3: Schedule = { kind: "minimum", perWeek: 3 };

describe("every-day activities", () => {
  it("each passed day adds one", () => {
    const r = streakOver(days("2026-09-07", "xxxxx"), EVERY_DAY);
    expect(r.current).toBe(5);
    expect(r.best).toBe(5);
  });

  it("a missed day resets to zero", () => {
    const r = streakOver(days("2026-09-07", "xxx.xx"), EVERY_DAY);
    expect(r.current).toBe(2);
    expect(r.best).toBe(3);
  });

  it("best survives a reset", () => {
    const r = streakOver(days("2026-09-07", "xxxxx.x"), EVERY_DAY);
    expect(r.current).toBe(1);
    expect(r.best).toBe(5);
  });

  it("an empty run is zero, not an error", () => {
    expect(streakOver([], EVERY_DAY).current).toBe(0);
  });

  it("continues from an earlier state instead of recomputing", () => {
    const first = streakOver(days("2026-09-07", "xxx"), EVERY_DAY);
    const second = streakOver(days("2026-09-10", "xx"), EVERY_DAY, first);
    expect(second.current).toBe(5);
    expect(second.best).toBe(5);
  });
});

describe("grace", () => {
  // Nothing in this walk decides grace any more (item 19). A day arrives marked
  // or unmarked, because somebody pressed Restore or did not, and the walk's
  // only job is to hold the run where a marked day sits.

  it("holds the run where it is rather than adding to it", () => {
    // A missed day is not a completed day, so 3 stays 3, it does not become 4.
    const r = streakOver(days("2026-09-07", "xxxgx"), EVERY_DAY);
    expect(r.current).toBe(4);
    expect(r.steps.map((s) => s.current)).toEqual([1, 2, 3, 3, 4]);
    expect(r.steps[3].graceUsed).toBe(true);
  });

  it("does nothing at all for a missed day nobody forgave", () => {
    const r = streakOver(days("2026-09-07", "xxx.x"), EVERY_DAY);
    expect(r.current).toBe(1);
    expect(r.steps[3].graceUsed).toBe(false);
  });

  it("holds across as many days as were forgiven", () => {
    const r = streakOver(days("2026-09-07", "xxxggx"), EVERY_DAY);
    expect(r.current).toBe(4);
  });

  it("prices a missed day at one", () => {
    const r = streakOver(days("2026-09-07", "xxx."), EVERY_DAY);
    expect(r.steps.at(-1)?.short).toBe(1);
  });
});

describe("what it would take to restore a run", () => {
  it("is nothing while the run is alive", () => {
    expect(restoreOffer(days("2026-09-07", "xxxxx"), EVERY_DAY)).toBeNull();
  });

  it("is one day and the run it comes back to", () => {
    const offer = restoreOffer(days("2026-09-07", "xxx."), EVERY_DAY);
    expect(offer).toMatchObject({ cost: 1, restoresTo: 3, brokeOn: "2026-09-10" });
  });

  it("counts every missed day since the break", () => {
    const offer = restoreOffer(days("2026-09-07", "xxx..."), EVERY_DAY);
    expect(offer).toMatchObject({ cost: 3, restoresTo: 3 });
    expect(offer?.covering).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("closes the moment the activity is checked in again", () => {
    // The real rule: the run either came back or it did not, and a day done
    // after the break starts a new one. There is nothing left to forgive.
    expect(restoreOffer(days("2026-09-07", "xxx..x"), EVERY_DAY)).toBeNull();
  });

  it("is nothing when there was never a run to lose", () => {
    expect(restoreOffer(days("2026-09-07", "....."), EVERY_DAY)).toBeNull();
  });

  it("does not offer to forgive a day already forgiven", () => {
    // The grace is spent and the run is alive again, so there is no offer.
    expect(restoreOffer(days("2026-09-07", "xxxg"), EVERY_DAY)).toBeNull();
  });

  it("prices a short gym week at the days it came short", () => {
    // Three a week, one session managed: two days short, so two grace.
    const offer = restoreOffer(days("2026-09-07", "x......"), ANY3, "2026-09-13");
    expect(offer?.cost).toBe(2);
  });

  it("brings a short gym week back to the days it did earn", () => {
    const start = { current: 21, best: 21 };
    const week = streakOver(days("2026-09-21", "xx....."), ANY3, start, "2026-09-27");
    expect(week.current).toBe(0);
    const offer = restoreOffer(days("2026-09-21", "xx....."), ANY3, "2026-09-27");
    // From EMPTY rather than 21, because `restoreOffer` walks the same days the
    // rebuild walks and the rebuild starts from the join date. Two sessions.
    expect(offer).toMatchObject({ cost: 1, restoresTo: 2 });
  });

  it("will not forgive a pause, because a pause is not a miss", () => {
    const paused: StreakDay[] = [
      { date: "2026-09-07", done: true },
      { date: "2026-09-08", done: true },
      { date: "2026-09-09", done: false, paused: true },
    ];
    expect(restoreOffer(paused, EVERY_DAY)).toBeNull();
  });
});

describe("chosen-weekday activities", () => {
  // 2026-09-07 is a Monday.
  it("skips the weekend rather than breaking on it", () => {
    // Mon to Fri done, Sat and Sun missed, then Mon again.
    const r = streakOver(days("2026-09-07", "xxxxx..x"), WEEKDAYS);
    expect(r.current).toBe(6);
  });

  it("a missed weekday still breaks it", () => {
    const r = streakOver(days("2026-09-07", "xx.xx"), WEEKDAYS);
    expect(r.current).toBe(2);
    expect(r.best).toBe(2);
  });

  it("a check-in on an unscheduled day adds nothing", () => {
    // Only the weekend was done. Nothing scheduled happened at all.
    const r = streakOver(days("2026-09-12", "xx"), WEEKDAYS);
    expect(r.current).toBe(0);
    expect(r.steps).toHaveLength(0);
  });
});

describe("frequency activities", () => {
  it("adds a day per session, above the minimum too", () => {
    // Six sessions in a week of any-3 adds six.
    const r = streakOver(days("2026-09-07", "xxx.xxx"), ANY3);
    expect(r.current).toBe(6);
  });

  it("does not judge a week that has not closed, even on its Sunday", () => {
    // One session, on the Sunday of the week it belongs to. An empty asOf is
    // how a caller says nothing has closed yet, and it has to beat the default,
    // which is the last day supplied and would be this very Sunday.
    const r = streakOver(days("2026-09-13", "x"), ANY3, EMPTY, "");
    expect(r.current).toBe(1);
    expect(r.steps.map((s) => s.current)).toEqual([1]);
  });

  it("counts up live during the week", () => {
    const r = streakOver(days("2026-09-07", "xx"), ANY3);
    // Two sessions so far. The week has not closed, so nothing is taken back.
    expect(r.steps.map((s) => s.current)).toEqual([1, 2]);
    expect(r.current).toBe(2);
  });

  it("the worked example from ACTIVITIES.md", () => {
    // Starting streak 12. Week 1 six sessions, week 2 three, week 3 two.
    const start = { current: 12, best: 12 };
    const week1 = streakOver(days("2026-09-07", "xxx.xxx"), ANY3, start);
    expect(week1.current).toBe(18);

    const week2 = streakOver(days("2026-09-14", "xxx...."), ANY3, week1);
    expect(week2.current).toBe(21);

    const week3 = streakOver(days("2026-09-21", "xx....."), ANY3, week2);
    expect(week3.current).toBe(0);
  });

  it("grace holds the run where it is, keeping the days the week did add", () => {
    const start = { current: 21, best: 21 };
    // The two sessions happened; the week is the thing that was forgiven, so
    // the mark sits on a day of it.
    const week = days("2026-09-21", "xx.....");
    week[2].graced = true;
    const r = streakOver(week, ANY3, start);
    // 23, not 21. The week missed its minimum and grace absorbed that, so the
    // run does not end. It does not rewind either: those two days happened, the
    // user watched the number climb to 23, and grace protecting a streak cannot
    // mean the streak falls. A streak adds one or goes to zero, and grace is
    // what makes it do neither.
    expect(r.current).toBe(23);
    expect(r.steps.at(-1)?.graceUsed).toBe(true);
  });

  it("only ever adds one or drops to zero", () => {
    // Six weeks of every shape: full, short and forgiven, short and not, empty.
    const weeks = "xxx....xx.g...xxxx.......xxxxx..x......";
    const r = streakOver(days("2026-09-07", weeks), ANY3);
    let previous = 0;
    for (const step of r.steps) {
      const moved = step.current - previous;
      const legal = moved === 1 || step.current === 0 || moved === 0;
      expect({ at: step.at, from: previous, to: step.current, legal }).toEqual({
        at: step.at,
        from: previous,
        to: step.current,
        legal: true,
      });
      previous = step.current;
    }
  });

  it("best keeps the high water mark even when days are taken back", () => {
    const start = { current: 21, best: 21 };
    const r = streakOver(days("2026-09-21", "xx....."), ANY3, start);
    expect(r.current).toBe(0);
    expect(r.best).toBe(23);
  });

  it("judges each week on its own", () => {
    // Week 1 meets 3, week 2 does not.
    const r = streakOver(days("2026-09-07", "xxx....xx....."), ANY3);
    expect(r.current).toBe(0);
    expect(r.best).toBe(5);
  });
});

describe("EMPTY", () => {
  it("is a run that has not started", () => {
    expect(EMPTY).toEqual({ current: 0, best: 0 });
  });
});
