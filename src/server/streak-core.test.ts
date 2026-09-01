import { describe, it, expect } from "vitest";
import { runsFrom } from "./streak-core";

describe("runsFrom", () => {
  it("is zero for no scored nights", () => {
    expect(runsFrom([])).toEqual({ current: 0, best: 0 });
  });

  it("counts an unbroken run of passes", () => {
    expect(runsFrom([true, true, true])).toEqual({ current: 3, best: 3 });
  });

  it("resets current on the latest miss but keeps best", () => {
    // A long early run, then the most recent night was a miss.
    expect(runsFrom([true, true, true, true, false])).toEqual({ current: 0, best: 4 });
  });

  it("current is only the run ending at the latest night", () => {
    // best run is the early one (3); current is the trailing run (2).
    expect(runsFrom([true, true, true, false, true, true])).toEqual({ current: 2, best: 3 });
  });

  it("a single miss anywhere breaks the run", () => {
    expect(runsFrom([true, false, true])).toEqual({ current: 1, best: 1 });
  });
});
