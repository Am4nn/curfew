/**
 * bun run check:push -- [--days 1] [--user <id>]
 * bun run check:push:production -- --days 3
 *
 * What Curfew actually said to people, word for word.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * v3.3 recorded that a notification had been sent and not what it said. So when
 * the first person to receive them reported that they were unreadable, there
 * was no way to read them: diagnosing it meant pulling the raw payloads,
 * reconstructing each member's situation by hand, and re-running the composer
 * to rebuild sentences that had already been delivered to a phone. Every one of
 * those steps could have reconstructed the wrong thing, and the words are the
 * only part of this feature a person ever experiences.
 *
 * The route stores `title` and `body` on the `push.sent` event now. This reads
 * them back. It is the difference between "the job ran and sent 8" and being
 * able to see that two of the eight said "Almost there" over an empty day.
 *
 * READ-ONLY throughout. It sends nothing, writes nothing and changes nothing,
 * so it is safe against production and is meant to be run there: the morning
 * after a release is exactly when somebody should read what went out.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { events, users } from "@/db/schema";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const days = Number(arg("days") ?? 1);
const onlyUser = arg("user");

if (!Number.isFinite(days) || days < 1) {
  console.error("--days must be a positive number");
  process.exit(1);
}

const since = DateTime.utc().minus({ days }).toJSDate();

const where = onlyUser
  ? and(eq(events.type, "push.sent"), gte(events.occurredAt, since), eq(events.userId, onlyUser))
  : and(eq(events.type, "push.sent"), gte(events.occurredAt, since));

const rows = await db
  .select({
    userId: events.userId,
    name: users.name,
    occurredAt: events.occurredAt,
    payload: events.payload,
  })
  .from(events)
  .leftJoin(users, eq(users.id, events.userId))
  .where(where)
  .orderBy(desc(events.occurredAt));

// The tick's own log, which answers "did the job run at all" separately from
// "did anybody get anything". A quiet night and a dead cron look identical in
// the table above and are not the same problem.
const [ran] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(events)
  .where(and(eq(events.type, "ops.push.ran"), gte(events.occurredAt, since)));

console.log("");
console.log(`Notifications delivered in the last ${days} day${days === 1 ? "" : "s"}.`);
console.log(`The tick ran ${ran?.n ?? 0} times over the same window.`);

if (rows.length === 0) {
  console.log("");
  console.log("Nothing was sent.");
  if ((ran?.n ?? 0) === 0) {
    console.log("And the tick never ran, which is a different problem: check");
    console.log("the QStash schedule and PUSH_REMINDERS before the copy.");
  }
  console.log("");
  process.exit(0);
}

// Grouped by person, because the question worth asking is almost always "what
// was this one member's day like", not "what happened across the fleet".
const byUser = new Map<string, typeof rows>();
for (const r of rows) {
  const key = r.userId ?? "(none)";
  byUser.set(key, [...(byUser.get(key) ?? []), r]);
}

const kinds = new Map<string, number>();

for (const [userId, theirs] of byUser) {
  console.log("");
  console.log("=".repeat(74));
  console.log(`${theirs[0].name ?? userId}   ${theirs.length} sent`);
  console.log("=".repeat(74));

  // Oldest first within a person: a day reads forwards.
  for (const r of [...theirs].reverse()) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const slot = typeof p.slot === "string" ? p.slot : "?";
    const kind = typeof p.kind === "string" ? p.kind : "(pre-3.4)";
    const title = typeof p.title === "string" ? p.title : "";
    const body = typeof p.body === "string" ? p.body : "";

    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);

    console.log("");
    console.log(`  ${slot}  [${kind}]`);
    if (title || body) {
      console.log(`         ${title}`);
      console.log(`         ${body}`);
    } else {
      // Rows written before the route stored the words. Worth saying out loud
      // rather than printing two blank lines that look like a bug here.
      console.log("         (sent before the text was recorded)");
    }
  }
}

console.log("");
console.log("=".repeat(74));
console.log(`${rows.length} notifications, ${byUser.size} people.`);
for (const [kind, n] of [...kinds].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind.padEnd(12)} ${n}`);
}
console.log("");
console.log("Read them. The question is not whether they were sent, it is");
console.log("whether somebody glancing at a lock screen would know what to do.");
console.log("");

export {};
