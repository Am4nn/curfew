// Does CI's browser matrix still run every suite?
//
//   bun run check:shards
//
// The browser job was one job running eight suites in a line, and it was the
// pipeline's wall clock. It is four parallel shards now, each naming the suites
// it owns, which introduces a failure this repo had no way to see: a suite that
// no shard names is a suite that never runs, and nothing goes red. CI stays
// green, faster than before, while a whole area of the app stops being checked.
//
// That is the same shape as the bug `open` guards against, where the timezone
// check went green five times against the pending-approval screen. A check that
// cannot fail is worse than no check, because it is also a claim.
//
// Read as text rather than parsed, the way `check:actions` reads the same
// files. There is no YAML dependency in this repo and adding one to read four
// lines would be the more expensive answer.
import { readFile } from "node:fs/promises";
import { SUITE_NAMES } from "./browser/suites.mjs";

const WORKFLOW = ".github/workflows/ci.yml";

const yaml = await readFile(WORKFLOW, "utf8");

// The `suites:` values inside the browser job's matrix. Every entry is a
// space-separated list of suite names.
const named = [...yaml.matchAll(/^\s*suites:\s*(.+)$/gm)].map((m) => m[1].trim());

if (named.length === 0) {
  console.error(`No shards found in ${WORKFLOW}. Has the browser matrix been renamed?`);
  process.exit(1);
}

const run = named.flatMap((line) => line.split(/\s+/));
const seen = new Set(run);

const missing = SUITE_NAMES.filter((name) => !seen.has(name));
const unknown = run.filter((name) => !SUITE_NAMES.includes(name));
const twice = run.filter((name, i) => run.indexOf(name) !== i);

for (const [what, list] of [
  ["never run by any shard", missing],
  ["named by a shard but not a suite", unknown],
  ["run by more than one shard", twice],
] as const) {
  if (list.length > 0) console.error(`${list.join(", ")} — ${what}.`);
}

if (missing.length > 0 || unknown.length > 0 || twice.length > 0) {
  console.error(
    `\n${WORKFLOW} runs: ${run.join(", ")}\n` +
      `scripts/browser/suites.mjs has: ${SUITE_NAMES.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `ok: ${named.length} shards run all ${SUITE_NAMES.length} suites, each exactly once.`,
);
