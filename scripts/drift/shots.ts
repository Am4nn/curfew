// Screenshot every mock artboard next to its live app route, side by side, for
// a manual visual-drift pass. Reads scripts/drift/manifest.json, writes PNG
// pairs to .shots/, plus .shots/index.html (the gallery) and
// .shots/capture-log.json (a machine-readable summary).
//
// Usage:
//   bun run scripts/drift/shots.ts                  # every entry
//   bun run scripts/drift/shots.ts --section=Groups  # one section
//   bun run scripts/drift/shots.ts --slug=home-today # one entry (repeatable
//                                                     # via comma list)
//
// Requires a dev server already running against .env.local (`bun run local`)
// at http://localhost:3000. This script does not start or stop it.

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const DESIGN_DIR = path.join(ROOT, ".design");
const SHOTS_DIR = path.join(ROOT, ".shots");
const MANIFEST_PATH = path.join(ROOT, "scripts", "drift", "manifest.json");
const FIXTURE_IDS_PATH = path.join(ROOT, "scripts", "drift", "fixture-ids.json");
const APP_ORIGIN = "http://localhost:3000";
const PLACEHOLDER_CLOCK = "2026-01-15T09:00:00.000Z";

// The twelve real activity type keys. routeKey hints for /checkin/[key] carry
// suffixes like "-confirm" that aren't real keys; strip anything after a
// hyphen that isn't itself one of these.
const TYPE_KEYS = [
  "sleep", "gym", "food", "supplements", "office", "study",
  "steps", "water", "reading", "screen", "nightfast", "sugarfree",
];

type ManifestEntry = {
  slug: string;
  section: string;
  mock: string;
  route: string;
  state: string;
  fixture: string;
  clock?: string;
  routeKey?: string;
  interaction?: string;
  note?: string;
};

type CaptureResult = {
  slug: string;
  mockOk: boolean;
  appOk: boolean;
  mockError: string | null;
  appError: string | null;
  mockPath: string | null;
  appPath: string | null;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const section = args.find((a) => a.startsWith("--section="))?.split("=")[1];
  const slugArg = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const slugs = slugArg ? slugArg.split(",").map((s) => s.trim()) : undefined;
  return { section, slugs };
}

function isIsoInstant(value: string | undefined): value is string {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

// Resolve a checkin routeKey hint (e.g. "sleep-confirm") down to a real type
// key (e.g. "sleep"). If the hint is already a real key, use it as-is.
function resolveTypeKey(hint: string): string {
  if (TYPE_KEYS.includes(hint)) return hint;
  const stripped = hint.split("-")[0];
  if (TYPE_KEYS.includes(stripped)) return stripped;
  return hint; // best effort; will 404 and be logged
}

async function loadFixtureIds(): Promise<Record<string, string>> {
  if (!existsSync(FIXTURE_IDS_PATH)) return {};
  try {
    return JSON.parse(await readFile(FIXTURE_IDS_PATH, "utf8"));
  } catch {
    console.warn(`WARNING: ${FIXTURE_IDS_PATH} exists but is not valid JSON. Ignoring it.`);
    return {};
  }
}

// Substitute [key] / [id] / [inviteId] placeholders in a route. Returns null
// (with a console warning) if a substitution can't be resolved, so the
// caller can skip just that entry's app-side capture.
function resolveRoute(
  entry: ManifestEntry,
  fixtureIds: Record<string, string>,
): string | null {
  let route = entry.route;

  if (route.includes("[key]")) {
    // Only the checkin routes use [key], and there it's literally the
    // activity type key.
    const hint = entry.routeKey;
    if (!hint) {
      console.warn(`WARNING [${entry.slug}]: route has [key] but no routeKey hint. Skipping app capture.`);
      return null;
    }
    const key = resolveTypeKey(hint);
    route = route.replace("[key]", key);
  }

  if (route.includes("[id]")) {
    const hint = entry.routeKey;
    const id = hint ? fixtureIds[hint] : undefined;
    if (!id) {
      console.warn(
        `WARNING [${entry.slug}]: route has [id], routeKey="${hint}" not found in fixture-ids.json. Skipping app capture.`,
      );
      return null;
    }
    route = route.replace("[id]", id);
  }

  if (route.includes("[inviteId]")) {
    // No routeKey hint in the manifest for join/ entries; fall back to the
    // fixture name itself as the lookup key.
    const hint = entry.routeKey ?? entry.fixture;
    const id = fixtureIds[hint];
    if (!id) {
      console.warn(
        `WARNING [${entry.slug}]: route has [inviteId], lookup "${hint}" not found in fixture-ids.json. Skipping app capture.`,
      );
      return null;
    }
    route = route.replace("[inviteId]", id);
  }

  return route;
}

async function ensureDirs() {
  await mkdir(SHOTS_DIR, { recursive: true });
}

async function ensureGitignoreHasShots() {
  const gitignorePath = path.join(ROOT, ".gitignore");
  const content = await readFile(gitignorePath, "utf8");
  if (!content.split("\n").some((line) => line.trim() === ".shots/")) {
    await writeFile(gitignorePath, content.replace(/\n?$/, "\n.shots/\n"));
  }
}

async function screenshotMock(browser: Browser, entry: ManifestEntry): Promise<{ ok: boolean; error: string | null; outPath: string }> {
  const outPath = path.join(SHOTS_DIR, `${entry.slug}.mock.png`);
  const mockFile = path.join(DESIGN_DIR, entry.mock);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    if (!existsSync(mockFile)) {
      throw new Error(`mock file not found: ${mockFile}`);
    }
    const url = "file:///" + mockFile.replace(/\\/g, "/");
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(200); // settle any fonts/layout

    // Prefer the <x-dc> root's bounding box; fall back to full page.
    const root = page.locator("x-dc").first();
    let shot: Buffer;
    if (await root.count()) {
      shot = await root.screenshot();
    } else {
      shot = await page.screenshot({ fullPage: true });
    }
    await writeFile(outPath, shot);
    return { ok: true, error: null, outPath };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err), outPath };
  } finally {
    await context.close();
  }
}

