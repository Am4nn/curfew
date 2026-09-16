import { describe, it, expect } from "vitest";
import { compose, type Situation } from "./notification-copy";

// Copy chosen by a hash is copy that can be asserted, which is the whole reason
// the pick is a hash rather than a random number. These tests exist because a
// notification cannot be taken back: what goes wrong here goes wrong on
// somebody's lock screen, and there is no second render to fix it.

const base: Situation = {
  name: "Gym",
  hint: null,
  minutesLeft: 40,
  closesLabel: "8:00 PM",
  streak: 0,
  peers: null,
};

const args = { userId: "u1", day: "2026-09-17", slot: "19:15" };

describe("compose", () => {
  it("says nothing when nothing is outstanding", () => {
    expect(compose({ ...args, situations: [] })).toBeNull();
  });

  it("is stable for the same person, day and slot", () => {
    const a = compose({ ...args, situations: [base] });
    const b = compose({ ...args, situations: [base] });
    expect(a).toEqual(b);
    // A retried send picks the same sentence, so a QStash retry is not a
    // second, differently worded notification about the same thing.
    expect(a).not.toBeNull();
  });

  it("varies across days", () => {
    const seen = new Set<string>();
    for (const day of ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]) {
      const line = compose({ ...args, day, situations: [base] });
      seen.add(line!.title);
    }
    // Not a guarantee of four distinct lines from a hash, but four identical
    // ones would mean the seed is not reaching the pick at all.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("names one peer, and two, and counts beyond that", () => {
    const one = compose({
      ...args,
      situations: [
        { ...base, peers: { groupName: "Morning Crew", names: ["Rahul"], logged: 1, of: 4 } },
      ],
    });
    expect(`${one!.title} ${one!.body}`).toContain("Rahul");

    const two = compose({
      ...args,
      situations: [
        {
          ...base,
          peers: { groupName: "Morning Crew", names: ["Rahul", "Priya"], logged: 2, of: 4 },
        },
      ],
    });
    expect(`${two!.title} ${two!.body}`).toContain("Rahul and Priya");

    const many = compose({
      ...args,
      situations: [
        { ...base, peers: { groupName: "Morning Crew", names: [], logged: 3, of: 4 } },
      ],
    });
    expect(`${many!.title} ${many!.body}`).toContain("3 of 4 in Morning Crew");
  });

  it("leads with peers over a streak", () => {
    const line = compose({
      ...args,
      situations: [
        { ...base, name: "Food", streak: 30 },
        {
          ...base,
          name: "Gym",
          peers: { groupName: "Crew", names: ["Rahul"], logged: 1, of: 3 },
        },
      ],
    });
    expect(`${line!.title} ${line!.body}`).toContain("Rahul");
  });

  it("never writes an activity's progress itself", () => {
    // "2 of 3 meals" is the food module's sentence (invariant 6). This file may
    // only carry it through, so the exact string has to survive verbatim.
    const line = compose({
      ...args,
      situations: [{ ...base, name: "Food", hint: "2 of 3 meals today." }],
    });
    expect(line!.body).toContain("2 of 3 meals today.");
  });

  it("names what else is outstanding without quoting its numbers", () => {
    const line = compose({
      ...args,
      situations: [
        { ...base, name: "Gym" },
        { ...base, name: "Food", hint: "2 of 3 meals today." },
        { ...base, name: "Water", hint: "5 of 8 today." },
        { ...base, name: "Reading", hint: "0 of 20 pages." },
      ],
    });
    // The lead keeps its full sentence.
    expect(line!.body).toContain("2 of 3 meals today.");
    // The others are named, because "5 of 8 today." on a lock screen does not
    // say what it is 5 of 8 of.
    expect(line!.body).toContain("Water");
    expect(line!.body).not.toContain("5 of 8 today.");
    expect(line!.body).not.toContain("0 of 20 pages.");
  });

  it("counts the overflow rather than listing everything", () => {
    const line = compose({
      ...args,
      situations: ["Gym", "Food", "Water", "Reading", "Study", "Steps"].map((name) => ({
        ...base,
        name,
      })),
    });
    expect(line!.body).toContain("2 more");
  });

  it("gets more urgent as the window closes", () => {
    const far = compose({ ...args, situations: [{ ...base, minutesLeft: 200 }] });
    const near = compose({ ...args, situations: [{ ...base, minutesLeft: 40 }] });
    const last = compose({ ...args, situations: [{ ...base, minutesLeft: 8 }] });
    expect(far!.body).toContain("8:00 PM");
    expect(near!.body).toContain("40 minutes left");
    expect(last!.body).toContain("Minutes left");
  });

  it("says something when a window has no real close", () => {
    const line = compose({
      ...args,
      situations: [{ ...base, minutesLeft: null, closesLabel: null }],
    });
    // An all-day window's close is midnight, which is not a deadline anybody
    // acts on, so the copy must not try to make one out of it.
    expect(line!.body).not.toContain("null");
    expect(line!.body.length).toBeGreaterThan(0);
  });

  it("uses no em-dashes anywhere", () => {
    // House rule, and it survives the voice exception: the exception is
    // exclamation marks, not punctuation nobody can type.
    const everything = [
      base,
      { ...base, streak: 30 },
      { ...base, hint: "2 of 3." },
      { ...base, peers: { groupName: "Crew", names: ["A", "B"], logged: 2, of: 5 } },
    ].flatMap((s) =>
      ["19:15", "09:00", "13:30"].map((slot) => compose({ ...args, slot, situations: [s] })),
    );
    for (const line of everything) {
      expect(`${line!.title} ${line!.body}`).not.toContain("—");
    }
  });
});
