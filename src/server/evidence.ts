import { z } from "zod";
import { DateTime } from "luxon";
import { and, eq, isNull, lte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { evidence, events } from "@/db/schema";
import { getActivityType } from "@/domain";
import { presign, deleteObject } from "./r2";
import { rateLimit } from "./ratelimit";
import { resolveCheckinTarget } from "./checkin";
import { now } from "@/lib/clock";

// Evidence photos. No image passes through a serverless function (decision 71):
// the browser compresses, asks for a presigned PUT, uploads straight to R2, and
// only then sends the check-in.
//
// The order is deliberate. A file in R2 with no confirmed row is an orphan, and
// an orphan is swept. A check-in that needs a photo never exists without one,
// because the write path refuses it.

/** How long a photograph is kept. The check-in outlives it (decision, 60 days). */
export const RETENTION_DAYS = 60;

/** Two formats, because those are the two a canvas can encode to. */
const CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;

/** After compression. A 1600px photo at quality 0.80 is nowhere near this. */
export const MAX_UPLOAD_BYTES = 2_000_000;

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

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

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

/**
 * A presigned PUT for one photo, and the pending row that will be confirmed
 * when the check-in arrives.
 *
 * The window is checked here as well as on the check-in, so a photo can never
 * be uploaded against a window a check-in would be refused for.
 */
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

  // One photo per press. A client retrying with the same key gets the same
  // object back rather than a second row, so a stuck browser cannot fill the
  // bucket; a client retrying with a NEW key is simply a new attempt, and the
  // one it abandons is swept.
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
    // Long enough for a slow upload on mobile data, short enough that a leaked
    // URL is worth little. It is a bearer token for exactly one object.
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
 * Mark a photo confirmed, once the check-in that carries its key is recorded.
 *
 * There is no transaction: the HTTP driver has none. It does not need one.
 * The event carries the object key, so a confirm that fails leaves a row whose
 * state disagrees with the events table, and the sweep believes the event.
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

// ---------------------------------------------------------------------------
// The nightly sweeps
// ---------------------------------------------------------------------------

export interface SweepResult {
  expired: number;
  orphans: number;
  repaired: number;
  failed: number;
}

/**
 * Delete every photograph past its retention date, and every upload that was
 * never followed by a check-in.
 *
 * Both run nightly beside scoring. Deleting the object comes first: a row
 * marked deleted whose object survives is a photograph we said we had removed
 * and had not, which is the failure that matters. A row still marked live whose
 * object is gone is simply swept again tomorrow, and R2 answers a repeat delete
 * the same way it answers the first.
 */
export async function sweepEvidence(): Promise<SweepResult> {
  const instant = await now();
  const today = instant.toISOString().slice(0, 10);
  const result: SweepResult = { expired: 0, orphans: 0, repaired: 0, failed: 0 };

  const expired = await db
    .select({ id: evidence.id, objectKey: evidence.objectKey })
    .from(evidence)
    .where(and(lte(evidence.deleteAfter, today), isNull(evidence.deletedAt)))
    .limit(500);

  for (const row of expired) {
    try {
      await deleteObject(row.objectKey);
      await db
        .update(evidence)
        .set({ deletedAt: instant })
        .where(eq(evidence.id, row.id));
      result.expired += 1;
    } catch {
      // Leave the row alone and try again tomorrow. Marking it deleted here
      // would lose the only pointer to a file that is still in the bucket.
      result.failed += 1;
    }
  }

  // An upload with no check-in an hour later was abandoned: the browser died,
  // the window closed, or the person changed their mind. The photograph has
  // nothing to belong to.
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

  for (const row of unconfirmed) {
    // Events are the truth (invariant 1). A check-in carrying this key means
    // the confirm failed, not that the photo is an orphan: repair the row
    // rather than deleting a photograph someone's group is entitled to see.
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

    try {
      await deleteObject(row.objectKey);
      await db
        .update(evidence)
        .set({ deletedAt: instant })
        .where(eq(evidence.id, row.id));
      result.orphans += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

/** What the browser should compress to, for one type (decision 97). */
export function compressionFor(typeKey: string): { maxEdge: number; quality: number } {
  const rule = getActivityType(typeKey).evidence;
  return { maxEdge: rule.maxEdge ?? 1280, quality: rule.quality ?? 0.75 };
}
