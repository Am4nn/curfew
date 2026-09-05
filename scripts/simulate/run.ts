// Run every scenario against the real engine, assert, and write the report.
//
//   bun run simulate            all of them
//   bun run simulate -- --only=money   just the ones whose id contains "money"
//
// Local only, and it TRUNCATES between scenarios, so it is not something to
// point at a database anyone cares about. Exits non-zero if any assertion
// fails, which is what makes this a regression rather than a demo.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import { SCENARIOS } from "./scenarios";
import {
  headlines,
  rankLadders,
  partialShareLadder,
  missCosts,
  holdRates,
  perfectClimb,
} from "./analysis";
import { render, type ScenarioResult } from "./report";
import { runLive, type LiveResult } from "./live";
import { verifyAll } from "@/server/verify";
import { wipe, TZ, TODAY } from "./world";
import { setClock } from "@/lib/clock";

if (process.env.LOCAL_MODE !== "1") {
  console.error("Refusing to simulate: LOCAL_MODE is not 1. This wipes the database it runs against.");
  process.exit(1);
}

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const chosen = only
  ? SCENARIOS.filter((s) => s.id.includes(only) || s.group.toLowerCase().includes(only.toLowerCase()))
  : SCENARIOS;

if (chosen.length === 0) {
  console.error(`No scenario matches "${only}".`);
  process.exit(1);
}

// The live pass is slow, because it lives every day rather than seeding it.
// --live=0 skips it; --live=N lives N days.
const liveArg = process.argv.find((a) => a.startsWith("--live="))?.split("=")[1];
const liveDays = liveArg === undefined ? 180 : Number(liveArg);

// Pin the clock to the day the scenarios are written against.
//
// `TODAY` is a constant so the report reads the same every run, but the ENGINE
// reads the real clock, and the two only agreed on the day this was written.
// The moment the real date moved past it, every scenario logged its last
// check-in on what the engine considered the day before yesterday, so a
// spotless record acquired a missed day and spent grace on it. Four scenarios
// went red for a fixture reason, which is exactly the failure this suite is
// supposed to make impossible.
//
// Local only, gated the same way the mock-clock cookie is, and released before
// the live pass takes it over.
setClock(TODAY.set({ hour: 12 }).toJSDate());

const results: ScenarioResult[] = [];

for (const scenario of chosen) {
  const started = Date.now();
  process.stdout.write(`${scenario.id.padEnd(28)} `);
  try {
    const { checks, notes, series } = await scenario.run();

    // Every scenario also has to leave the engine self-consistent. A stored row
    // that a replay disagrees with is a failure of the scenario even when its
    // own assertions pass.
    const drift = await verifyAll({});
    const all = [
      ...checks,
      {
        what: "the stored rows agree with a full replay from events",
        got: drift.length === 0 ? "no drift" : `${drift.length} rows`,
        want: "no drift",
        ok: drift.length === 0,
        kind: "property" as const,
      },
    ];

    const failed = all.filter((c) => !c.ok).length;
    console.log(failed === 0 ? "ok" : `${failed} FAILED`);
    if (failed > 0) {
      for (const c of all.filter((x) => !x.ok)) {
        console.log(`    ${c.what}: got ${JSON.stringify(c.got)}, wanted ${JSON.stringify(c.want)}`);
      }
    }
    if (drift.length > 0) {
      for (const d of drift.slice(0, 5)) {
        console.log(`    drift ${d.kind} ${d.key} ${d.field}: stored=${d.stored} computed=${d.computed}`);
      }
    }

    results.push({
      id: scenario.id,
      group: scenario.group,
      title: scenario.title,
      question: scenario.question,
      checks: all,
      notes,
      series,
      ms: Date.now() - started,
    });
  } catch (error) {
    console.log("ERROR");
    console.log(`    ${error instanceof Error ? error.message : String(error)}`);
    results.push({
      id: scenario.id,
      group: scenario.group,
      title: scenario.title,
      question: scenario.question,
      checks: [],
      notes: [],
      ms: Date.now() - started,
      error: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
    });
  }
}

// The live pass drives the clock itself, a day at a time, so hand it back.
setClock(null);

let live: LiveResult[] = [];
if (liveDays > 0 && !only) {
  process.stdout.write(`
living ${liveDays} days through the real check-in path `);
  live = await runLive(liveDays, "steps", (i) => {
    if (i % 30 === 0) process.stdout.write(".");
  });
  console.log(" done");
  for (const r of live) {
    console.log(
      `  ${r.persona.padEnd(18)} passed ${String(r.daysPassed).padStart(3)}/${String(r.daysScored).padEnd(3)} streak ${String(r.streak).padStart(3)}  ${String(r.score).padStart(3)} ${r.rank}`,
    );
  }
}

// Leave the database empty rather than holding the last scenario's world, so
// nothing downstream mistakes a scenario for a fixture.
await wipe();

const out = path.join(".sim", "index.html");
await mkdir(".sim", { recursive: true });
await writeFile(
  out,
  render({
    ran: `${chosen.length} scenarios, run ${DateTime.now().setZone(TZ).toFormat("d LLL yyyy, h:mm a")}`,
    results,
    headlines: headlines(),
    ladders: rankLadders(),
    partial: partialShareLadder(6),
    costs: missCosts(),
    holds: holdRates(),
    climb: perfectClimb(900),
    live,
    liveDays,
  }),
  "utf8",
);

const failed = results.reduce(
  (s, r) => s + r.checks.filter((c) => !c.ok).length + (r.error ? 1 : 0),
  0,
);
const total = results.reduce((s, r) => s + r.checks.length, 0);

console.log(`\n${results.length} scenarios, ${total} assertions, ${failed} failed`);
console.log(`Report: ${path.resolve(out)}`);
process.exit(failed === 0 ? 0 : 1);
