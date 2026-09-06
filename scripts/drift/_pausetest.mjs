// Drive a pause through the real screens, as a person would.
//
//   bun run local:seed       (it declares pauses, so it needs a clean start)
//   bun run local            (in another terminal)
//   node scripts/drift/_pausetest.mjs
//
// Declares a trip on the Settings screen, moves the mock clock into it, and
// reads what Home, the members list and the standing tab actually say. The
// engine is covered by the simulation; this is the half that only a browser can
// answer, and it is here because the first version of the timezone check went
// green five times against the pending-approval screen.
import { chromium } from "playwright";
import { DateTime } from "luxon";

const BASE = "http://localhost:3000";
const TZ = "Asia/Kolkata";
let failed = 0;

function check(what, ok, detail = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function open(route) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  return page.locator("body").innerText();
}

/** The preview clock, which is the only way to stand inside a future pause. */
async function setClock(at) {
  await context.addCookies([
    {
      name: "mock_now",
      value: encodeURIComponent(at.toISO()),
      url: BASE,
    },
  ]);
}
async function clearClock() {
  await context.clearCookies();
}

const today = DateTime.now().setZone(TZ).startOf("day");
const from = today.plus({ days: 1 });
const to = today.plus({ days: 4 });

// --- declaring -------------------------------------------------------------
let text = await open("/settings/pause");
check("the pause screen offers a declaration", text.includes("WHAT IT COSTS"), text.slice(0, 60));
check("and says what it takes", text.includes("Every streak ends at 0."));

await page.locator('input[name="from"]').fill(from.toFormat("yyyy-MM-dd"));
await page.locator('input[name="to"]').fill(to.toFormat("yyyy-MM-dd"));
await page.getByRole("button", { name: "Declare" }).click();
await page.waitForTimeout(2500);

text = await page.locator("body").innerText();
check("declaring lands on the declared state", text.includes("DECLARED"), text.slice(0, 120));

// A pause that has not started must not change today.
text = await open("/");
check("today is untouched before it starts", !text.includes("Paused"), text.slice(0, 80));

// --- the minimum, and the past ---------------------------------------------
// Both refusals, proved through the same form a person uses.
await open("/settings/pause");
// Already declared, so the form is not there. Call it off first.
await page.getByRole("button", { name: "Call it off" }).click();
await page.waitForTimeout(2500);
text = await page.locator("body").innerText();
check("calling off a pause that never started removes it", text.includes("WHAT IT COSTS"));

await page.locator('input[name="from"]').fill(from.toFormat("yyyy-MM-dd"));
await page.locator('input[name="to"]').fill(from.plus({ days: 1 }).toFormat("yyyy-MM-dd"));
await page.getByRole("button", { name: "Declare" }).click();
await page.waitForTimeout(2000);
text = await page.locator("body").innerText();
check("two days is refused", text.includes("3 days or more"), text.slice(0, 200));

await page.locator('input[name="from"]').fill(today.minus({ days: 2 }).toFormat("yyyy-MM-dd"));
await page.locator('input[name="to"]').fill(today.plus({ days: 2 }).toFormat("yyyy-MM-dd"));
await page.getByRole("button", { name: "Declare" }).click();
await page.waitForTimeout(2000);
text = await page.locator("body").innerText();
check("a pause over days already lived is refused", text.includes("tomorrow at the earliest"), text.slice(0, 200));

// --- standing inside one ---------------------------------------------------
await page.locator('input[name="from"]').fill(from.toFormat("yyyy-MM-dd"));
await page.locator('input[name="to"]').fill(to.toFormat("yyyy-MM-dd"));
await page.getByRole("button", { name: "Declare" }).click();
await page.waitForTimeout(2500);

// Day one of the trip, at noon.
await setClock(from.set({ hour: 12 }));

text = await open("/");
check("Home says paused", text.includes("Paused"), text.slice(0, 60));
check("and keeps the money section", text.includes("BALANCES"));
check("and keeps the groups section", text.includes("GROUPS"));
check("and offers both ways out", text.includes("Extend") && text.includes("Come back early"));
check(
  "and the streak has NOT gone yet on day one",
  text.includes("Running until tonight"),
  text.match(/Streaks[\s\S]{0,60}/)?.[0]?.replace(/\s+/g, " "),
);

// Day three, so the first paused day has closed.
await setClock(from.plus({ days: 2 }).set({ hour: 12 }));
text = await open("/");
check(
  "by day three the streak has ended",
  text.includes("Ended"),
  text.match(/Streaks[\s\S]{0,60}/)?.[0]?.replace(/\s+/g, " "),
);

text = await open("/settings/pause");
check("the pause screen shows it running", text.includes("PAUSED") && text.includes("days left"));

// --- what a group sees -----------------------------------------------------
await open("/groups");
const groupLink = page.locator('a[href^="/group/"]').first();
const href = await groupLink.getAttribute("href");
if (href) {
  text = await open(href);
  check("the members list says away, with the date", /Away until/.test(text), text.match(/Away until [^\n]*/)?.[0]);
  check(
    "and still shows a score for them",
    !text.includes("AWAY\n") || /Away until/.test(text),
  );
  text = await open(`${href}/standing`);
  check("the standing tab says paused", text.includes("PAUSED"));
  check("and keeps the number", text.includes("HELD, NOT FROZEN"), text.slice(0, 200));
}

// --- coming home early -----------------------------------------------------
await open("/settings/pause");
await page.getByRole("button", { name: "Come back early" }).click();
await page.waitForTimeout(2500);
text = await page.locator("body").innerText();
check("coming back early ends it from tomorrow", text.includes("PAUSED") && text.includes("1 day left"), text.slice(0, 160));

await clearClock();
console.log(errors.length ? `\npage errors:\n  ${errors.join("\n  ")}` : "\nno page errors");
await browser.close();
console.log(failed === 0 ? "\nall good" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
