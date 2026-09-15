import { getActivityType } from "./registry";

// What stopping an activity costs, as sentences. The counting is in
// server/stop-cost.ts, which is where the database is; this is the half that
// can be wrong while every number is right.
//
// The configure screen offered Stop tracking as a bare <form action> with no
// confirmation at all, on a press with four separate consequences, one of them
// permanent: the photographs a group has seen go when sharing stops, and
// sharing the type again later does not bring them back. Item 22.

/** Everything a stop press is about to do, counted. */
export interface StopCost {
  /** The streak that goes to zero. 0 when there is nothing to lose. */
  streak: number;
  /** Groups being shown this type right now. */
  groups: string[];
  /**
   * The subset of those groups that see the photographs too.
   *
   * Sharing and sharing EVIDENCE are two toggles, so a group can be told
   * whether you went to the gym without ever being shown a photograph of it. A
   * sentence about photographs leaving a group that never saw one is wrong on
   * the one screen that cannot afford to be.
   */
  photoGroups: string[];
  /** Photographs those groups have seen of this activity. */
  photos: number;
  /**
   * Groups whose ceiling falls, which is not the same list as `groups`.
   *
   * Breadth counts what you share OF WHAT THE GROUP ACCEPTS, so un-sharing a
   * type a group does not accept costs nothing there.
   */
  ceilingDrops: string[];
}

export interface Consequence {
  what: string;
  detail: string;
}

/** "Morning Crew", "Morning Crew and Founders", "A, B and C". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * How to refer to a set of groups the line ABOVE has already named.
 *
 * "both groups" reads better than repeating two names, and it is only true
 * while this set is that set. When they differ, which is what the two sharing
 * toggles and a group that does not accept the type both produce, the names go
 * back in.
 */
function sameAgain(names: string[], named: string[]): string {
  const identical =
    names.length === named.length && names.every((n) => named.includes(n));
  if (!identical) return listNames(names);
  if (names.length === 1) return names[0];
  if (names.length === 2) return "both groups";
  return `all ${names.length} groups`;
}

/**
 * The sheet's lines.
 *
 * A consequence that does not apply is not listed. Four greyed-out lines about
 * groups, to somebody in none, is four lines of noise on the one screen that
 * has to be read.
 */
export function consequencesOf(typeKey: string, cost: StopCost): Consequence[] {
  const name = getActivityType(typeKey).name;
  const out: Consequence[] = [];

  if (cost.streak > 0) {
    out.push({
      what: `Your ${cost.streak} day streak goes to 0.`,
      detail:
        "Starting again starts at 1. Grace cannot restore a streak you ended yourself.",
    });
  }

  if (cost.groups.length > 0) {
    out.push({
      what: `${name} stops being shared with ${listNames(cost.groups)}.`,
      detail: "They stop seeing whether you did it.",
    });
  }

  if (cost.photos > 0) {
    const one = cost.photos === 1;
    // Which photographs, said in the sentence: the ones those groups were
    // shown, not every photograph of this activity you have. The rest stay in
    // Your Photos, which the footnote says.
    const who = sameAgain(cost.photoGroups, cost.groups);
    const seen = cost.photoGroups.length === 1 ? "has seen" : "have seen";
    out.push({
      what: `The ${cost.photos} ${one ? "photograph" : "photographs"} ${who} ${seen} ${one ? "goes" : "go"} for good.`,
      detail: `Permanent. Tracking ${name} again, or sharing it again, does not bring ${one ? "it" : "them"} back.`,
    });
  }

  if (cost.ceilingDrops.length > 0) {
    out.push({
      what: `Your ceiling in ${sameAgain(cost.ceilingDrops, cost.groups)} drops.`,
      detail: "You share one fewer of what they accept.",
    });
  }

  return out;
}

/** Under the list, and true whatever the four lines above say. */
export const STOP_FOOTNOTE =
  "Nothing is deleted. Your history stays, your photographs stay in Your Photos, and what you already owe stays owed.";
