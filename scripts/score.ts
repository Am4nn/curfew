// Run the scoring job from the CLI. `bun run score` scores every user up to the
// last closed period; `bun run score --from-date=2026-08-01` forces a recompute
// from that date. Idempotent.
import { scoreAll } from "@/server/scoring";

const fromArg = process.argv.find((a) => a.startsWith("--from-date="));
const from = fromArg?.split("=")[1];

const result = await scoreAll(from ? { from } : {});
console.log(`scored ${result.users} user(s)${from ? ` from ${from}` : ""}`);
process.exit(0);
