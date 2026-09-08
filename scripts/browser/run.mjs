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
import { chromium } from "playwright";
import { screens } from "./screens.mjs";
import { balances } from "./balances.mjs";
import { admin } from "./admin.mjs";
import { counter } from "./counter.mjs";
import { owners } from "./owners.mjs";
import { pause } from "./pause.mjs";

const BASE = process.env.BROWSER_BASE ?? "http://localhost:3000";
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const SUITES = [
  ["screens", screens],
  ["balances", balances],
  ["admin", admin],
  // Before pause, which leaves the clock scrubbed several days out and every
  // counter finished. This one needs a day with nothing on it.
  ["counter", counter],
  // Before pause, which scrubs the clock and declares a trip.
  ["owners", owners],
  ["pause", pause],
];

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
async function open(route) {
  let text;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1200);
      text = await page.locator("body").innerText();
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
    try {
      await run(ctx);
    } catch (e) {
      check(`${name} ran to the end`, false, String(e));
    }
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
console.log(
  `\n${held} held, ${failed} failed${errors.length > 0 ? `, ${errors.length} page error(s)` : ""}`,
);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
