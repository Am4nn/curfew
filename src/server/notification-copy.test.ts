import { describe, expect, it } from "vitest";
import {
  allClear,
  lastCall,
  peerAhead,
  reminder,
  streakAtRisk,
  sweep,
  type Line,
  type Peers,
  type Subject,
} from "./notification-copy";

// The copy is picked by a hash, which is the only reason it can be tested at
// all: the same person, day, kind and activity always produce the same
// sentence, so an exact string is assertable and a regression is visible rather
// than probabilistic.
//
// What most of this file is actually defending is one rule. NOTHING HERE MAY
// DESCRIBE PROGRESS. The previous version chose a whole sentence from a bank
// and chose the bank by asking whether the module's `hint` was a non-empty
// string, so a member with nothing logged was told "Almost there" over eight
// untouched glasses of water, in production, twice. The structural fix is that
// a writer now receives `left` already written and may only place it. These
// tests are what stops somebody helpfully adding "One more and today counts!"
// back into a bank line, which is what the sentence would look like from
// inside the file that cannot see the numbers.

const SUBJECT: Subject = {
  name: "Water",
  left: "8 glasses to go.",
  minutesLeft: 240,
  closesLabel: "9:30 PM",
  streak: 0,
  streakUnit: "day",
};

const at = (over: Partial<Subject>): Subject => ({ ...SUBJECT, ...over });

/** Every writer, called with something reasonable, for the blanket rules. */
function everyLine(seed: string): Line[] {
  const peers: Peers = { groupName: "Morning Crew", names: ["Rahul"], logged: 1, of: 3 };
  return [
    lastCall(at({ minutesLeft: 25 }), seed),
    streakAtRisk(at({ streak: 24, minutesLeft: 90 }), seed),
    peerAhead(SUBJECT, peers, seed),
    sweep([at({ name: "Office", closesLabel: "2:00 PM" }), SUBJECT], seed),
    reminder(SUBJECT, seed),
    allClear(6, seed),
  ];
}

/** The seeds a real month would produce, for the rules that must hold always. */
const SEEDS = Array.from({ length: 40 }, (_, i) => `u1:2026-09-${i}:kind:water`);

describe("the rule this file exists for: no writer may claim progress", () => {
  // The exact words that shipped over a day with nothing logged, plus the rest
  // of the family they came from.
  const CLAIMS = [
    "almost",
    "nearly",
    "so close",
    "one more",
    "nearly done",
    "finish it",
    "keep it up",
    "of 8",
    "halfway",
  ];

  it("says none of them, whatever the seed", () => {
    for (const seed of SEEDS) {
      for (const line of everyLine(seed)) {
        const text = `${line.title} ${line.body}`.toLowerCase();
        for (const claim of CLAIMS) {
          expect(text, `"${claim}" in: ${line.title} / ${line.body}`).not.toContain(
            claim,
          );
        }
      }
    }
  });

  it("carries the module's own sentence verbatim, and does not paraphrase it", () => {
    // Everything that takes a Subject puts `left` in the body untouched. This
    // is the whole mechanism: the only progress claim in a notification is one
    // the module wrote, so no writer needs a count and none is given one.
    for (const seed of SEEDS.slice(0, 5)) {
      for (const line of [
        lastCall(at({ minutesLeft: 25 }), seed),
        streakAtRisk(at({ streak: 24, minutesLeft: 90 }), seed),
        peerAhead(SUBJECT, { groupName: "G", names: ["Rahul"], logged: 1, of: 3 }, seed),
        reminder(SUBJECT, seed),
      ]) {
        expect(line.body).toContain("8 glasses to go.");
      }
    }
  });

  it("stays quiet about progress even when the module does", () => {
    // A module with nothing to say still gets a usable notification, and the
    // writer still invents nothing.
    const bare = at({ left: "Not logged yet." });
    expect(reminder(bare, "seed").body).toContain("Not logged yet.");
  });
});

describe("the same seed is the same sentence", () => {
  it("every time, so a retried send is not a second notification", () => {
    const once = everyLine("u1:2026-09-17:reminder:water");
    const twice = everyLine("u1:2026-09-17:reminder:water");
    expect(once).toEqual(twice);
  });

  it("and a different day is sometimes a different sentence", () => {
    // The point of a bank. One template becomes wallpaper in a week.
    const titles = new Set(SEEDS.map((s) => reminder(SUBJECT, s).title));
    expect(titles.size).toBeGreaterThan(1);
  });
});

