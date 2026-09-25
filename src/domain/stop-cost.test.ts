import { describe, it, expect } from "vitest";
import "./index"; // registers the types consequencesOf names
import { consequencesOf, listNames, type StopCost } from "./stop-cost";

// The counting needs a database and CI does that through the browser suite.
// These are the sentences, which are the part that can be wrong while every
// number is right: a confirmation that overstates what a press costs is the
// same defect as one that understates it.

const cost = (over: Partial<StopCost> = {}): StopCost => ({
  streak: 24,
  groups: ["Morning Crew", "Founders"],
  photoGroups: ["Morning Crew", "Founders"],
  photos: 18,
  ceilingDrops: ["Morning Crew", "Founders"],
  ...over,
});

// 1.49 split this in two, and the split is the point of the test now. Gym
// carries a consistency percentage and has no streak to lose; No alcohol
// carries a streak and does. The same helper against both is what catches a
// sentence that is true of one and false of the other, which is exactly what
// was shipped before this round found it.
const text = (c: StopCost) => consequencesOf("gym", c).map((x) => x.what);
const streakText = (c: StopCost) =>
  consequencesOf("alcoholfree", c).map((x) => x.what);

const KEEPS_COUNTING = "Gym stops counting toward how established it is.";

describe("what stopping costs, in words", () => {
  it("names all four when all four apply", () => {
    expect(text(cost())).toEqual([
      KEEPS_COUNTING,
      "Gym stops being shared with Morning Crew and Founders.",
      "The 18 photographs both groups have seen go for good.",
      "Your ceiling in both groups drops.",
    ]);
  });

  // THE BUG THIS ROUND FOUND, 1.57. The line was "Your 24 day streak goes to
  // 0" for every type, and after 1.49 that is false for the twelve carrying a
  // percentage: they have no streak, and no screen shows them one. It was
  // written before the phase that would have shipped it.
  it("never claims a streak from a type that carries a percentage", () => {
    const lines = text(cost({ streak: 24 }));
    expect(lines.some((l) => l.includes("streak"))).toBe(false);
    expect(lines[0]).toBe(KEEPS_COUNTING);
  });

  it("says what a percentage type actually loses, which is the counting", () => {
    expect(text(cost({ groups: [], photoGroups: [], photos: 0, ceilingDrops: [] }))).toEqual([
      KEEPS_COUNTING,
    ]);
  });

  it("still names the streak for a type that carries one", () => {
    expect(
      streakText(cost({ groups: [], photoGroups: [], photos: 0, ceilingDrops: [] })),
    ).toEqual(["Your 24 day streak goes to 0."]);
  });

  it("does not claim a streak that is not there", () => {
    expect(streakText(cost({ streak: 0 }))[0]).toBe(
      "No alcohol stops being shared with Morning Crew and Founders.",
    );
  });

  it("names the groups again when the photographs went to fewer of them", () => {
    // Sharing and sharing evidence are two toggles. "both groups" here would
    // tell somebody they are about to lose photographs from a group that was
    // never shown one.
    expect(text(cost({ photoGroups: ["Founders"] }))[2]).toBe(
      "The 18 photographs Founders has seen go for good.",
    );
  });

  it("does not claim a ceiling drops where the type is not accepted", () => {
    const lines = text(cost({ ceilingDrops: ["Morning Crew"] }));
    expect(lines.at(-1)).toBe("Your ceiling in Morning Crew drops.");
  });

  it("counts one photograph in the singular", () => {
    expect(text(cost({ photos: 1 }))[2]).toBe(
      "The 1 photograph both groups have seen goes for good.",
    );
  });

  it("does not say both of three", () => {
    const three = ["A", "B", "C"];
    expect(text(cost({ groups: three, photoGroups: three, ceilingDrops: three }))[3]).toBe(
      "Your ceiling in all 3 groups drops.",
    );
  });
});

describe("listNames", () => {
  it("joins the way a person would read it aloud", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });
});
