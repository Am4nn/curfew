// Prove a fine cannot be charged twice.
//
//   bun run check:money
//
// Local only, and it cleans up after itself. It writes into a scratch period
// far outside anything the seed uses, so it never disturbs the fixture and
// `bun run verify` afterwards is unaffected.
//
// The bug this exists for: a fine is split among the members who PASSED the
// same period, so the number of shares depends on who has been scored when the
// split runs. `ledger_one_fine_idx` is unique per payer-payee pair, which makes
// each SHARE idempotent and the fine as a whole not idempotent at all. Settle
// once with one peer known and the payer owes that peer the whole amount.
// Settle again with two peers known and the second share inserts beside the
// first, because no row conflicts with anything. 500 charged as 750.
//
// This script does exactly that, in that order, and asserts the ledger sums to
// the fine. It fails on the commit before fine_postings.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries, finePostings, groupMembers } from "@/db/schema";
import { writeFines, type OutcomeRow } from "@/server/ledger";

if (process.env.LOCAL_MODE !== "1") {
  console.error("check:money is local only. Run it with dotenv -e .env.local.");
  process.exit(1);
}

const GROUP = "00000000-0000-0000-0000-0000000000a1"; // Night Owls, from seed-local
const TYPE = "sleep";
const PERIOD = "1999-01-04"; // a Monday nothing else touches
const FINE = 500;

const fail = (message: string) => {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
};

const scratch = and(
  eq(ledgerEntries.groupId, GROUP),
  eq(ledgerEntries.typeKey, TYPE),
  eq(ledgerEntries.periodStart, PERIOD),
);

async function cleanup() {
  await db.delete(ledgerEntries).where(scratch);
  await db
    .delete(finePostings)
    .where(
      and(
        eq(finePostings.groupId, GROUP),
        eq(finePostings.typeKey, TYPE),
        eq(finePostings.periodStart, PERIOD),
      ),
    );
}

const members = await db
  .select({ userId: groupMembers.userId })
  .from(groupMembers)
  .where(and(eq(groupMembers.groupId, GROUP), isNull(groupMembers.leftAt)));

if (members.length < 3) {
  console.error(
    `check:money needs three members in ${GROUP} and found ${members.length}.`,
  );
  console.error("Run `bun run local:seed` first.");
  process.exit(1);
}

const [payer, peerA, peerB] = members.map((m) => m.userId);

// Start clean, in case a previous run died partway.
await cleanup();

const missed: OutcomeRow = {
  groupId: GROUP,
  userId: payer,
  typeKey: TYPE,
  periodStart: PERIOD,
  passed: false,
  fineAmount: FINE,
  currency: "INR",
};
const passedBy = (userId: string): OutcomeRow => ({
  groupId: GROUP,
  userId,
  typeKey: TYPE,
  periodStart: PERIOD,
  passed: true,
  fineAmount: 0,
  currency: "INR",
});

const total = async () => {
  const rows = await db
    .select({ amount: ledgerEntries.amount })
    .from(ledgerEntries)
    .where(scratch);
  return rows.reduce((sum, r) => sum + r.amount, 0);
};

// Pass one: only one peer has been scored, so the whole fine goes to them.
const first = await writeFines([missed, passedBy(peerA)]);
const afterFirst = await total();
console.log(`pass 1: ${first} row(s), ${afterFirst} charged`);
if (afterFirst !== FINE) {
  fail(`after one peer the ledger should hold ${FINE}, it holds ${afterFirst}`);
}

// Pass two: the second peer is scored now. This is the moment the bug fired.
const second = await writeFines([missed, passedBy(peerA), passedBy(peerB)]);
const afterSecond = await total();
console.log(`pass 2: ${second} row(s), ${afterSecond} charged`);
if (second !== 0) {
  fail(`the second settlement wrote ${second} row(s); the fine was already posted`);
}
if (afterSecond !== FINE) {
  fail(
    `a ${FINE} fine is charged as ${afterSecond}. Shares must sum exactly to the fine (invariant 7).`,
  );
}

// And a third, with the peers in the other order, because the split is by
// sorted id and a reordered input must not look like a different fine.
await writeFines([missed, passedBy(peerB), passedBy(peerA)]);
const afterThird = await total();
if (afterThird !== FINE) {
  fail(`reordering the peers charged ${afterThird} rather than ${FINE}`);
}

await cleanup();

if (process.exitCode) {
  console.error("check:money failed");
} else {
  console.log("check:money ok: a fine is charged once, whoever is scored when");
}
process.exit(process.exitCode ?? 0);
