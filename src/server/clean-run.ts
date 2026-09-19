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
// WHAT ENDS A RUN IS READ FROM THE PERIODS, NOT FROM `completion`, and that is
// the whole point of this file being longer than one query.
//
// `reputation_daily.completion` is null for two different days: one where
// nothing was scheduled, and one where everything scheduled is inside its
// activity's seven-day SETTLING window (decision 54) and so cannot move
// reputation yet. This counted both as clean, which meant a member who added
// their activities on Monday and did almost none of them was told on Friday
// that they had five clean days. Every one of those days had something due and
// not done. The bug is not that the number was too high, it is that the number
// was measuring reputation movement while claiming to measure a record.
//
// So the BREAK comes from where a period's verdict actually lives:
// `activity_scores` for the global run, and `activity_outcomes` for a group's,
// which is already narrowed to the types that member shares with it. Settling
// has no say in either. A paused period is not a miss, and `activity_outcomes`
// has already dropped those, so only the global arm says so.
//
// The COUNT still comes from `reputation_daily`, one row a day per scope, which
// is what makes a quiet day count inside the run instead of being missing from
// it.

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
const cleanRunFor = cache(
  async (userId: string): Promise<Map<string, number>> => {
    const result = await db.execute(sql`
      WITH missed AS (
        -- The global run: every activity, settling included, pauses excluded.
        SELECT NULL::uuid AS group_id, max(s.period_end - 1) AS day
          FROM activity_scores s
         WHERE s.user_id = ${userId}
           AND NOT s.passed
           AND NOT s.paused
        UNION ALL
        -- One group's run: only what this member shares with it, which is what
        -- an outcome row already means. Paused periods never produce one.
        SELECT o.group_id, max(s.period_end - 1) AS day
          FROM activity_outcomes o
          JOIN activity_scores s
            ON s.user_id = o.user_id
           AND s.type_key = o.type_key
           AND s.period_start = o.period_start
         WHERE o.user_id = ${userId}
           AND NOT o.passed
         GROUP BY o.group_id
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
        SELECT o.user_id, max(s.period_end - 1) AS day
          FROM activity_outcomes o
          JOIN activity_scores s
            ON s.user_id = o.user_id
           AND s.type_key = o.type_key
           AND s.period_start = o.period_start
         WHERE o.group_id = ${groupId}
           AND NOT o.passed
         GROUP BY o.user_id
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
