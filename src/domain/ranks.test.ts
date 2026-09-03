import { describe, it, expect } from "vitest";
import { rankFor, nextRank, isImmaculate, RANKS, MAX_SCORE } from "./index";

// The bands in RANKS.md, asserted at their edges.

describe("rank bands", () => {
  it("puts every score in exactly one band", () => {
    for (let score = 0; score <= MAX_SCORE; score += 1) {
      expect(rankFor(score)).toBeDefined();
    }
  });

  it("matches the table at every boundary", () => {
    expect(rankFor(0).name).toBe("DOUBT");
    expect(rankFor(99).name).toBe("DOUBT");
    expect(rankFor(100).name).toBe("INTENT");
    expect(rankFor(349).name).toBe("INTENT");
    expect(rankFor(350).name).toBe("PRACTICE");
    expect(rankFor(599).name).toBe("PRACTICE");
    expect(rankFor(600).name).toBe("DISCIPLINE");
    expect(rankFor(849).name).toBe("DISCIPLINE");
    expect(rankFor(850).name).toBe("UNBROKEN");
    expect(rankFor(1000).name).toBe("UNBROKEN");
  });

  it("starts everyone in INTENT", () => {
    // The starting score is 200, which REPUTATION.md puts in the second band.
    expect(rankFor(200).name).toBe("INTENT");
  });

  it("treats IMMACULATE as a title inside UNBROKEN, not a sixth band", () => {
    expect(RANKS).toHaveLength(5);
    expect(rankFor(960).name).toBe("UNBROKEN");
    expect(isImmaculate(949)).toBe(false);
    expect(isImmaculate(950)).toBe(true);
  });

  it("says how far the next rank is, and nothing at the top", () => {
    expect(nextRank(640)).toMatchObject({ away: 210 });
    expect(nextRank(640)?.rank.name).toBe("UNBROKEN");
    expect(nextRank(900)).toBeNull();
  });
});
