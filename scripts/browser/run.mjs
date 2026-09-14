// The half of the app only a browser can answer.
//
//   bun run local:seed
//   bun run local            (in another terminal)
//   bun run browser
//
// Everything below this line runs against a real Next server, through the real
// screens, pressing the real buttons. It exists because three whole areas were
// covered only as functions: the settle form, the admin console's actions, and
// the pause flow. A server action's guard can be called directly and pass while
// the action is wired to the wrong one, and a form can be correct in every
// respect except that its button does not submit.
//
// It is deliberately not a unit test framework. Each suite is a list of
// sentences that are either true of the screen or not, and a failure prints
// what the page actually said.
//
// A caution, learned here: the first version of the timezone check went green
// five times against the pending-approval screen, because the simulation had
// wiped the database out from under it and every route redirected. `open`
// refuses that screen by name, and every suite asserts something positive.
//
// IT LEAVES THE DATABASE AHEAD OF ITSELF. The pause suite scrubs the preview
// clock into a future trip, and every read on a scrubbed page closes periods,
// so the derived tables come out carrying days that have not happened. That is
// the preview clock working as designed and it outlives the cookie, so reseed
// before running `verify` or the script checks after this. `verify` reports
// those rows as drift rather than ignoring them: a stored day beyond the replay
// would otherwise be the balance `resumePointFor` carries forward, and every
// real day between now and then would never be computed at all.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { SUITES, SUITE_NAMES } from "./suites.mjs";

const BASE = process.env.BROWSER_BASE ?? "http://localhost:3000";
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

/**
 * Refuse a fixture that has gone stale overnight.
 *
 * Every fixture that anchors on the real clock puts its "today" events on the
 * day it was seeded. Once the member's zone rolls past midnight, the whole
 * fixture describes yesterday: Water reads "0 of 8 today" and this suite fails
 * saying a finished counter is not finished. That is true, and has nothing to
 * do with the app. Seeding at 11:59 PM and running at 12:01 AM is all it
 * takes, and CI crosses midnight in Asia/Kolkata at 18:30 UTC every day.
 *
 * Checked here rather than left to fail, because the failure it produces is a
 * confident sentence about the wrong subject. Cheap to fix and expensive to
 * diagnose is exactly the shape that should stop the run.
 */
function checkFixtureIsToday() {
  const path = new URL("../drift/.seeded.json", import.meta.url);
  let seeded;
  try {
    seeded = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // An older fixture, seeded before this was written. Say so and carry on:
    // refusing here would fail a run that is probably fine.
    console.log("note: no fixture marker. Reseed if anything below looks like yesterday.");
    return;
  }
  if (!seeded.day || !seeded.tz) return;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: seeded.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (today !== seeded.day) {
    console.error(
      `\nThe fixture is stale. It was seeded for ${seeded.day} and it is now ` +
        `${today} in ${seeded.tz}, so every "today" in the database is ` +
        `yesterday.\n\nRun: bun run local:seed\n`,
    );
    process.exit(1);
  }
}

checkFixtureIsToday();

// A name that is not a suite is a shard that runs nothing, and a shard that
// runs nothing passes. CI's matrix is the caller that would make this mistake,
// so it is refused here rather than reported as a green run of no checks.
const unknown = only.filter((name) => !SUITE_NAMES.includes(name));
if (unknown.length > 0) {
  console.error(
    `Not a suite: ${unknown.join(", ")}.\nThere are ${SUITE_NAMES.length}: ${SUITE_NAMES.join(", ")}`,
  );
  process.exit(1);
}

let failed = 0;
let held = 0;
const errors = [];