// Per-tag scripted interactions for states that only appear after a UI
// action, not from URL + cookie alone. Each best-effort; on failure they
// leave a screenshot of whatever state was reached and let the caller log it.
async function runInteraction(page: Page, tag: string): Promise<void> {
  if (tag === "cfg-errors") {
    // Blank out the first numeric field on a configure screen so validation
    // kicks in, then attempt Save so the disabled/error state renders.
    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    if (count > 0) {
      const first = numberInputs.first();
      await first.fill("");
      await first.blur();
      await page.waitForTimeout(150);
    }
    const saveButton = page.getByRole("button", { name: /^save$/i });
    if (await saveButton.count()) {
      // Don't click if disabled (that's the validation state itself); if
      // enabled, clicking would submit, so only click when it's the intended
      // dead-Save-button state already visible. Just leave it as-is.
    }
    return;
  }

  if (tag === "admin-controls-confirm") {
    // Flip one toggle so the unsaved-changes bar appears, click Save to open
    // the confirmation sheet, screenshot happens after this returns. Never
    // click through the sheet's own confirm.
    const toggle = page.locator('button[aria-label]').filter({ hasText: "" }).first();
    // The Toggle component's accessible name is the field label; grab the
    // first toggle-shaped button (small, aria-label set, not the nav).
    const toggles = page.locator("button[aria-label]");
    const toggleCount = await toggles.count();
    let flipped = false;
    for (let i = 0; i < toggleCount; i++) {
      const el = toggles.nth(i);
      const box = await el.boundingBox();
      // Toggle is rendered at a fixed small size (~38x22); use that to find one.
      if (box && box.width < 45 && box.width > 30 && box.height < 28 && box.height > 16) {
        await el.click();
        flipped = true;
        break;
      }
    }
    if (!flipped) {
      console.warn("  admin-controls-confirm: could not find a toggle to flip; capturing page as-is.");
      return;
    }
    await page.waitForTimeout(150);
    const saveBarButton = page.getByRole("button", { name: /^save$/i });
    if (await saveBarButton.count()) {
      await saveBarButton.first().click();
      await page.waitForTimeout(300); // let the sheet animate in
    } else {
      console.warn("  admin-controls-confirm: no Save button found after flipping a toggle.");
    }
    return;
  }

  console.warn(`  unknown interaction tag "${tag}"; capturing page as loaded.`);
}

async function screenshotApp(
  browser: Browser,
  entry: ManifestEntry,
  fixtureIds: Record<string, string>,
): Promise<{ ok: boolean; error: string | null; outPath: string; skipped?: boolean }> {
  const outPath = path.join(SHOTS_DIR, `${entry.slug}.app.png`);
  const route = resolveRoute(entry, fixtureIds);
  if (route === null) {
    return { ok: false, error: "route placeholder could not be resolved (see warning above)", outPath, skipped: true };
  }

  let clock = entry.clock;
  if (!isIsoInstant(clock)) {
    if (clock) {
      console.warn(`WARNING [${entry.slug}]: clock "${clock}" is not a valid ISO instant yet; using placeholder ${PLACEHOLDER_CLOCK}.`);
    }
    clock = PLACEHOLDER_CLOCK;
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    {
      name: "mock_now",
      value: clock,
      domain: "localhost",
      path: "/",
    },
  ]);
  const page = await context.newPage();
  try {
    await page.goto(APP_ORIGIN + route, { waitUntil: "networkidle", timeout: 20000 });

    if (entry.interaction) {
      await runInteraction(page, entry.interaction);
    } else {
      await page.waitForTimeout(150);
    }

    const shot = await page.screenshot({ fullPage: false }); // fixed viewport, matches mock framing
    await writeFile(outPath, shot);
    return { ok: true, error: null, outPath };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err), outPath };
  } finally {
    await context.close();
  }
}

