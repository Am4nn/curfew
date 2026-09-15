import { DateTime } from "luxon";
import { getActivityType } from "@/domain";
import { db } from "@/db";
import { evidence } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { listOwnPhotos, readUrl } from "./evidence";
import { tagsFor, type PhotoTag } from "./evidence-tags";
import { resolveUserTimezone, userDay } from "./config";
import { now } from "@/lib/clock";

/** One of a person's own photographs, signed and ready to render. */
export interface SignedPhoto {
  id: number;
  url: string;
  typeKey: string;
  name: string;
  icon: string;
  /** Formatted server-side, e.g. "3 Sep". Client clocks are not consulted. */
  date: string;
  /**
   * When it was sent, in the person's own zone: "Today · 7:12 AM".
   *
   * Only on Your Photos, which is the one screen that answers where a
   * photograph went and so is the one screen where the minute matters. A grid
   * of squares carries the day and nothing more.
   */
  when?: string;
  /**
   * The groups it was sent to, and the ones that saw it once.
   *
   * Absent means the question was not asked. Empty means it was asked and the
   * answer is nobody, which is what "Yours only" is drawn from.
   */
  tags?: PhotoTag[];
}

/**
 * A person's own photographs, newest first, each with a short-lived GET.
 *
 * Three screens want this and each had its own copy of the presign loop. A
 * presign failure (a stale key, a storage outage) drops the one tile rather
 * than taking down the page around it.
 */
export async function ownPhotos(
  userId: string,
  opts: { typeKey?: string; limit?: number; withTags?: boolean } = {},
): Promise<SignedPhoto[]> {
  const rows = await listOwnPhotos(userId);
  const out: SignedPhoto[] = [];
  for (const p of rows) {
    if (opts.typeKey && p.typeKey !== opts.typeKey) continue;
    if (opts.limit !== undefined && out.length >= opts.limit) break;
    try {
      const type = getActivityType(p.typeKey);
      out.push({
        id: p.id,
        url: readUrl(p.objectKey),
        typeKey: p.typeKey,
        name: type.name,
        icon: type.icon,
        date: DateTime.fromISO(p.periodStart).toFormat("d LLL"),
      });
    } catch {
      // Skip it.
    }
  }

  if (!opts.withTags) return out;

  // One query for the page, not one a row, and the same for the zone: both are
  // the same answer for every photograph here.
  const zone = await resolveUserTimezone(userId, await userDay(userId));
  // The app's clock, not the machine's, so a scrubbed preview says Today about
  // the day it is pretending to be (invariant 8 either way: never the client's).
  const today = DateTime.fromJSDate(await now(), { zone }).startOf("day");
  const tags = await tagsFor(out.map((p) => p.id));
  const byId = new Map(rows.map((r) => [r.id, r.confirmedAt]));

  return out.map((p) => {
    const at = byId.get(p.id);
    return {
      ...p,
      tags: tags.get(p.id) ?? [],
      when: at ? sentLabel(DateTime.fromJSDate(at).setZone(zone), today) : undefined,
    };
  });
}

/** "Today · 7:12 AM", "Yesterday · 1:40 PM", "12 Sep · 6:58 AM". */
function sentLabel(at: DateTime, today: DateTime): string {
  const days = today.diff(at.startOf("day"), "days").days;
  const day = days === 0 ? "Today" : days === 1 ? "Yesterday" : at.toFormat("d LLL");
  return `${day} · ${at.toFormat("h:mm a")}`;
}

/**
 * How many photographs the person has, for "30 of 214" without signing 214
 * URLs to find out. Same predicate as `listOwnPhotos`.
 */
export async function countOwnPhotos(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(evidence)
    .where(
      and(
        eq(evidence.userId, userId),
        isNull(evidence.deletedAt),
        sql`${evidence.confirmedAt} is not null`,
      ),
    );
  return row?.n ?? 0;
}
