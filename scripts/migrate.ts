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
    (await pool.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
  );

  for (const file of files) {
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
