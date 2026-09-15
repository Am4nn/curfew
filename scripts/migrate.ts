// Plain numbered-.sql migration runner. Applies migrations/*.sql in filename
// order over the DIRECT (non-pooled) Neon connection, tracking applied files in
// a _migrations table. Idempotent: an already-applied file is skipped.
//
// Run with `bun run migrate`. Reads DATABASE_URL_DIRECT from the environment (bun loads
// .env.local automatically). This script deliberately does NOT import
// src/lib/env.ts, so it can run before the auth secrets exist.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";

// Migrations run over the DIRECT (non-pooled) endpoint. One name, no fallbacks:
// the value differs per environment, .env.local points it at the APAC project.
const DATABASE_URL_DIRECT = process.env.DATABASE_URL_DIRECT;
if (!DATABASE_URL_DIRECT) {
  console.error("DATABASE_URL_DIRECT is not set. See .env.example.");
  process.exit(1);
}

// Say which database is about to be written to. Host and database only: the
// connection string carries a password and this output ends up in CI logs.
try {
  const u = new URL(DATABASE_URL_DIRECT);
  console.log(`target ${u.hostname}${u.pathname}`);
} catch {
  console.log("target (unparsable connection string)");
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// `--until 0025` stops after the first file whose name starts with that prefix.
//
// A release cannot apply every pending migration at one moment, because the
// version now serving is still the OLD one until the promote finishes. An
// additive migration is invisible to it and goes BEFORE the tag; a hostile one,
// a DROP or a new NOT NULL, removes something that version still uses and has
// to wait until AFTER. 0026 drops `activity_streaks.grace_spent`, which v3.1.1
// wrote on every streak upsert, so applying it with the other three would have
// broken streak writes for the length of the deploy.
//
// See `.planning/RELEASE.md`. Stopping AFTER the named file rather than before
// it, because "apply up to and including this one" is how a person reading a
// list of pending migrations decides where the line goes.
const untilArg = process.argv.indexOf("--until");
const until = untilArg === -1 ? null : process.argv[untilArg + 1];
if (untilArg !== -1 && !until) {
  console.error("--until needs a migration name or prefix, e.g. --until 0025");
  process.exit(1);
}

let planned = files;
if (until) {
  const stop = files.findIndex((f) => f.startsWith(until));
  if (stop === -1) {
    console.error(`--until ${until} matches no migration.`);
    process.exit(1);
  }
  planned = files.slice(0, stop + 1);
  const held = files.length - planned.length;
  console.log(`until ${files[stop]} (${held} later migration(s) held back)`);
}

// Preview runs against a local Postgres over node-postgres. Production/Neon
// uses the serverless Pool (which needs a global WebSocket). Both expose the
// same query/connect/end API.
// Both drivers expose the same query/connect/end API used below; type against
// node-postgres and cast the Neon pool to it.
let pool: PgPool;
if (process.env.LOCAL_MODE === "1") {
  pool = new PgPool({ connectionString: DATABASE_URL_DIRECT });
} else {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  pool = new NeonPool({ connectionString: DATABASE_URL_DIRECT }) as unknown as PgPool;
}

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await pool.query<{ name: string }>("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    ),
  );

  for (const file of planned) {
    if (applied.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`apply ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`failed ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  console.log("migrations up to date");
} finally {
  await pool.end();
}
