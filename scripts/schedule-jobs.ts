// Create, update or remove every QStash schedule this app runs on.
//
//   bun run schedule -- --dry
//   bun run schedule
//   bun run schedule:production
//   bun run schedule -- --remove
//   bun run schedule -- --rewrite   (recreate all, the only way to change the
//                                     failure callback, which QStash never
//                                     reports back)
//
// ---------------------------------------------------------------------------
// Why this is a script and not a thing somebody clicks
//
// These ticks decide whether anybody is contacted and when their day is judged.
// Left in a dashboard they are invisible to review, invisible to git, and
// impossible to tell apart from a schedule somebody created twice while
// debugging. Here they are a diff, and the cadences live beside the constants
// they have to agree with.
//
// ALL of the scheduling is here. `vercel.json` used to carry a `crons` entry
// for the scoring job and no longer does, on purpose. A Vercel cron on Hobby is
// once a day, UTC only, guaranteed to the hour, and one daily firing in UTC
// cannot serve members in more than one span of timezones. 07:00 UTC is
// comfortably late in Kolkata and too early in Berlin, where a sleep period
// shuts at 08:00 UTC, so that member was scored a day late, every day, for as
// long as they were a member. Moving the hour only moves the cliff west.
//
// Two schedulers also meant two places to look when a job did not run, and the
// interesting failure is a job that silently never fired.
//
// Authentication is CRON_SECRET in a forwarded header, which is what all three
// routes check. QStash signs its requests as well, and the signing keys sit in
// the env files unused: verifying them would mean a second auth path and a
// package, to prove something the bearer token already proves.
//
// ---------------------------------------------------------------------------
// The failure callback, and why --rewrite exists
//
// Every schedule names /api/cron/failed as its `Upstash-Failure-Callback`.
// QStash POSTs there once a delivery has exhausted its retries, and that route
// writes an `ops.job.failed` event. Without it a job that failed three times
// simply vanished: the record went to Upstash's dead letter queue, which the
// free plan keeps for THREE DAYS, and nothing in this repo has ever read it.
//
// QStash DOES NOT REPORT THE CALLBACK BACK. A schedule listing carries the
// cron, the destination, the retries and the forwarded Authorization header,
// and says nothing at all about either callback field, on the list endpoint or
// on a single-schedule GET. So this script cannot tell a schedule that has the
// callback from one that does not, and the reconcile below cannot pick it up
// as a difference the way it picks up a changed cadence.
//
// Hence `--rewrite`: delete and recreate every declared job, whatever its
// current cadence. Run it after changing anything about the callback, and once
// against an environment whose schedules predate it. Everything else in here
// is still reconcile-and-leave-alone.
// ---------------------------------------------------------------------------

// Nothing here imports anything, and top-level await needs a module. Every
// other script in here gets this for free from its imports.
export {};

/**
 * Every scheduled job, and how often. The whole schedule, in one place.
 *
 * `check:cron` reads this table and asks each activity module whether the
 * scoring cadence is soon enough after its windows shut, so a cadence changed
 * here is a cadence CI has an opinion about.
 */
const JOBS: { path: string; cron: string; what: string }[] = [
  {
    path: "/api/cron/remind",
    cron: "*/15 * * * *",
    // Must match SLOT_MINUTES in that route, which is its idempotency key.
    what: "reminders: a last call before a window shuts",
  },
  {
    path: "/api/cron/score",
    cron: "0 * * * *",
    what: "scoring: resume each member from their last stored day",
  },
  {
    path: "/api/cron/nightly",
    cron: "0 7 * * *",
    what: "the full replay, the sweeps, and the drift report",
  },
];

const dry = process.argv.includes("--dry");
const remove = process.argv.includes("--remove");
const rewrite = process.argv.includes("--rewrite");

const base = process.env.QSTASH_URL ?? "https://qstash.upstash.io";
const token = process.env.QSTASH_TOKEN;
const secret = process.env.CRON_SECRET;
const origin = process.env.BETTER_AUTH_URL;

if (!token) {
  console.error("QSTASH_TOKEN is not set. See .env.example.");
  process.exit(1);
}
if (!secret) {
  console.error("CRON_SECRET is not set. The ticks would have nothing to prove.");
  process.exit(1);
}
if (!origin) {
  console.error("BETTER_AUTH_URL is not set, so there is no URL to call.");
  process.exit(1);
}

const root = origin.replace(/\/$/, "");
const wanted = JOBS.map((j) => ({ ...j, destination: `${root}${j.path}` }));

// Not a job and never a schedule: QStash calls it, once, when one of the three
// above has failed every retry. It is a POST, unlike the GETs, because QStash
// chooses the method for a callback.
const FAILURE_CALLBACK = `${root}/api/cron/failed`;

async function qstash(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
}

interface Schedule {
  scheduleId: string;
  destination: string;
  cron: string;
}

