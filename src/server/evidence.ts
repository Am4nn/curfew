import { z } from "zod";
import { DateTime } from "luxon";
import { and, eq, inArray, isNull, isNotNull, lte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { evidence, events } from "@/db/schema";
import { getActivityType } from "@/domain";
import { presign, deleteObject } from "./r2";
import { rateLimit } from "./ratelimit";
import { resolveCheckinTarget } from "./checkin";
import { now } from "@/lib/clock";

// Evidence photos. No image passes through a serverless function (decision 71):
// the browser compresses, asks for a presigned PUT, uploads straight to R2, and
// only then sends the check-in. A file with no confirmed row is an orphan and
// is swept; a check-in that needs a photo is refused without one.

/** How long a photograph is kept. The check-in outlives it (decision 101). */
export const RETENTION_DAYS = 60;

/** Two formats, because those are the two a canvas can encode to. */
const CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;

/**
 * After compression. The default is 1920px at quality 0.85, which lands around
 * 400 KB for a photograph and well over the old 2 MB ceiling for a busy frame.
 * Raise this and `compressionFor` together, or the browser produces a file the
 * server refuses to sign for.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;

/** Presigned URLs a user may ask for in an hour. */
const UPLOADS_PER_HOUR = 60;

export const uploadRequestSchema = z
  .object({
    typeKey: z.string().min(1).max(40),
    step: z.string().min(1).max(40),
    idem: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    contentType: z.enum(CONTENT_TYPES),
    bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  })
  .strict();

export type UploadTicket =
  | { ok: true; url: string; objectKey: string; expiresIn: number }
  | { ok: false; reason: string; message: string };

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

/**
 * The object key. No email, no name, nothing readable: a key leaking tells you
 * only that some user checked something in on some date.
 */
function objectKeyFor(input: {
  userId: string;
  typeKey: string;
  period: string;
  idem: string;
  contentType: string;
}): string {
  return `ev/${input.userId}/${input.typeKey}/${input.period}/${input.idem}.${EXTENSION[input.contentType]}`;
}

/** A presigned PUT, and the pending row the check-in will confirm. */
export async function requestUpload(
  userId: string,
  raw: unknown,
): Promise<UploadTicket> {
  const parsed = uploadRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "That upload was malformed." };
  }
  const input = parsed.data;

  const target = await resolveCheckinTarget(userId, input.typeKey, input.step);
  if (!target.ok) return { ok: false, reason: target.reason, message: target.message };

  if (target.type.evidence.level === "none") {
    return {
      ok: false,
      reason: "no_evidence",
      message: "This activity takes no photo.",
    };
  }

  const limit = await rateLimit({
    key: `upload:${userId}`,
    limit: UPLOADS_PER_HOUR,
    windowSeconds: 3600,
  });
  if (!limit.ok) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "Too many uploads in an hour. Wait a while.",
    };
  }

  const objectKey = objectKeyFor({
    userId,
    typeKey: input.typeKey,
    period: target.period,
    idem: input.idem,
    contentType: input.contentType,
  });

  const deleteAfter = DateTime.fromJSDate(target.instant, { zone: target.timezone })
    .plus({ days: RETENTION_DAYS })
    .toFormat("yyyy-MM-dd");

  // One photo per press. A retry with the same key reuses the object rather
  // than making a second row, so a stuck browser cannot fill the bucket.
  const [row] = await db
    .insert(evidence)
    .values({
      userId,
      typeKey: input.typeKey,
      step: input.step,
      periodStart: target.period,
      idem: input.idem,
      objectKey,
      contentType: input.contentType,
      bytes: input.bytes,
      deleteAfter,
    })
    .onConflictDoUpdate({
      target: [evidence.userId, evidence.idem],
      set: { bytes: input.bytes, contentType: input.contentType, objectKey },
    })
    .returning({ objectKey: evidence.objectKey, confirmedAt: evidence.confirmedAt });

  if (row.confirmedAt) {
    return {
      ok: false,
      reason: "duplicate",
      message: "That check-in is already recorded.",
    };
  }

  return {
    ok: true,
    objectKey: row.objectKey,
    // A bearer token for one object: long enough for mobile data, short
    // enough that a leaked one is worth little.
    url: presign({ key: row.objectKey, method: "PUT", expiresIn: 300 }),
    expiresIn: 300,
  };
}

