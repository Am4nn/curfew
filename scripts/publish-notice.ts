// Announce a release to the people who were already here.
//
//   bun run publish:notice -- --version 3.2.0 --as you@example.com
//   bun run publish:notice -- --version 3.2.0 --as you@example.com --dry
//
// Run by hand after the tag, against whichever database `.env.*` points at.
// Publishing inserts one notice whose body is the entries in
// `release-notes.json` at the repo root. Every account that existed before that
// moment gets the blocking overlay until they press Got it, and every account
// created afterwards never sees it (decision 80), because somebody who arrives
// next month never knew the old behaviour.
//
// ---------------------------------------------------------------------------
// WHAT `--as` IS, AND WHAT IT IS NOT
//
// It is not access control, and nothing here could be. Running this needs the
// connection string, and whoever holds that can already insert a notice with
// one line of SQL, drop the table, or rewrite the ledger. The database
// credential outranks every role in this app, which is exactly why
// `.env.production` is the one file pointing at the live database and is
// gitignored along with the rest. A check in this file would protect nothing
// and would suggest it protected something, which is worse than no check.
//
// What `--as` does is make the row TRUE. `notices.created_by` is not null and
// references a real person, so somebody is recorded as having announced this.
// The capability check makes that record honest rather than arbitrary: it
// refuses to attribute a notice to an account that could not have published one
// through the app. An admin who reads this later sees a name that means
// something.
//
// The real guard is `--dry`, and it is the one worth using. It prints exactly
// what would be published and to how many people, and publishing is final:
// there is no dismiss, only Got it, and an ack cannot be taken back. A notice
// that says the wrong thing has already been read by the time anybody notices.
// ---------------------------------------------------------------------------
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notices, users } from "@/db/schema";
import { publishNotice } from "@/server/notices";
import { bodyFor, keyFor, loadReleaseNotes, NOTES_PATH } from "./release-notes";
import { can } from "@/server/admin";

// Read and validate before anything else, so a malformed file fails here
// rather than three checks later with a confusing message.
const notes = loadReleaseNotes(NOTES_PATH);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const version = arg("version");
const asEmail = arg("as");
const dry = process.argv.includes("--dry");

if (!version || !asEmail) {
  console.error(
    "Usage: bun run publish:notice -- --version <x.y.z> --as <admin email> [--dry]\n" +
      `Versions with notes: ${Object.keys(notes).join(", ") || "none"}`,
  );
  process.exit(1);
}

const body = bodyFor(notes, version);
if (!body) {
  console.error(
    `No release notes for ${version}.\n` +
      "Most releases change nothing a person would notice, and announcing those is how\n" +
      "an overlay that blocks the whole app becomes something people dismiss unread.\n" +
      `If this one does need announcing, add it to ${NOTES_PATH} in the commit that\n` +
      "made the change, so it goes through review with the code.",
  );
  process.exit(1);
}

// Who is being recorded as announcing this.
const [admin] = await db
  .select({ id: users.id, name: users.name })
  .from(users)
  .where(eq(users.email, asEmail))
  .limit(1);

if (!admin) {
  console.error(`No account for ${asEmail} in this database.`);
  process.exit(1);
}

if (!(await can(admin.id, "settings.write"))) {
  console.error(
    `${asEmail} cannot write settings, so a notice attributed to them would be a\n` +
      "record of something they could not have done. Name somebody who can.",
  );
  process.exit(1);
}

const key = keyFor(version);

// Already announced. Said plainly rather than swallowed, because the difference
// between "already done" and "did nothing and will not tell you why" is the
// whole reason somebody runs a script twice.
const [existing] = await db
  .select({ createdAt: notices.createdAt })
  .from(notices)
  .where(eq(notices.key, key))
  .limit(1);

if (existing) {
  console.log(
    `${version} was already announced on ${existing.createdAt.toISOString().slice(0, 10)}. Nothing to do.`,
  );
  process.exit(0);
}

// Who this will reach: accounts that exist NOW. The overlay applies the same
// rule at read time against the notice's own timestamp, so this is the count as
// of a moment ago rather than a promise.
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(users)
  .where(lt(users.createdAt, new Date()));

console.log(`\n--- ${version} ---\n`);
for (const paragraph of body.split("\n\n")) console.log(`${paragraph}\n`);
console.log(`Attributed to ${admin.name} <${asEmail}>`);
console.log(`Reaches ${count} account(s) that already exist. Nobody who joins later.`);

if (dry) {
  console.log("\nDry run. Nothing was published.");
  process.exit(0);
}

const id = await publishNotice(body, admin.id, key);
if (id === null) {
  console.log("\nAlready published by something else a moment ago. Nothing to do.");
  process.exit(0);
}

console.log(`\nPublished ${id}. It cannot be unsent; retire it in the database if it is wrong.`);
