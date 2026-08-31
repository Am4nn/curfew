// Plain numbered-.sql migration runner. Applies migrations/*.sql in filename
// order over the DIRECT (non-pooled) Neon connection, tracking applied files in
// a _migrations table. Idempotent: an already-applied file is skipped.
//
// Run with `bun run migrate`. Reads DIRECT_URL from the environment (bun loads
// .env.local automatically). This script deliberately does NOT import
// src/lib/env.ts, so it can run before the auth secrets exist.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Bun and Node 22 expose a global WebSocket; the Neon Pool needs it.
neonConfig.webSocketConstructor = globalThis.WebSocket;

// Migrations run over the DIRECT (non-pooled) endpoint. Accept DIRECT_URL, or
// fall back to DATABASE_URL (Neon's own export names the direct string that).
const DIRECT_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!DIRECT_URL) {
  console.error("DIRECT_URL / DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const pool = new Pool({ connectionString: DIRECT_URL });

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