async function checkServerUp(): Promise<boolean> {
  try {
    const res = await fetch(APP_ORIGIN, { method: "GET" });
    return res.status < 500 || res.status === 404 || true; // any response means it's up
  } catch {
    return false;
  }
}

function relShots(p: string): string {
  return path.basename(p);
}

function buildGallery(entries: ManifestEntry[], results: CaptureResult[]): string {
  const resultBySlug = new Map(results.map((r) => [r.slug, r]));
  const sections = new Map<string, ManifestEntry[]>();
  for (const e of entries) {
    if (!sections.has(e.section)) sections.set(e.section, []);
    sections.get(e.section)!.push(e);
  }

  const sectionNav = [...sections.keys()]
    .map((s) => `<button class="nav-btn" data-section="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
    .join("");

  const sectionsHtml = [...sections.entries()]
    .map(([section, items]) => {
      const rows = items
        .map((entry) => {
          // A filtered run only produces results for the slugs it processed.
          // For everything else, fall back to whatever is already on disk
          // from a previous run rather than marking it MISSING — the gallery
          // always reflects the full 54, not just this invocation's batch.
          const r = resultBySlug.get(entry.slug);
          const mockOnDisk = existsSync(path.join(SHOTS_DIR, `${entry.slug}.mock.png`));
          const appOnDisk = existsSync(path.join(SHOTS_DIR, `${entry.slug}.app.png`));
          const mockOk = r ? r.mockOk : mockOnDisk;
          const appOk = r ? r.appOk : appOnDisk;
          const mockImg = mockOk
            ? `<img src="${escapeHtml(entry.slug)}.mock.png" loading="lazy" alt="mock">`
            : `<div class="missing">MISSING<br><small>${escapeHtml(r?.mockError ?? "not captured")}</small></div>`;
          const appImg = appOk
            ? `<img src="${escapeHtml(entry.slug)}.app.png" loading="lazy" alt="app">`
            : `<div class="missing">MISSING<br><small>${escapeHtml(r?.appError ?? "not captured")}</small></div>`;
          return `
        <div class="pair" data-section="${escapeHtml(section)}">
          <div class="pair-head">
            <span class="slug">${escapeHtml(entry.slug)}</span>
            <span class="route">${escapeHtml(entry.route)}</span>
          </div>
          <div class="state">${escapeHtml(entry.state)}</div>
          <div class="images">
            <div class="shot ${mockOk ? "" : "fail"}"><div class="shot-label">MOCK</div>${mockImg}</div>
            <div class="shot ${appOk ? "" : "fail"}"><div class="shot-label">APP</div>${appImg}</div>
          </div>
          ${entry.note ? `<div class="note">${escapeHtml(entry.note)}</div>` : ""}
        </div>`;
        })
        .join("\n");
      return `<section class="section-block" data-section="${escapeHtml(section)}">
        <h2>${escapeHtml(section)}</h2>
        <div class="pairs">${rows}</div>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Curfew drift review</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, "SF Mono", Consolas, monospace; background: #f2f2ef; color: #111; margin: 0; padding: 0 0 60px; }
  header { position: sticky; top: 0; background: #111; color: #fff; padding: 14px 20px; z-index: 10; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  header h1 { font-size: 14px; margin: 0; letter-spacing: 0.08em; text-transform: uppercase; }
  #filter { flex: 1; min-width: 160px; padding: 6px 8px; font-family: inherit; font-size: 12px; border: 1px solid #444; background: #000; color: #fff; }
  .nav { display: flex; gap: 6px; flex-wrap: wrap; }
  .nav-btn { font-family: inherit; font-size: 11px; padding: 4px 8px; background: transparent; color: #ccc; border: 1px solid #444; cursor: pointer; }
  .nav-btn:hover { background: #333; }
  .section-block { padding: 20px; }
  .section-block h2 { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
  .pairs { display: flex; flex-direction: column; gap: 24px; margin-top: 12px; }
  .pair { border: 1px solid #ccc; background: #fff; padding: 12px; }
  .pair-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
  .route { color: #888; font-weight: 400; }
  .state { font-size: 11px; color: #555; margin: 4px 0 10px; }
  .note { font-size: 10.5px; color: #a05a00; margin-top: 8px; }
  .images { display: flex; gap: 12px; flex-wrap: wrap; }
  .shot { flex: 0 0 340px; }
  .shot.fail { outline: 2px solid #c00; }
  .shot-label { font-size: 9.5px; letter-spacing: 0.1em; color: #999; margin-bottom: 4px; }
  .shot img { width: 100%; display: block; border: 1px solid #ddd; }
  .missing { width: 340px; height: 200px; display: flex; align-items: center; justify-content: center; flex-direction: column; background: #fee; color: #c00; font-size: 12px; font-weight: 700; text-align: center; padding: 8px; }
  .missing small { font-weight: 400; font-size: 9.5px; color: #900; margin-top: 6px; display: block; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>Drift review</h1>
  <input id="filter" type="text" placeholder="filter by slug or text...">
  <div class="nav">${sectionNav}</div>
</header>
${sectionsHtml}
<script>
  const filterInput = document.getElementById('filter');
  const navButtons = document.querySelectorAll('.nav-btn');
  const pairs = document.querySelectorAll('.pair');
  const sectionBlocks = document.querySelectorAll('.section-block');

  function applyFilter() {
    const q = filterInput.value.trim().toLowerCase();
    pairs.forEach(p => {
      const text = p.textContent.toLowerCase();
      p.hidden = q.length > 0 && !text.includes(q);
    });
    sectionBlocks.forEach(sec => {
      const anyVisible = [...sec.querySelectorAll('.pair')].some(p => !p.hidden);
      sec.hidden = !anyVisible;
    });
  }
  filterInput.addEventListener('input', applyFilter);
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const target = document.querySelector('.section-block[data-section="' + CSS.escape(section) + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const { section, slugs } = parseArgs();

  const manifestRaw = await readFile(MANIFEST_PATH, "utf8");
  const allEntries: ManifestEntry[] = JSON.parse(manifestRaw);

  const entries = allEntries.filter((e) => {
    if (section && e.section !== section) return false;
    if (slugs && !slugs.includes(e.slug)) return false;
    return true;
  });

  if (entries.length === 0) {
    console.error("No manifest entries matched the given filter.");
    process.exit(1);
  }

  await ensureDirs();
  await ensureGitignoreHasShots();

  const serverUp = await checkServerUp();
  if (!serverUp) {
    console.error(
      `\nCannot reach ${APP_ORIGIN}. Start the dev server first with:\n\n  bun run local\n\nthen rerun this script.\n`,
    );
    process.exit(1);
  }

  const fixtureIds = await loadFixtureIds();
  if (!existsSync(FIXTURE_IDS_PATH)) {
    console.warn(`Note: ${FIXTURE_IDS_PATH} does not exist yet. Entries with [id]/[inviteId] routes will skip their app-side capture.`);
  }

  const browser = await chromium.launch();
  const results: CaptureResult[] = [];

  for (const entry of entries) {
    process.stdout.write(`${entry.slug} ... `);
    const mockRes = await screenshotMock(browser, entry);
    const appRes = await screenshotApp(browser, entry, fixtureIds);
    results.push({
      slug: entry.slug,
      mockOk: mockRes.ok,
      appOk: appRes.ok,
      mockError: mockRes.error,
      appError: appRes.error,
      mockPath: mockRes.ok ? mockRes.outPath : null,
      appPath: appRes.ok ? appRes.outPath : null,
    });
    console.log(`mock=${mockRes.ok ? "ok" : "FAIL"} app=${appRes.ok ? "ok" : "FAIL"}`);
    if (!mockRes.ok) console.log(`  mock error: ${mockRes.error}`);
    if (!appRes.ok) console.log(`  app error: ${appRes.error}`);
  }

  await browser.close();

  // Merge into any existing log rather than overwrite it, so a filtered rerun
  // (--slug/--section) doesn't erase the record of everything a prior full
  // run already captured.
  const logPath = path.join(SHOTS_DIR, "capture-log.json");
  let existingLog: CaptureResult[] = [];
  if (existsSync(logPath)) {
    try {
      existingLog = JSON.parse(await readFile(logPath, "utf8"));
    } catch {
      // Corrupt or unreadable: start fresh rather than block the run.
    }
  }
  const mergedBySlug = new Map(existingLog.map((r) => [r.slug, r]));
  for (const r of results) mergedBySlug.set(r.slug, r);
  const mergedLog = allEntries
    .map((e) => mergedBySlug.get(e.slug))
    .filter((r): r is CaptureResult => r !== undefined);

  await writeFile(logPath, JSON.stringify(mergedLog, null, 2));

  const galleryHtml = buildGallery(allEntries, mergedLog);
  await writeFile(path.join(SHOTS_DIR, "index.html"), galleryHtml);

  const failCount = results.filter((r) => !r.mockOk || !r.appOk).length;
  console.log(`\nDone. ${results.length} entries processed, ${failCount} with at least one failed side.`);
  console.log(`Gallery: ${path.join(SHOTS_DIR, "index.html")}`);
}

main();
