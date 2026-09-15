// What each release changed, in the words the people using it will read.
//
// The CONTENT is `release-notes.json` at the repo root. This file is the reader:
// the shape, the validation, and the two things the publish script needs.
//
// Content rather than code, for two reasons. It is rewritten every release, so
// a `const` in a source file claimed to be constant while being the most-edited
// thing in the repo. And nothing in the app ever reads it: the app reads
// `notices.body` out of the database, and the only caller is
// `publish-notice.ts` beside this file. It sat in `src/server/` for exactly one
// commit, where it was dead weight in the app's own tree. A JSON file at the
// root is also where somebody writing release notes would look, which a path
// four directories deep is not.
//
// It is still in git and still goes through review, which is the part that
// matters. A notice typed at the moment of publishing can say something the
// release did not do, and nobody is reviewing it. Write the entry in the same
// commit as the change it describes.
//
// A release note is not automatic, and the bar is higher than "this changed".
// The overlay BLOCKS the whole app until it is acknowledged, so every entry
// spends something that only runs out once: an overlay carrying things people
// did not need is an overlay people learn to dismiss unread, and then the one
// that mattered goes unread too.
//
// The test is whether somebody has to DO something differently tomorrow. A
// window that moved, an allowance that is now theirs to spend: those change
// what a person does. A leak closed, a query corrected, a number that was being
// displayed wrong: those change what the code does, and the person carries on
// exactly as before. Fixes go in the commit message.
//
// 3.2.0 is the example. Photographs stopped being visible to groups joined
// after they were taken, which is a real change and a privacy improvement, and
// it was cut from the notes: nobody was relying on the old behaviour and nobody
// has to act on the new one. Two entries, not three.
//
// Keep the detail to what cannot be worked out from the headline. Three
// sentences is usually too many.
import { readFileSync } from "node:fs";
import { z } from "zod";

/**
 * One change.
 *
 * The overlay splits a paragraph on the first ". " and renders what comes
 * before it as the headline, so `headline` has to be one complete sentence,
 * ending in a full stop, and everything else belongs in `detail`. A headline
 * without the stop would swallow the first sentence of the detail into the bold
 * line, which is why the schema insists on it rather than trusting the writer.
 */
const noteSchema = z.object({
  headline: z.string().min(1).endsWith("."),
  detail: z.string().min(1),
});

const fileSchema = z.record(z.string(), z.array(noteSchema).min(1));

export type ReleaseNote = z.infer<typeof noteSchema>;

export const NOTES_PATH = "release-notes.json";

/**
 * Read and validate the file.
 *
 * Throws with the path and what is wrong, because the alternative is publishing
 * a blocking overlay built from a shape nobody checked, to everybody at once,
 * with no way to take it back.
 */
export function loadReleaseNotes(path = NOTES_PATH): Record<string, ReleaseNote[]> {
  const parsed = fileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    const where = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`${path} is not valid release notes:\n${where}`);
  }
  return parsed.data;
}

/** The body one notice carries, or null when this version announced nothing. */
export function bodyFor(
  notes: Record<string, ReleaseNote[]>,
  version: string,
): string | null {
  const entries = notes[version];
  if (!entries || entries.length === 0) return null;
  return entries.map((n) => `${n.headline} ${n.detail}`).join("\n\n");
}

/** The identity that makes publishing twice do nothing. */
export const keyFor = (version: string) => `release:${version}`;
