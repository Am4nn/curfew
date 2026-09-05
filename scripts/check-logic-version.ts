// Does a curve change repair itself, or does somebody have to notice?
//
//   bun run check:logic-version
//
// `LOGIC_VERSION` exists so a score computed under older maths is never carried
// forward. This proves the mechanism end to end rather than by reading it:
// stamp the stored rows with an older version and a wrong number, run the same
// pass the nightly job runs, and see whether the rows come back correct.
//
// Local only. It rewrites reputation_daily for one user and puts it back by
// recomputing, which is the thing being tested.
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { reputationDaily } from "@/db/schema";
import { scoreAll } from "@/server/scoring";
import { LOGIC_VERSION } from "@/domain";

if (process.env.LOCAL_MODE !== "1") {
  console.error("Refusing to run: LOCAL_MODE is not 1. This rewrites stored scores.");
  process.exit(1);
}

let failed = 0;
function check(what: string, ok: boolean, got: unknown = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${got === "" ? "" : `  ${String(got)}`}`);
  if (!ok) failed++;
}

const [sample] = await db
  .select({ userId: reputationDaily.userId, day: reputationDaily.day })
  .from(reputationDaily)
  .where(isNull(reputationDaily.groupId))
  .orderBy(sql`day desc`)
  .limit(1);

if (!sample) {
  console.error("No reputation rows. Run bun run local:seed first.");
  process.exit(1);
}

const before = await db
  .select({ score: reputationDaily.score, version: reputationDaily.logicVersion })
  .from(reputationDaily)
  .where(
    and(
      eq(reputationDaily.userId, sample.userId),
      isNull(reputationDaily.groupId),
      eq(reputationDaily.day, sample.day),
    ),
  );

check("the seeded rows carry the current logic version", before[0].version === LOGIC_VERSION, `${before[0].version}`);

// An old version AND a wrong number, which is what a curve change leaves
// behind: rows that are internally consistent and no longer correct.
await db
  .update(reputationDaily)
  .set({ logicVersion: 1, score: "1.000" })
  .where(and(eq(reputationDaily.userId, sample.userId), isNull(reputationDaily.groupId)));

const stamped = await db
  .select({ score: reputationDaily.score, version: reputationDaily.logicVersion })
  .from(reputationDaily)
  .where(
    and(
      eq(reputationDaily.userId, sample.userId),
      isNull(reputationDaily.groupId),
      eq(reputationDaily.day, sample.day),
    ),
  );
check("the row is now wrong and stamped with the old version", stamped[0].score === "1.000" && stamped[0].version === 1);

await scoreAll();

const after = await db
  .select({ score: reputationDaily.score, version: reputationDaily.logicVersion })
  .from(reputationDaily)
  .where(
    and(
      eq(reputationDaily.userId, sample.userId),
      isNull(reputationDaily.groupId),
      eq(reputationDaily.day, sample.day),
    ),
  );

check("one ordinary scoring pass restored the score", after[0].score === before[0].score, `${after[0].score} was ${before[0].score}`);
check("and stamped it with the current version", after[0].version === LOGIC_VERSION, `${after[0].version}`);

console.log(failed === 0 ? "\nA curve change repairs itself. No migration, no button." : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
