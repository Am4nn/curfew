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

const text = (c: StopCost) => consequencesOf("gym", c).map((x) => x.what);

describe("what stopping costs, in words", () => {
  it("names all four when all four apply", () => {
    expect(text(cost())).toEqual([
      "Your 24 day streak goes to 0.",
      "Gym stops being shared with Morning Crew and Founders.",
      "The 18 photographs both groups have seen go for good.",
      "Your ceiling in both groups drops.",
    ]);
  });

  it("says nothing about groups to somebody in none", () => {
    expect(
      text(cost({ groups: [], photoGroups: [], photos: 0, ceilingDrops: [] })),
    ).toEqual(["Your 24 day streak goes to 0."]);
  });

  it("does not claim a streak that is not there", () => {
    expect(text(cost({ streak: 0 }))[0]).toBe(
      "Gym stops being shared with Morning Crew and Founders.",
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
