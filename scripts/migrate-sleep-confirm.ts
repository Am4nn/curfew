// Move everybody already tracking Sleep onto the anchored confirm window.
//
//   bun run migrate:sleep -- --dry
//   bun run migrate:sleep
//
// Run by hand after the 3.2.0 tag, against whichever database `.env.*` points
// at, beside `publish:notice`. The two go together: this is the change, and the
// notice is what tells people it happened.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SCRIPT AND NOT A CODE CHANGE ON ITS OWN
//
// Sleep's confirm window used to be two clock times in config. It is now half
// an hour that opens half an hour after the WAKE press (item 17). Config is
// insert-only and resolved as it stood on the period being judged (invariant
// 5), so the old rows are not wrong: they are the truth about how those nights
// were scored, and the module still reads them and still judges those nights
// the old way.
//
// Which means nothing changes for an existing member until a row without the
// retired pair takes effect. That is what this writes, dated TOMORROW in the
// member's own zone, because invariant 4 forbids a config change landing on a
// period already running.
//
// Idempotent. A member who has no retired pair left is already moved and is
// skipped, so running it twice does nothing the second time.
// ---------------------------------------------------------------------------
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { userActivityConfig } from "@/db/schema";
import { resolveConfig, sleepConfigSchema } from "@/domain";
import { userDay } from "@/server/config";

const dry = process.argv.includes("--dry");

const rows = await db
  .select({
    userId: userActivityConfig.userId,
    effectiveFrom: userActivityConfig.effectiveFrom,
    config: userActivityConfig.config,
  })
  .from(userActivityConfig)
  .where(eq(userActivityConfig.typeKey, "sleep"));

// The NULL-scoped row is the seed's app-wide default, not a person.
const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => id !== null))];

let moved = 0;
let already = 0;

for (const userId of userIds) {
  const mine = rows.filter((r) => r.userId === userId);
  const day = await userDay(userId);
  const tomorrow = DateTime.fromISO(day).plus({ days: 1 }).toFormat("yyyy-MM-dd");

  // What will be in force tomorrow, which is the row this replaces. Resolving
  // as of tomorrow rather than today matters for anybody who saved a change in
  // the last day: that change is theirs and has to be carried forward.
  const current = resolveConfig(
    mine.map((r) => ({ ...r, scopeId: r.userId })),
    tomorrow,
  );
  if (!current) continue;

  const blob = current.config as Record<string, unknown> | null;
  const raw = (blob && typeof blob === "object" && "config" in blob ? blob.config : blob) as
    | Record<string, unknown>
    | null;
  if (!raw) continue;

  if (raw.confirm_open === undefined && raw.confirm_close === undefined) {
    already += 1;
    continue;
  }

  // Parsing is what drops the retired pair. Their own night and wake windows
  // come through untouched, which is what the release note promises.
  const config = sleepConfigSchema.parse(raw);
  const schedule = blob && typeof blob === "object" ? blob.schedule : undefined;
  if (!schedule) {
    console.error(`  ${userId}: no engine half on the row in force. Skipped.`);
    continue;
  }

  console.log(
    `  ${userId}: ${JSON.stringify(config)} from ${tomorrow}` +
      ` (was ${String(raw.confirm_open)} to ${String(raw.confirm_close)})`,
  );
  moved += 1;
  if (dry) continue;

  await db
    .insert(userActivityConfig)
    .values({ userId, typeKey: "sleep", effectiveFrom: tomorrow, config: { schedule, config } })
    // Saving twice in one day amends the change that has not taken effect yet,
    // the same rule `saveUserActivity` follows. If they edited their windows
    // today, this replaces that row with the same windows minus the retired
    // pair, so their edit survives and the confirm still moves.
    .onConflictDoUpdate({
      target: [
        userActivityConfig.userId,
        userActivityConfig.typeKey,
        userActivityConfig.effectiveFrom,
      ],
      set: { config: { schedule, config } },
    });
}

console.log(
  `\n${moved} ${moved === 1 ? "member" : "members"} ${dry ? "would move" : "moved"} to the` +
    ` anchored confirm window; ${already} already there.`,
);
if (dry) console.log("Dry run. Nothing was written.");

process.exit(0);
