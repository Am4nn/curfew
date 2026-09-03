// Orchestrates the full 54-screen capture: for each fixture the manifest
// references, reseed the local DB to that exact state, then run the capture
// harness for just the slugs that need it. Local-only; never touches git.
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";

const manifest = JSON.parse(await readFile("scripts/drift/manifest.json", "utf8"));

const bySlugOrder = [
  "default", "all-done", "no-money", "new-user", "notice-active", "admin",
  "checkin-open-steps", "checkin-open-sleep-confirm", "checkin-open-sugarfree",
  "invite-tracked-type", "invite-untracked-type",
];

const groups = new Map();
for (const e of manifest) {
  if (!groups.has(e.fixture)) groups.set(e.fixture, []);
  groups.get(e.fixture).push(e.slug);
}

const order = bySlugOrder.filter((f) => groups.has(f));
for (const f of groups.keys()) if (!order.includes(f)) order.push(f);

for (const fixture of order) {
  const slugs = groups.get(fixture);
  console.log(`\n=== fixture: ${fixture} (${slugs.length} slugs) ===`);
  execSync(`bun run local:seed -- --fixture=${fixture}`, { stdio: "inherit" });
  execSync(`bun run scripts/drift/shots.ts --slug=${slugs.join(",")}`, { stdio: "inherit" });
}

console.log("\n=== restoring DB to default fixture ===");
execSync(`bun run local:seed -- --fixture=default`, { stdio: "inherit" });

console.log("\nAll fixtures captured. Open .shots/index.html to review.");
