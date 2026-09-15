// What each release changed, in the words the people using it will read.
//
// Written HERE, in the same commit as the change it describes, and reviewed
// with it. That is the whole point and it is the same rule `noticeFrom()`
// already follows for a controls change: nobody types a notice into a box at
// the moment of publishing, because a notice typed then can say something the
// release did not do, and nobody is reviewing it.
//
// A release note is not automatic. Most releases change nothing a person would
// notice, and announcing those is how an overlay that blocks the whole app
// becomes something people learn to dismiss without reading. Add an entry only
// when somebody opening Curfew tomorrow would otherwise be confused by what
// they find.
//
// Publishing is `bun run publish:notice -- --version <v> --as <email>`, run by
// hand after the tag. See `scripts/publish-notice.ts`.

export interface ReleaseNote {
  /**
   * One change. The first sentence is pulled out as the headline by the
   * overlay, which splits on ". ", so write it as a complete sentence and put
   * the detail after it.
   */
  headline: string;
  detail: string;
}

/**
 * Keyed by the version in `package.json`, without the "v".
 *
 * Published as one notice per version, whose body is the entries joined by a
 * blank line: the overlay already renders each paragraph as headline plus
 * detail, and merging per user means one press clears this and anything else
 * outstanding.
 */
export const RELEASE_NOTES: Record<string, ReleaseNote[]> = {
  "3.2.0": [
    {
      headline: "Your sleep confirm window moved.",
      detail:
        "It used to be a time you set. It now opens 30 minutes after you press Wake and stays open for 30 minutes. Your night and wake windows are untouched. A confirm you place yourself can be placed at an hour you are already up, which proves nothing, and the confirm is the only step sleep photographs.",
    },
    {
      headline: "Grace is now yours to spend.",
      detail:
        "Two a month for each activity you track, in one pool, used on whichever streak you choose after it breaks. It still only holds a streak: fines and standing are untouched, as they always were. Settings shows how many you have left.",
    },
    {
      headline: "A shared photograph belongs to the group it was sent to.",
      detail:
        "Sharing an activity with a new group from now on shares what you do from now on. Photographs taken before that stay where they were. Stopping sharing, or leaving, takes yours out of that group for good.",
    },
  ],
};

/** The body one notice carries, or null when this version announced nothing. */
export function bodyFor(version: string): string | null {
  const notes = RELEASE_NOTES[version];
  if (!notes || notes.length === 0) return null;
  return notes.map((n) => `${n.headline} ${n.detail}`).join("\n\n");
}

/** The identity that makes publishing twice do nothing. */
export const keyFor = (version: string) => `release:${version}`;