/** The pending row for one press, if it belongs to this user and is unconfirmed. */
export async function pendingFor(userId: string, idem: string) {
  const [row] = await db
    .select({
      id: evidence.id,
      objectKey: evidence.objectKey,
      confirmedAt: evidence.confirmedAt,
      typeKey: evidence.typeKey,
      step: evidence.step,
    })
    .from(evidence)
    .where(and(eq(evidence.userId, userId), eq(evidence.idem, idem)))
    .limit(1);
  return row ?? null;
}

/**
 * Mark a photo confirmed. There is no transaction and none is needed: the event
 * carries the object key, so when this disagrees with `events` the sweep
 * believes the event.
 */
export async function confirmEvidence(id: number, eventAt: Date): Promise<void> {
  await db
    .update(evidence)
    .set({ confirmedAt: eventAt })
    .where(and(eq(evidence.id, id), isNull(evidence.confirmedAt)));
}

/** A short-lived presigned GET. Callers decide who is entitled to one. */
export function readUrl(objectKey: string): string {
  return presign({ key: objectKey, method: "GET", expiresIn: 300 });
}

export interface OwnPhoto {
  id: number;
  objectKey: string;
  typeKey: string;
  periodStart: string;
}

/**
 * Every photo a user has actually taken: confirmed, not deleted. Newest
 * first. Small personal library, so no pagination.
 */
export async function listOwnPhotos(userId: string): Promise<OwnPhoto[]> {
  const rows = await db
    .select({
      id: evidence.id,
      objectKey: evidence.objectKey,
      typeKey: evidence.typeKey,
      periodStart: evidence.periodStart,
    })
    .from(evidence)
    .where(
      and(
        eq(evidence.userId, userId),
        isNull(evidence.deletedAt),
        sql`${evidence.confirmedAt} is not null`,
      ),
    )
    .orderBy(sql`${evidence.periodStart} desc, ${evidence.id} desc`);
  return rows;
}

/**
 * Delete one photograph, verified to belong to this user first.
 *
 * Same shape as `deletePhotos`: the row is marked and that is the answer. The
 * ownership check is the `where`, so a row belonging to somebody else matches
 * nothing and nothing is written. The object goes in tonight's sweep.
 */
export async function deleteOnePhoto(userId: string, evidenceId: number): Promise<boolean> {
  const gone = await db
    .update(evidence)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(evidence.id, evidenceId),
        eq(evidence.userId, userId),
        isNull(evidence.deletedAt),
      ),
    )
    .returning({ id: evidence.id });

  return gone.length > 0;
}

// ---------------------------------------------------------------------------
// The nightly sweeps
// ---------------------------------------------------------------------------

export interface SweepResult {
  expired: number;
  orphans: number;
  repaired: number;
  /** Objects actually removed from the bucket, whatever marked them. */
  purged: number;
  failed: number;
}

/**
 * How many objects are deleted from R2 at once.
 *
 * The number that was there before was one, in the sense that the loop awaited
 * each delete before starting the next, which is why a person deleting forty
 * photographs waited for forty round trips. Bounded rather than unbounded
 * because a retention sweep can have hundreds of objects due on one night and
 * firing them all at once is how a job gets rate limited by the thing it is
 * trying to be polite to.
 */
const PURGE_AT_ONCE = 16;

/**
 * Delete a batch of objects from the bucket and write down which ones went.
 *
 * The row is marked only if its object is gone, and a failure leaves the row
 * exactly as it was: `deleted_at` set, `purged_at` null, which is the state the
 * purge case selects, so tomorrow night tries again. Nothing is ever lost track
 * of, because the row that points at the file is never removed.
 */
