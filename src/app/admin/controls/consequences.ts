// What each change actually does, spelled out on the confirm sheet.
//
// The sheet is generic: it is built from whatever is pending, one block a
// change (decision 56). This is the only place the words live, so a new switch
// adds an entry here and nothing else.
//
// Every line describes a system being hidden, never data being deleted. That is
// true of every switch in Controls, and the sheet says so at the bottom.

export interface Consequence {
  name: string;
  state: "on" | "off";
  lines: string[];
}

const SETTING_COPY: Record<string, { name: string; on: string[]; off: string[] }> = {
  money: {
    name: "Money",
    off: [
      "No group can charge a fine from this moment. Existing balances stay and reappear if you switch it back on.",
      "Every mention of money disappears from the app: no balances on Home, no ledger, no fines in group settings.",
      "Groups you switched on by hand under Groups keep their money.",
    ],
    on: [
      "Groups whose owner has fines turned on start charging again from this moment.",
      "Balances that were hidden come back exactly as they were.",
    ],
  },
  photo_evidence: {
    name: "Photo evidence",
    off: [
      "No type can ask for a photo. A check-in that was blocked waiting for one goes through.",
      "Photos already taken are untouched and still visible until their retention runs out.",
      "This never blocks a check-in. It only removes a requirement.",
    ],
    on: ["Types that require a photo start requiring one again from this moment."],
  },
  new_groups: {
    name: "New groups",
    off: ["Nobody can create a group. Every existing group carries on untouched."],
    on: ["Anyone approved can create a group again."],
  },
  invites: {
    name: "Invites",
    off: [
      "No invite can be sent or accepted. Nobody new joins any group.",
      "Invites already sent stay pending rather than being cancelled.",
    ],
    on: ["Invites can be sent and accepted again, including the ones left pending."],
  },
  signups: {
    name: "Sign-ups",
    off: ["An approved invite becomes the only way in. Existing accounts are unaffected."],
    on: [
      "Anyone can create an account. They still need an admin to approve them before they can do anything.",
    ],
  },
};

/**
 * The notice a user sees, built from the same blocks the admin was shown.
 *
 * Nobody types this. An admin who has just read what a change does should not
 * then have to write it out again in their own words, and a hand-written notice
 * can say something the change did not do.
 */
export function noticeFrom(changes: Consequence[]): string {
  return changes
    .map((c) => {
      const head = `${c.name} is now ${c.state}.`;
      return [head, ...c.lines].join(" ");
    })
    .join("\n\n");
}

export function settingConsequence(key: string, value: unknown): Consequence {
  const copy = SETTING_COPY[key];
  if (!copy) {
    return { name: key, state: value ? "on" : "off", lines: [] };
  }
  const state = value ? "on" : "off";
  return { name: copy.name, state, lines: state === "on" ? copy.on : copy.off };
}

export function retentionConsequence(days: number, previous: number): Consequence {
  return {
    name: `Retention, ${days} days`,
    state: days < previous ? "off" : "on",
    lines:
      days < previous
        ? [
            `Photos older than ${days} days are deleted on the next sweep. That is not reversible.`,
            "Check-ins, streaks and reputation are unaffected. Only the photos go.",
          ]
        : [`Photos are kept for ${days} days instead of ${previous}. Nothing already deleted comes back.`],
  };
}

export function typeConsequence(name: string, enabled: boolean, tracking: number): Consequence {
  return {
    name,
    state: enabled ? "on" : "off",
    lines: enabled
      ? [`${name} appears in the catalog and anyone can start tracking it.`]
      : [
          `${name} disappears from the catalog, so nobody new can add it.`,
          tracking === 1
            ? "The 1 person already tracking it keeps it and keeps being scored."
            : `The ${tracking} people already tracking it keep it and keep being scored.`,
        ],
  };
}
