// Run the scoring job from the CLI. `bun run score` closes and scores every
// user up to their last closed period, then moves reputation. Idempotent, so a
// missed or repeated run costs nothing.
import { scoreAll } from "@/server/scoring";

const fromArg = process.argv.find((a) => a.startsWith("--from-date="));
const from = fromArg?.split("=")[1];

const result = await scoreAll(from ? { from } : {});
console.log(`scored ${result.users} user(s)${from ? ` from ${from}` : ""}`);
process.exit(0);
