// Create or replace the QStash schedule that ticks the reminder job.
//
//   bun run schedule:reminders -- --dry
//   bun run schedule:reminders
//   bun run schedule:reminders:production
//   bun run schedule:reminders -- --remove
//
// ---------------------------------------------------------------------------
// Why this is a script and not a thing somebody clicks
//
// The tick is infrastructure that decides whether anybody is contacted. Left in
// a dashboard it is invisible to review, invisible to git, and impossible to
// tell apart from a schedule somebody created twice while debugging. Here it is
// a diff, and the cadence lives beside the SLOT_MINUTES it has to agree with.
//
// It has to be QStash rather than Vercel Cron. On Hobby a Vercel cron is once a
// day, UTC only, with timing guaranteed to the hour. Reminders are per member
// in their own zone, and a last call ten minutes before a window shuts needs
// minute precision.
//
// Authentication is CRON_SECRET in a forwarded header, exactly as Vercel Cron
// sends to /api/cron/score, so there is one shape for "a scheduler called us"
// rather than two. QStash signs its requests as well, and the signing keys are
// in the env files unused: verifying them would mean a second auth path and a
// package, to prove something the bearer token already proves.
// ---------------------------------------------------------------------------

// Nothing here imports anything, and top-level await needs a module. Every
// other script in here gets this for free from its imports.
export {};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const dry = process.argv.includes("--dry");
const remove = process.argv.includes("--remove");
const cron = arg("cron") ?? "*/15 * * * *";

const base = process.env.QSTASH_URL ?? "https://qstash.upstash.io";
const token = process.env.QSTASH_TOKEN;
const secret = process.env.CRON_SECRET;
const origin = process.env.BETTER_AUTH_URL;

if (!token) {
  console.error("QSTASH_TOKEN is not set. See .env.example.");
  process.exit(1);
}
if (!secret) {
  console.error("CRON_SECRET is not set. The tick would have nothing to prove.");
  process.exit(1);
}
if (!origin) {
  console.error("BETTER_AUTH_URL is not set, so there is no URL to call.");
  process.exit(1);
}

const destination = `${origin.replace(/\/$/, "")}/api/cron/remind`;

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
const existing = schedules.filter((s) => s.destination === destination);

console.log(`Destination  ${destination}`);
console.log(`Cron         ${cron}`);
console.log(
  `Existing     ${
    existing.length === 0
      ? "none"
      : existing.map((s) => `${s.scheduleId} (${s.cron})`).join(", ")
  }`,
);

// Said plainly rather than swallowed. Two schedules on one destination is the
// failure this script exists to prevent, and it looks like nothing at all: the
// job simply runs twice per tick, and the idempotency index quietly absorbs the
// second one, so the only symptom is a doubled bill.
if (existing.length > 1) {
  console.log(`\n${existing.length} schedules point at this URL. All will be removed first.`);
}

if (remove) {
  if (existing.length === 0) {
    console.log("\nNothing to remove.");
    process.exit(0);
  }
  if (dry) {
    console.log("\nDry run. Nothing was removed.");
    process.exit(0);
  }
  for (const s of existing) {
    const gone = await qstash(`/v2/schedules/${s.scheduleId}`, { method: "DELETE" });
    if (!gone.ok) {
      console.error(`Could not remove ${s.scheduleId}: ${gone.status}`);
      process.exit(1);
    }
  }
  console.log(`\nRemoved ${existing.length}. Nothing ticks this environment now.`);
  process.exit(0);
}

if (existing.length === 1 && existing[0].cron === cron) {
  console.log("\nAlready scheduled, with this cadence. Nothing to do.");
  process.exit(0);
}

if (dry) {
  console.log("\nDry run. Nothing was scheduled.");
  process.exit(0);
}

// Replace rather than add: QStash does not dedupe by destination, so creating
// one every time this runs is how a fifteen-minute tick becomes a five-minute
// one nobody meant.
for (const s of existing) {
  await qstash(`/v2/schedules/${s.scheduleId}`, { method: "DELETE" });
}

const created = await qstash(`/v2/schedules/${destination}`, {
  method: "POST",
  headers: {
    "Upstash-Cron": cron,
    "Upstash-Method": "GET",
    // Forwarded to our route as a plain `Authorization` header, which is what
    // /api/cron/remind checks.
    "Upstash-Forward-Authorization": `Bearer ${secret}`,
    // Three tries, then stop. A tick that cannot be delivered is a tick whose
    // moment has passed: the next one is fifteen minutes away and will say
    // something truer than a retry of this one.
    "Upstash-Retries": "3",
  },
});

if (!created.ok) {
  console.error(`QStash refused: ${created.status} ${await created.text()}`);
  process.exit(1);
}

const { scheduleId } = (await created.json()) as { scheduleId: string };
console.log(`\nScheduled ${scheduleId}.`);
console.log(
  "Remember PUSH_REMINDERS: the tick will run, and the route answers " +
    '{ ok: true, skipped: "disabled" } until that is 1 IN VERCEL, not only in ' +
    "the env file.",
);
