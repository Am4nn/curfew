import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// The clean run: consecutive days, ending now, on which nothing scheduled was
// missed. It is what IMMACULATE is made of.
//
// IMMACULATE used to be a score, "950 or more", and the simulation showed that
// a steady 87.5% completion settles at 969 and holds it. The score saturates
// near the top, so no line drawn on it can mean "nothing missed". A record is
// measured as a record instead: the top band, plus a run of clean days.
//
// A day with nothing scheduled does not break a run and is counted inside it:
// not being scheduled is not a failure, and a weekly-only activity would
// otherwise never accumulate a run at all. A day with something due and not
// done ends it.
//
// `reputation_daily` already stores exactly this, one row a day per scope, with
// `completion` null for a day that had nothing due. So the run is a read, not a
// second thing to keep in step: counted in SQL rather than by shipping a year
// of rows to node to walk backwards.

interface Row {
  key: string;
  clean: number;
}

const rowsOf = (result: unknown): Row[] => {
  // node-postgres and the Neon HTTP driver disagree about whether a raw result
  // IS the rows or CARRIES them.
  const carried = (result as { rows?: unknown[] }).rows;
  return (carried ?? result) as Row[];
};

/**
 * Every scope's clean run for one user: "global", and each group by id.
 *
 * One query, whatever the number of groups. `closeOutstanding` has to have run
 * for today to be in it, which every screen that shows a rank has already done
 * through `standingsFor`.
 */
export const cleanRunFor = cache(
  async (userId: string): Promise<Map<string, number>> => {
    const result = await db.execute(sql`
      WITH missed AS (
        SELECT group_id, max(day) AS day
          FROM reputation_daily
         WHERE user_id = ${userId}
           AND completion IS NOT NULL AND completion < 1
         GROUP BY group_id
      )
      SELECT COALESCE(r.group_id::text, 'global') AS key,
             count(*)::int AS clean
        FROM reputation_daily r
        LEFT JOIN missed m ON m.group_id IS NOT DISTINCT FROM r.group_id
       WHERE r.user_id = ${userId}
         AND (m.day IS NULL OR r.day > m.day)
       GROUP BY 1
    `);
    return new Map(rowsOf(result).map((r) => [r.key, Number(r.clean)]));
  },
);

/** One scope's run. `null` is the global score, a group id is a group's. */
export async function cleanRunIn(
  userId: string,
  groupId: string | null,
): Promise<number> {
  return (await cleanRunFor(userId)).get(groupId ?? "global") ?? 0;
}

/**
 * Every member of one group, and their clean run in it.
 *
 * The members list draws a rank icon per member and the glow is part of it, so
 * this answers for all of them at once rather than once per row.
 */
export const cleanRunsIn = cache(
  async (groupId: string): Promise<Map<string, number>> => {
    const result = await db.execute(sql`
      WITH missed AS (
        SELECT user_id, max(day) AS day
          FROM reputation_daily
         WHERE group_id = ${groupId}
           AND completion IS NOT NULL AND completion < 1
         GROUP BY user_id
      )
      SELECT r.user_id AS key, count(*)::int AS clean
        FROM reputation_daily r
        LEFT JOIN missed m ON m.user_id = r.user_id
       WHERE r.group_id = ${groupId}
         AND (m.day IS NULL OR r.day > m.day)
       GROUP BY 1
    `);
    return new Map(rowsOf(result).map((r) => [r.key, Number(r.clean)]));
  },
);
