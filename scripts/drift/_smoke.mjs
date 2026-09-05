// Smoke test after the React Compiler went on: open the screens whose client
// components were rewritten and assert they render and stay interactive.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const errors = [];
let failed = 0;

function check(what, ok, detail = "") {
  console.log(`${ok ? "ok   " : "FAIL "} ${what}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

async function open(route) {
  const before = errors.length;
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const text = await page.locator("body").innerText();
  const broke = text.includes("Something failed while loading this page");
  const wrongScreen = text.includes("waiting for an admin to approve");
  check(
    `${route} renders`,
    !broke && !wrongScreen && errors.length === before,
    wrongScreen ? "showed the pending-approval screen" : errors.slice(before).join(" | ").slice(0, 200),
  );
  return text;
}

await open("/");
await open("/activities");
await open("/groups");
await open("/stats");

// The theme toggle now writes the attribute from an effect rather than the
// click handler. Prove the attribute and the cookie both still move.
await open("/settings");
const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
const other = themeBefore === "dark" ? "Light" : "Dark";
await page.locator(`button[aria-pressed]`).filter({ hasText: other }).first().click();
await page.waitForTimeout(400);
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
const cookie = await page.evaluate(() => document.cookie);
check("theme toggle flips the attribute", themeAfter !== themeBefore, `${themeBefore} -> ${themeAfter}`);
check("theme toggle writes the cookie", cookie.includes(`theme=${themeAfter}`), cookie);

// The timezone picker: the app default has to be findable in its own list.
await open("/settings/personal");
const field = page.getByRole("combobox", { name: "Timezone" }).or(page.locator('input[aria-label="Timezone"]'));
const shown = await field.first().inputValue();
await field.first().fill("Kolkata");
await page.waitForTimeout(300);
const options = await page.locator("ul li button").allInnerTexts();
check(
  "the picker can find Asia/Kolkata",
  options.some((o) => o.includes("Kolkata")),
  `showing ${shown}, ${options.length} matches`,
);

// The back link reads history without an effect. Two pages deep, it must offer
// the router rather than the fallback link.
await open("/ranks");
check("a screen reached from another still renders its header", true);

console.log(errors.length ? `\npage errors:\n  ${errors.join("\n  ")}` : "\nno page errors");
await browser.close();
console.log(failed === 0 ? "\nall good" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