function check(what, ok, detail = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${detail ? "  " + String(detail).replace(/\s+/g, " ").slice(0, 160) : ""}`);
  if (ok) held += 1;
  else failed += 1;
}

// Is anything there at all? A suite against a dead server reports twenty
// failures that all mean the same thing.
const reachable = await fetch(BASE, { redirect: "manual" }).then(
  () => true,
  () => false,
);
if (!reachable) {
  console.error(`Nothing answered at ${BASE}. Start the server first: bun run local`);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
/**
 * Console noise the dev server makes that is not the app failing.
 *
 * A failed asset fetch: the dev server recompiles a route on first hit and can
 * drop the connection while it does, which showed up here as five
 * ERR_CONNECTION_RESET lines and four 404s on chunks that existed a second
 * later. Counting those made the suite fail about one run in three.
 *
 * And `frame.join is not a function`, which is Next's own error REPORTER
 * failing. It is thrown inside `buildFakeCallStack` while the client
 * reconstructs a server error's stack for the dev overlay, so what reaches the
 * console is the handler's error rather than the error it was handling, and
 * there is nothing in it to act on. Ignoring it is only safe because `open`
 * refuses the error boundary by name: a route that actually threw now stops the
 * suite and says which one, which is the signal this line used to stand in for
 * badly.
 */
const NOISE = [/^Failed to load resource/, /frame\.join is not a function/];
const isNoise = (text) => NOISE.some((p) => p.test(text));

page.on("pageerror", (e) => {
  if (!isNoise(String(e))) errors.push(String(e));
});
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (isNoise(m.text())) return;
  errors.push(m.text());
});

/**
 * Open a route and hand back its text, refusing the screens that mean nothing.
 *
 * One retry, for the same reason. A route being compiled for the first time can
 * take longer than the timeout or reset the connection outright; a real failure
 * fails twice, so the retry cannot hide one.
 */
/**
 * Wait for the page to be ready, rather than for a length of time.
 *
 * This was `waitForTimeout(1200)`: a blind sleep after `domcontentloaded`, on
 * every navigation, 62 of them. It was wrong in both directions. On a warm page
 * React had finished at 660ms and the suite sat there for the other 540; on a
 * cold route in CI, 1200ms after DOM-ready is a hope, not a guarantee, and the
 * thing it was really standing in for was never measured at all.
 *
 * What it was standing in for is hydration. A suite that clicks a button before
 * React has attached to it gets a press that does nothing, and then an `until`
 * that times out 25 seconds later blaming the screen. So that is what is waited
 * for: React's own root marker on the document, plus the text holding still
 * across two reads. Both, because the markup can be complete before the handlers
 * are and the handlers can be attached while a suspended boundary is still
 * filling in.
 *
 * The ceiling is what makes the marker safe to depend on. React's container
 * property is an internal name, so if a future version stops using it this
 * degrades to a timed wait, which is exactly today's behaviour and not a
 * failure. `ceilings` counts how often that happens and the run says so at the
 * end, because a silent fallback to sleeping is how this would rot unnoticed.
 */
let ceilings = 0;
async function settle(ceiling = 2000) {
  const deadline = Date.now() + ceiling;
  let previous = null;
  let steady = 0;
  for (;;) {
    const hydrated = await page.evaluate(
      () =>
        Object.keys(document).some((k) => k.startsWith("__react")) ||
        Object.keys(document.body).some((k) => k.startsWith("__react")),
    );
    const text = await page.locator("body").innerText();
    if (hydrated && text !== "" && text === previous) {
      steady += 1;
      if (steady >= 2) return text;
    } else {
      steady = 0;
    }
    if (Date.now() >= deadline) {
      ceilings += 1;
      return text;
    }
    previous = text;
    await page.waitForTimeout(100);
  }
}

let opens = 0;
async function open(route) {
  opens += 1;
  let text;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 120000 });
      text = await settle();
    } catch (e) {
      if (attempt >= 1) throw e;
      await page.waitForTimeout(2000);
      continue;
    }

    // The screen that is not the screen. `_route-error.tsx` renders inside the
    // layout and with a 200, so a route that threw still carries its heading
    // and its nav, and an assertion looking for either passes against a page
    // that did not load. CI reported "ok /activities renders" over the error
    // boundary for exactly this reason, and the only thing that gave it away
    // was a console error Next had failed to serialise properly.
    //
    // Retried once, on the same reasoning as the navigation above: the dev
    // server compiling a route for the first time can throw once and serve it
    // correctly a moment later. A route that is actually broken renders the
    // boundary twice, and then this stops the suite by name rather than
    // letting a green tick stand over it.
    if (text.includes("This did not load")) {
      if (attempt >= 1) {
        throw new Error(
          `${route} rendered the error boundary twice. Something threw on the server; the dev server's own log says what.`,
        );
      }
      await page.waitForTimeout(2000);
      continue;
    }
    break;
  }

  if (text.includes("waiting for an admin to approve")) {
    throw new Error(
      `${route} showed the pending-approval screen. The database is empty: run bun run local:seed.`,
    );
  }
  return text;
}

const body = () => page.locator("body").innerText();

/**
 * Wait until the page says something, and hand back what it says.
 *
 * The suite used to act, sleep a fixed 2.5 seconds, then read once. That is
 * long enough on a warm machine and not always long enough on a CI runner
 * compiling the route it just navigated to, so checks failed for a reason that
 * was never the app: a pause declaration that had landed, read a moment before
 * the screen caught up. Polling costs nothing when the page is already right,
 * and the timeout is what makes a genuine failure still fail.
 *
 * Returns the body either way, so the caller's assertion prints what was
 * actually on screen when it gave up.
 */
async function until(predicate, timeout = 25000) {
  const deadline = Date.now() + timeout;
  let text = await body();
  while (Date.now() < deadline) {
    if (predicate(text)) return text;
    await page.waitForTimeout(250);
    text = await body();
  }
  return text;
}

/** The preview clock, which is the only way to stand inside a future pause. */
async function setClock(iso) {
  await context.addCookies([{ name: "mock_now", value: encodeURIComponent(iso), url: BASE }]);
}
async function clearClock() {
  await context.clearCookies();
}

const ctx = { page, context, BASE, check, open, body, until, setClock, clearClock, errors };

try {
  for (const [name, run] of SUITES) {
    if (only.length > 0 && !only.includes(name)) continue;
    console.log(`\n--- ${name} ---`);
    const startedAt = Date.now();
    const opensBefore = opens;
    try {
      await run(ctx);
    } catch (e) {
      check(`${name} ran to the end`, false, String(e));
    }
    console.log(
      `TIMING ${name} ${((Date.now() - startedAt) / 1000).toFixed(1)}s ${opens - opensBefore} opens`,
    );
  }
} finally {
  await clearClock();
  await browser.close();
}

// A page error anywhere is a failure, even where the assertion passed: a screen
// that renders the right words while throwing in the console is broken.
if (errors.length > 0) {
  console.log(`\npage errors:\n  ${errors.join("\n  ")}`);
}
// If most navigations hit the ceiling, `settle` is no longer detecting anything
// and has quietly become the blind sleep it replaced. Say so rather than just
// getting slower.
if (ceilings > opens / 2) {
  console.log(
    `\nnote: ${ceilings} of ${opens} navigations waited out the ceiling. React's` +
      ` root marker is probably gone, so this is back to sleeping. See settle().`,
  );
}
console.log(
  `\n${held} held, ${failed} failed${errors.length > 0 ? `, ${errors.length} page error(s)` : ""}`,
);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
