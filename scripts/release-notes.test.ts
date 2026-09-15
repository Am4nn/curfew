import { describe, it, expect } from "vitest";
import { loadReleaseNotes, bodyFor, keyFor, NOTES_PATH } from "./release-notes";

// The real file, checked on every run.
//
// `release-notes.json` is read once, by a script, by hand, after a tag. Without
// this the first thing that ever validates it is the release itself, and the
// failure lands at the worst possible moment: the tag is cut, the deploy is
// out, and the announcement is the one step left. Worse, a file that parses but
// renders wrong publishes a blocking overlay to everybody with no way back,
// because there is no dismiss and an ack cannot be taken back.
describe("release-notes.json", () => {
  const notes = loadReleaseNotes(NOTES_PATH);

  it("parses, and every version has at least one note", () => {
    expect(Object.keys(notes).length).toBeGreaterThan(0);
    for (const entries of Object.values(notes)) {
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  // The overlay splits each paragraph on the FIRST ". " and bolds what comes
  // before it. A headline that does not end in a full stop, or a detail that
  // starts with one, puts the split in the wrong place and the bold line runs
  // into the body. The schema enforces the stop; this proves the rendering that
  // depends on it.
  it("splits into a headline and a detail the way the overlay does", () => {
    for (const [version, entries] of Object.entries(notes)) {
      const body = bodyFor(notes, version)!;
      const paragraphs = body.split("\n\n");
      expect(paragraphs).toHaveLength(entries.length);

      paragraphs.forEach((paragraph, i) => {
        const at = paragraph.indexOf(". ");
        expect(at, `${version} note ${i} has no headline break`).toBeGreaterThan(0);
        expect(paragraph.slice(0, at + 1)).toBe(entries[i].headline);
        expect(paragraph.slice(at + 2)).toBe(entries[i].detail);
      });
    }
  });

  it("says nothing for a version that announced nothing", () => {
    expect(bodyFor(notes, "0.0.0-never-released")).toBeNull();
  });

  it("keys a release so publishing twice is a no-op", () => {
    expect(keyFor("3.2.0")).toBe("release:3.2.0");
  });
});
