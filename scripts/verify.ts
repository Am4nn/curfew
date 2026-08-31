// Recompute a date range from events and diff against the stored scores and
// outcomes. `bun run verify` checks all history; `--from-date=` / `--to-date=`
// bound the range. Exits non-zero if any drift is found.
import { verifyAll } from "@/server/verify";

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const drift = await verifyAll({ from: arg("from-date"), to: arg("to-date") });

if (drift.length === 0) {
  console.log("no drift");
  process.exit(0);
}

console.log(`${drift.length} drift row(s):`);
for (const d of drift) {
  console.log(`  ${d.kind} ${d.key} ${d.field}: stored=${d.stored} computed=${d.computed}`);
}
process.exit(1);
