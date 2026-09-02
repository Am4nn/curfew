// Reconciles the module registry into `activity_types` rows (decision 63).
//
// A type is offered only when it has a row and that row is enabled. This script
// inserts a DISABLED row for every registered module that has none, so a new
// type ships dark and waits for a human in admin Controls. It never deletes: a
// module removed from code leaves its row behind, because users may still have
// history against it.
//
// Run with `bun run sync:activities`. `bun run migrate` runs it after applying
// migrations. With `--check` it writes nothing and exits non-zero if a module
// has no row, which is what CI runs.
//
// Like scripts/migrate.ts this talks to the DIRECT endpoint and deliberately
// does not import src/lib/env.ts, so it can run before the auth secrets exist.

import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { registeredKeys } from "../src/domain";

const check = process.argv.includes("--check");

// v3 development targets the new APAC project. Falls back to the v1 pair so the
// script still works against the old database until the cutover.
const DATABASE_URL_DIRECT = process.env.DATABASE_URL_DIRECT;
if (!DATABASE_URL_DIRECT) {
  console.error("DATABASE_URL_DIRECT is not set. See .env.example.");
  process.exit(1);
}

let pool: PgPool;
if (process.env.LOCAL_MODE === "1") {
  pool = new PgPool({ connectionString: DATABASE_URL_DIRECT });
} else {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  pool = new NeonPool({ connectionString: DATABASE_URL_DIRECT }) as unknown as PgPool;
}

let failed = false;

try {
  const keys = registeredKeys().sort();

  const known = new Set(
    (await pool.query("SELECT DISTINCT type_key FROM activity_types")).rows.map(
      (r) => r.type_key as string,
    ),
  );

  const missing = keys.filter((k) => !known.has(k));

  if (check) {
    for (const key of missing) {
      console.error(`missing  ${key}  no row in activity_types`);
    }
    if (missing.length > 0) {
      console.error(
        `${missing.length} registered module(s) have no row. Run \`bun run migrate\`.`,
      );
      failed = true;
    } else {
      console.log(`activity_types in sync (${keys.length} module(s))`);
    }
  } else {
    for (const key of keys) {
      if (known.has(key)) {
        console.log(`skip  ${key}`);
        continue;
      }
      await pool.query(
        "INSERT INTO activity_types (type_key, enabled) VALUES ($1, false)",
        [key],
      );
      console.log(`add   ${key}  (disabled)`);
    }
    // Rows with no module are left alone on purpose, but say so: it is either a
    // removed type carrying history, or a key that got renamed by mistake.
    for (const key of known) {
      if (!keys.includes(key)) console.log(`orphan ${key}  row with no module`);
    }
    console.log("activity_types up to date");
  }
} finally {
  await pool.end();
}

if (failed) process.exit(1);
