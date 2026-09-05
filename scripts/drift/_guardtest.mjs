import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
// Warm it first, then read what the guard reads.
for (const route of ["/settings/photos-does-not-exist", "/settings/photos"]) {
  try { await p.goto("http://localhost:3000" + route, { waitUntil: "domcontentloaded", timeout: 60000 }); } catch { /* the point is what the page says next, not whether the hop worked */ }
  await p.waitForTimeout(1500);
  const text = await p.evaluate(() => document.body.innerText);
  const wrong = text.includes("Something failed while loading this page")
    ? "error boundary"
    : text.includes("No such page") ? "not-found boundary" : null;
  console.log(route.padEnd(36), "->", wrong ?? "a real screen");
}
await b.close();
