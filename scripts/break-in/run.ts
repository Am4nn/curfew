import { build, teardown, leftovers, fixedHttpIdentity } from "./world";
import { run as direct } from "./direct";
import { run as http } from "./http";
import { check, summary } from "./harness";

// Break our own app. Every item on the TRUST-SAFETY.md security round, tried
// for real against a real database and a real server, with what falls over
// reported rather than swallowed. Non-zero if anything gives (decision 116).
//
//   bun run break-in          against the preview database
//   bun run break-in:local    against docker, where it can also sweep HTTP
//
// It creates its own people, its own groups and its own admin, and removes all
// of them at the end. It borrows no account and touches nobody else's rows, so
// the same round runs anywhere.
//
// `--http=<origin>` points the request sweep somewhere; the default is a local
// dev server, and the sweep says so and skips when nothing answers.

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

// In LOCAL_MODE the dev server and this script read the same docker database,
// so the sweep can be pointed at it by default. Anywhere else they need not be
// the same database at all, and a sweep against a server reading somewhere else
// would pass on every route by finding nothing. So it has to be asked for, and
// the positive control inside the sweep is what says the two agree.
const asked = arg("http");
const localHere = fixedHttpIdentity() !== null;
const base = asked ?? (localHere ? "http://localhost:3000" : null);

const world = await build();
console.log(`world ${world.tag}: three people, two groups, nothing borrowed`);
if (fixedHttpIdentity()) {
  console.log(`LOCAL_MODE: the HTTP sweep runs as ${fixedHttpIdentity()}, a member of neither`);
}

let crashed: unknown = null;
try {
  await direct(world);
  if (base) await http(world, base, { defaulted: asked === undefined, localHere });
  else {
    console.log(
      "\nskip   the HTTP sweep  no --http=<origin> given, and this is not LOCAL_MODE",
    );
  }
} catch (e) {
  crashed = e;
}

await teardown(world);
check("the round cleans up after itself", (await leftovers(world)) === 0);

if (crashed) {
  console.error("\nthe round itself fell over:");
  console.error(crashed);
  process.exit(1);
}

process.exit(summary() === 0 ? 0 : 1);
