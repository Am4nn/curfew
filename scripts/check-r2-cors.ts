import { presign } from "@/server/r2";
import { isLocalStore } from "@/server/r2";
import { required } from "@/lib/env";

/**
 * Does the R2 bucket accept a browser upload from the origin this environment
 * is served on?
 *
 * The photo never passes through a serverless function: the browser PUTs
 * straight to R2. That is a cross-origin request, so R2's CORS allowlist has to
 * name every origin the app is served from, and that allowlist lives in the
 * Cloudflare dashboard where nothing in this repo can see it.
 *
 * It cost an evening once. Uploads failed on dev.curfew.amanarya.com while
 * every check passed, because the two origins anyone had tested from,
 * localhost:3000 and curfew.amanarya.com, were the two that happened to be on
 * the list. The browser reported a bare network failure, which looks identical
 * to bad credentials, a bad signature and a dead bucket.
 *
 *   bun run check:cors                       the origin in BETTER_AUTH_URL
 *   bun run check:cors https://foo.bar       any origin
 *
 * Non-zero if an origin is blocked, so it can gate a deploy.
 */

const extra = process.argv.slice(2).filter((a) => !a.startsWith("-"));

if (isLocalStore()) {
  console.log("LOCAL_MODE is on: uploads go to disk, not R2, and CORS does not apply.");
  process.exit(0);
}

const origins = extra.length > 0 ? extra : [new URL(required("BETTER_AUTH_URL")).origin];

// A preflight writes nothing and needs no valid signature to be answered, so
// this is safe to run against a live bucket.
const url = presign({ key: "diagnostic/cors-probe", method: "PUT", expiresIn: 120 });

let blocked = 0;
console.log(`bucket ${required("R2_BUCKET")}\n`);
for (const origin of origins) {
  const response = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allowed = response.headers.get("access-control-allow-origin") !== null;
  if (!allowed) blocked += 1;
  console.log(`  ${allowed ? "ok     " : "BLOCKED"}  ${origin}`);
}

if (blocked > 0) {
  console.error(
    `\n${blocked} origin(s) blocked. A browser upload from there fails with a bare` +
      `\nnetwork error. Add them to the bucket's CORS policy in the Cloudflare` +
      `\ndashboard: R2 > the bucket > Settings > CORS policy. Allowed methods PUT` +
      `\nand GET, allowed header content-type.`,
  );
  process.exit(1);
}
console.log("\nEvery origin can upload.");