// Read the whole state before changing any of it, so --dry can print what would
// actually happen rather than what probably would.
const listed = await qstash("/v2/schedules");
if (!listed.ok) {
  console.error(`QStash refused to list schedules: ${listed.status}`);
  process.exit(1);
}
const schedules = (await listed.json()) as Schedule[];
const mine = schedules.filter((s) => s.destination.startsWith(`${root}/`));

const forDestination = (d: string) => mine.filter((s) => s.destination === d);

console.log(`Origin  ${root}`);
console.log(`Failed  ${FAILURE_CALLBACK}  (QStash never reports this back)\n`);
for (const job of wanted) {
  const existing = forDestination(job.destination);
  const state =
    existing.length === 0
      ? "none"
      : existing.map((s) => `${s.scheduleId} (${s.cron})`).join(", ");
  console.log(`  ${job.path.padEnd(20)} ${job.cron.padEnd(14)} now: ${state}`);
  console.log(`  ${"".padEnd(20)} ${job.what}`);
}

// A schedule pointing at this origin that no job declares. This is how a
// renamed route leaves a tick behind that nobody is looking for: it keeps
// firing, it keeps being billed, and it 404s into the retry budget.
const strays = mine.filter((s) => !wanted.some((j) => j.destination === s.destination));
if (strays.length > 0) {
  console.log("\nNot declared by any job, and will be removed:");
  for (const s of strays) console.log(`  ${s.scheduleId}  ${s.destination} (${s.cron})`);
}

// Said plainly rather than swallowed. Two schedules on one destination looks
// like nothing at all: the job runs twice per tick, the idempotency claim
// absorbs the second, and the only symptom is a doubled bill.
for (const job of wanted) {
  const n = forDestination(job.destination).length;
  if (n > 1) console.log(`\n${n} schedules point at ${job.path}. All will be removed first.`);
}

async function drop(list: Schedule[]): Promise<void> {
  for (const s of list) {
    const gone = await qstash(`/v2/schedules/${s.scheduleId}`, { method: "DELETE" });
    if (!gone.ok) {
      console.error(`Could not remove ${s.scheduleId}: ${gone.status}`);
      process.exit(1);
    }
  }
}

if (remove) {
  if (mine.length === 0) {
    console.log("\nNothing to remove.");
    process.exit(0);
  }
  if (dry) {
    console.log("\nDry run. Nothing was removed.");
    process.exit(0);
  }
  await drop(mine);
  console.log(`\nRemoved ${mine.length}. Nothing ticks this environment now.`);
  process.exit(0);
}

const changed = wanted.filter((job) => {
  if (rewrite) return true;
  const existing = forDestination(job.destination);
  return !(existing.length === 1 && existing[0].cron === job.cron);
});

if (changed.length === 0 && strays.length === 0) {
  console.log(
    "\nAll scheduled, with these cadences. Nothing to do. The failure " +
      "callback cannot be read back from QStash, so if you have just changed " +
      "it, run again with --rewrite.",
  );
  process.exit(0);
}

if (dry) {
  console.log(`\nDry run. ${changed.length} would be written, ${strays.length} removed.`);
  process.exit(0);
}

await drop(strays);

for (const job of changed) {
  // Replace rather than add: QStash does not dedupe by destination, so creating
  // one every time this runs is how an hourly tick becomes a twice-hourly one
  // nobody meant.
  await drop(forDestination(job.destination));

  const created = await qstash(`/v2/schedules/${job.destination}`, {
    method: "POST",
    headers: {
      "Upstash-Cron": job.cron,
      "Upstash-Method": "GET",
      // Forwarded to the route as a plain `Authorization` header, which is what
      // all three of them check.
      "Upstash-Forward-Authorization": `Bearer ${secret}`,
      // Three tries, then stop. A tick that cannot be delivered is a tick whose
      // moment has passed, and the next one will say something truer than a
      // retry of this one. Scoring claims its hour before doing any work, so a
      // retry arriving late cannot run the pass a second time.
      "Upstash-Retries": "3",
      // After those three tries, tell us. This is the only moment anybody
      // finds out, so the alternative is a job that disappeared.
      "Upstash-Failure-Callback": FAILURE_CALLBACK,
      // Forwarded to the callback as a plain `Authorization` header, the same
      // secret and the same shape the three job routes already check.
      "Upstash-Failure-Callback-Forward-Authorization": `Bearer ${secret}`,
    },
  });

  if (!created.ok) {
    console.error(`QStash refused ${job.path}: ${created.status} ${await created.text()}`);
    process.exit(1);
  }

  const { scheduleId } = (await created.json()) as { scheduleId: string };
  console.log(`\nScheduled ${job.path} as ${scheduleId}.`);
}

console.log(
  "\nRemember PUSH_REMINDERS: the reminder tick will run, and the route answers " +
    '{ ok: true, skipped: "disabled" } until that is 1 IN VERCEL, not only in ' +
    "the env file.",
);
