import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The domain core is pure. Nothing under src/domain may reach into the DB layer
// (invariant: events are the source of truth, and scoring is testable without a
// database). This test fails if any file here imports @/db, drizzle, or the
// Neon client.
const domainDir = dirname(fileURLToPath(import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    // Source files only. Test files legitimately name the DB layer (this one
    // does, in its own patterns).
    if (name.endsWith(".test.ts")) return [];
    return name.endsWith(".ts") ? [full] : [];
  });
}

const forbidden = [/@\/db/, /drizzle-orm/, /@neondatabase/, /@\/lib\/auth/];

describe("domain isolation", () => {
  it("no file under src/domain imports the database layer", () => {
    const offenders: string[] = [];
    for (const file of tsFiles(domainDir)) {
      const src = readFileSync(file, "utf8");
      if (forbidden.some((re) => re.test(src))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
