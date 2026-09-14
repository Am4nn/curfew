// Does deleting a photograph return before the file goes, and does the file go?
//
//   bun run check:purge
//
// Reported as "delete photo should be async, it takes a long time and the user
// waits". It did: both delete paths removed the object from the bucket and
// then marked the row, one photograph at a time, so forty photographs was
// forty round trips with somebody watching a spinner.
//
// The fix is only honest if BOTH halves hold, which is what this checks:
//
//   the press returns with the file still in the bucket   (it is fast)
//   and the photograph is unreachable from that instant   (it is gone to you)
//   and the sweep removes the file                        (it is really gone)
//
// The third is the one that was missing from the obvious version of this fix.
// Both existing sweep cases select `deleted_at IS NULL`, so a row marked
// deleted whose object survived was picked up by nothing at all and the file
// would have sat in the bucket for good. Migration 0022 splits the press from
// the purge and adds the case that closes it.
//
// Local only: LOCAL_MODE keeps objects in .r2-local, so the file this watches
// is a real file and no R2 credentials are needed.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import {
  users,
  userApprovals,
  consentRecords,
  userSettings,
  evidence,
} from "@/db/schema";
import { listOwnPhotos, deleteOnePhoto, sweepEvidence } from "@/server/evidence";
import { localPathFor } from "@/server/r2";
import { CONSENT_VERSION } from "@/server/consent";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:purge is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed += 1;
}

const id = `purge-${randomUUID().slice(0, 6)}`;
const objectKey = `check-purge/${randomUUID()}.jpg`;

async function cleanup() {
  await db.delete(evidence).where(inArray(evidence.userId, [id]));
  await db.delete(userSettings).where(inArray(userSettings.userId, [id]));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [id]));
  await db.delete(userApprovals).where(inArray(userApprovals.userId, [id]));
  await db.delete(users).where(inArray(users.id, [id]));
}

/** The row as the database has it, which is where the two facts live. */
async function row() {
  const [r] = await db
    .select({
      id: evidence.id,
      deletedAt: evidence.deletedAt,
      purgedAt: evidence.purgedAt,
    })
    .from(evidence)
    .where(eq(evidence.userId, id))
    .limit(1);
  return r;
}

try {
  await db.insert(users).values({
    id,
    name: "Purge check",
    email: `${id}@example.invalid`,
    emailVerified: true,
  });
  await db.insert(userApprovals).values({ userId: id, status: "approved", decidedAt: new Date() });
  await db.insert(consentRecords).values({ userId: id, version: CONSENT_VERSION });
  await db.insert(userSettings).values({
    userId: id,
    timezone: "Asia/Kolkata",
    effectiveFrom: "2026-01-01",
  });

  // A real file in the local store, so "is it still in the bucket" is a
  // question about something that exists rather than about a name.
  const file = localPathFor(objectKey);
  if (!file) throw new Error("the test key is not a local key");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "not really a photograph");

  const at = DateTime.now();
  await db.insert(evidence).values({
    userId: id,
    typeKey: "gym",
    step: "session",
    periodStart: at.toFormat("yyyy-MM-dd"),
    idem: `${id}-${randomUUID().slice(0, 8)}`,
    objectKey,
    contentType: "image/jpeg",
    bytes: 1000,
    requestedAt: at.toJSDate(),
    confirmedAt: at.toJSDate(),
    // Far in the future, so retention is not what removes it. The press is.
    deleteAfter: at.plus({ days: 60 }).toFormat("yyyy-MM-dd"),
  });

  check("the photograph is there to begin with", (await listOwnPhotos(id)).length === 1);

  // The press.
  const pressed = await deleteOnePhoto(id, (await row()).id);
  const afterPress = await row();

  check("the press is taken", pressed);
  check(
    "it returns without waiting for the bucket",
    existsSync(file) && afterPress.purgedAt === null,
    existsSync(file) ? "file still there, not marked purged" : "the file went first",
  );
  check(
    "and the photograph is already unreachable",
    afterPress.deletedAt !== null && (await listOwnPhotos(id)).length === 0,
    `${(await listOwnPhotos(id)).length} still listed`,
  );

  // Tonight.
  const swept = await sweepEvidence();
  const afterSweep = await row();

  check("the sweep removes the file", !existsSync(file), `purged ${swept.purged}`);
  check("and writes down that it did", afterSweep.purgedAt !== null);

  // A row it already purged must not come back round, or every night the job
  // walks the whole history of deletions asking R2 to remove what is long gone.
  const again = await sweepEvidence();
  check(
    "and does not do it twice",
    again.purged === 0 && again.failed === 0,
    `purged ${again.purged}, failed ${again.failed}`,
  );
} finally {
  await cleanup();
}

console.log(
  failed === 0
    ? "\nThe press is instant and the file still goes."
    : `\n${failed} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
