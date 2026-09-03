import { and, desc, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { evidence } from "@/db/schema";
import { RETENTION_DAYS } from "./evidence";

// What the Ops tab reports about stored evidence. Counted, never read: the
// console knows how many photos exist and never what any of them shows.

export interface EvidenceOps {
  stored: number;
  bytes: number;
  retentionDays: number;
  lastSweep: { at: Date; deleted: number } | null;
  /** Uploaded, never confirmed, older than an hour: the sweep's next targets. */
  orphaned: number;
}

export async function evidenceOps(): Promise<EvidenceOps> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);

  const [stored, swept, last, orphaned] = await Promise.all([
    db
      .select({
        n: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${evidence.bytes}), 0)::bigint`,
      })
      .from(evidence)
      .where(isNull(evidence.deletedAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(sql`${evidence.deletedAt} > now() - interval '24 hours'`),
    db
      .select({ at: evidence.deletedAt })
      .from(evidence)
      .where(sql`${evidence.deletedAt} is not null`)
      .orderBy(desc(evidence.deletedAt))
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(
        and(
          isNull(evidence.confirmedAt),
          isNull(evidence.deletedAt),
          sql`${evidence.requestedAt} < ${cutoff}`,
        ),
      ),
  ]);

  return {
    stored: stored[0]?.n ?? 0,
    bytes: Number(stored[0]?.bytes ?? 0),
    retentionDays: RETENTION_DAYS,
    lastSweep: last[0]?.at ? { at: last[0].at, deleted: swept[0]?.n ?? 0 } : null,
    orphaned: orphaned[0]?.n ?? 0,
  };
}

/** Bytes as something a person reads. */
export function humanBytes(bytes: number): string {
  if (bytes === 0) return "nothing";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
