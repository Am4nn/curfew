import { DateTime } from "luxon";
import { getActivityType } from "@/domain";
import { listOwnPhotos, readUrl } from "./evidence";

/** One of a person's own photographs, signed and ready to render. */
export interface SignedPhoto {
  id: number;
  url: string;
  typeKey: string;
  name: string;
  icon: string;
  /** Formatted server-side, e.g. "3 Sep". Client clocks are not consulted. */
  date: string;
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
  opts: { typeKey?: string; limit?: number } = {},
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
  return out;
}