async function purgeObjects(
  rows: { id: number; objectKey: string }[],
  instant: Date,
): Promise<{ purged: number; failed: number }> {
  let purged = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += PURGE_AT_ONCE) {
    const batch = rows.slice(i, i + PURGE_AT_ONCE);
    const settled = await Promise.all(
      batch.map(async (row) => {
        try {
          await deleteObject(row.objectKey);
          return row.id;
        } catch {
          return null;
        }
      }),
    );

    const done = settled.filter((id): id is number => id !== null);
    failed += batch.length - done.length;
    if (done.length === 0) continue;

    await db
      .update(evidence)
      .set({ purgedAt: instant })
      .where(inArray(evidence.id, done));
    purged += done.length;
  }

  return { purged, failed };
}

/**
 * The nightly sweep. Three cases now, and the third is the one that makes an
 * instant delete honest.
 *
 * Retention and abandoned uploads decide WHICH photographs should go, and both
 * do it by marking rows. The purge case is the only thing in the app that
 * removes an object from the bucket, and it takes everything marked and not yet
 * gone: what retention marked a moment ago, what a person deleted this
 * afternoon, and anything a previous night failed to remove.
 *
 * Marking before purging is the opposite of the order this used to run in, and
 * it is safe for the reason migration 0022 exists: `deleted_at` no longer
 * claims the file is gone. It claims the photograph is unreachable, which is
 * true the instant the row is written.
 */
export async function sweepEvidence(): Promise<SweepResult> {
  const instant = await now();
  const today = instant.toISOString().slice(0, 10);
  const result: SweepResult = {
    expired: 0,
    orphans: 0,
    repaired: 0,
    purged: 0,
    failed: 0,
  };

  // 1. Past its retention date. One statement, however many there are.
  const expired = await db
    .update(evidence)
    .set({ deletedAt: instant })
    .where(and(lte(evidence.deleteAfter, today), isNull(evidence.deletedAt)))
    .returning({ id: evidence.id });
  result.expired = expired.length;

  // 2. An upload with no check-in an hour later was abandoned.
  const cutoff = new Date(instant.getTime() - 60 * 60 * 1000);
  const unconfirmed = await db
    .select({
      id: evidence.id,
      objectKey: evidence.objectKey,
      userId: evidence.userId,
      idem: evidence.idem,
    })
    .from(evidence)
    .where(
      and(
        isNull(evidence.confirmedAt),
        isNull(evidence.deletedAt),
        lt(evidence.requestedAt, cutoff),
      ),
    )
    .limit(500);

  const orphans: number[] = [];
  for (const row of unconfirmed) {
    // Events are the truth (invariant 1). A check-in carrying this key means
    // the confirm failed, not that the photo is an orphan.
    const [event] = await db
      .select({ occurredAt: events.occurredAt })
      .from(events)
      .where(
        and(
          eq(events.userId, row.userId),
          sql`${events.payload}->>'idem' = ${row.idem}`,
          sql`${events.payload}->>'evidence_key' = ${row.objectKey}`,
        ),
      )
      .limit(1);

    if (event) {
      await confirmEvidence(row.id, event.occurredAt);
      result.repaired += 1;
      continue;
    }
    orphans.push(row.id);
  }

  if (orphans.length > 0) {
    await db
      .update(evidence)
      .set({ deletedAt: instant })
      .where(inArray(evidence.id, orphans));
    result.orphans = orphans.length;
  }

  // 3. Everything marked and still in the bucket, including what the two cases
  //    above just marked, so a photograph retention took tonight does not wait
  //    for tomorrow night to actually go.
  const outstanding = await db
    .select({ id: evidence.id, objectKey: evidence.objectKey })
    .from(evidence)
    .where(and(isNotNull(evidence.deletedAt), isNull(evidence.purgedAt)))
    .limit(2000);

  const { purged, failed } = await purgeObjects(outstanding, instant);
  result.purged = purged;
  result.failed = failed;

  return result;
}

/** What the browser should compress to, for one type (decision 97). */
export function compressionFor(typeKey: string): { maxEdge: number; quality: number } {
  const rule = getActivityType(typeKey).evidence;
  return { maxEdge: rule.maxEdge ?? 1920, quality: rule.quality ?? 0.85 };
}