describe("house rules that apply to every string that ships", () => {
  it("no em-dashes", () => {
    for (const seed of SEEDS) {
      for (const line of everyLine(seed)) {
        expect(`${line.title}${line.body}`).not.toContain("—");
        expect(`${line.title}${line.body}`).not.toContain("–");
      }
    }
  });

  it("a body fits on a lock screen", () => {
    for (const seed of SEEDS) {
      for (const line of everyLine(seed)) {
        expect(line.body.length, line.body).toBeLessThanOrEqual(120);
        expect(line.title.length, line.title).toBeLessThanOrEqual(60);
      }
    }
  });

  it("every notification names what it is about", () => {
    // The digest this replaced did not, which is most of why it was unreadable.
    // `done` is the exception and names the day instead: there is no single
    // activity it could name.
    for (const seed of SEEDS.slice(0, 10)) {
      const peers: Peers = { groupName: "G", names: ["Rahul"], logged: 1, of: 3 };
      for (const line of [
        lastCall(at({ minutesLeft: 25 }), seed),
        streakAtRisk(at({ streak: 24, minutesLeft: 90 }), seed),
        peerAhead(SUBJECT, peers, seed),
        reminder(SUBJECT, seed),
      ]) {
        expect(`${line.title} ${line.body}`).toContain("Water");
      }
    }
  });
});

describe("lastcall", () => {
  it("counts a single minute as one", () => {
    const titles = new Set(
      SEEDS.map((s) => lastCall(at({ minutesLeft: 1 }), s).title),
    );
    for (const t of titles) expect(t).not.toContain("1 minutes");
  });

  it("puts the clock in the title and the ask in the body, never both", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const line = lastCall(at({ minutesLeft: 25 }), seed);
      // "closes" twice reads as two different deadlines.
      const both = line.title.includes("closes") && line.body.includes("closes");
      expect(both, `${line.title} / ${line.body}`).toBe(false);
    }
  });
});

describe("peers", () => {
  const peersOf = (names: string[], logged: number, of: number): Peers => ({
    groupName: "Morning Crew",
    names,
    logged,
    of,
  });

  it("names one person", () => {
    const line = peerAhead(SUBJECT, peersOf(["Rahul"], 1, 3), "s");
    expect(`${line.title} ${line.body}`).toContain("Rahul");
  });

  it("names two", () => {
    const line = peerAhead(SUBJECT, peersOf(["Rahul", "Priya"], 2, 4), "s");
    expect(line.title).toContain("Rahul and Priya");
  });

  it("counts rather than names past two", () => {
    // `peersOn` empties `names` past two, and a lock screen cannot hold four.
    const line = peerAhead(SUBJECT, peersOf([], 3, 5), "s");
    expect(line.title).toContain("3 of 5 in Morning Crew");
  });

  it("agrees with itself about number", () => {
    for (const seed of SEEDS) {
      const one = peerAhead(SUBJECT, peersOf(["Rahul"], 1, 3), seed);
      expect(`${one.title} ${one.body}`).not.toContain("have done");
      const two = peerAhead(SUBJECT, peersOf(["Rahul", "Priya"], 2, 3), seed);
      expect(`${two.title} ${two.body}`).not.toContain("has done");
    }
  });
});

describe("sweep", () => {
  const subj = (name: string, closesLabel: string): Subject =>
    at({ name, closesLabel });

  it("names one activity when that is all there is", () => {
    const line = sweep([subj("Gym", "8:00 PM")], "s");
    expect(line.body).toBe("Gym closes at 8:00 PM.");
  });

  it("names two with their times", () => {
    const line = sweep([subj("Office", "2:00 PM"), subj("Gym", "8:00 PM")], "s");
    expect(line.body).toBe("Office closes at 2:00 PM, Gym at 8:00 PM.");
  });

  it("counts the rest, and counts them correctly", () => {
    // The digest's tail said "Food, Supplements and Reading and 5 more", which
    // is both a double "and" and a sentence nobody can parse. Two names, a
    // count, a full stop.
    const line = sweep(
      [
        subj("Office", "2:00 PM"),
        subj("Gym", "8:00 PM"),
        subj("Water", "9:30 PM"),
        subj("Food", "9:30 PM"),
      ],
      "s",
    );
    expect(line.body).toBe("Office closes at 2:00 PM, Gym at 8:00 PM. 2 more open.");
    expect(line.body).not.toContain("and 2 more");
  });

  it("never lists a module's progress line", () => {
    // Nine of those in one body is what made the original unreadable: a hint
    // describes its own progress and has no reason to name its subject, so the
    // tail came out as numbers attached to nothing.
    const line = sweep([subj("Office", "2:00 PM"), subj("Gym", "8:00 PM")], "s");
    expect(line.body).not.toContain("8 glasses to go.");
  });
});

describe("done", () => {
  it("asks for nothing", () => {
    for (const seed of SEEDS) {
      const line = allClear(6, seed);
      expect(line.body).toContain("6");
      expect(`${line.title} ${line.body}`.toLowerCase()).not.toContain("closes");
    }
  });
});
