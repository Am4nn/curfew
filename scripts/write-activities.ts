// `.planning/v4/ACTIVITIES.md`, written from the registry.
//
// WHY THIS IS GENERATED. Everything in it is already declared on a module, so a
// hand-written table would be a second copy of eighteen facts that change one
// at a time. `.planning/v4/SCREENS.md` is generated for the same reason and by
// the same argument.
//
// It answers the question a person actually has: what does each activity do,
// which number does it carry (1.49), does it want a photograph, and when does
// it ask. That question is currently answered by reading eighteen files.
//
// Run: bun run doc:activities
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import {
  getActivityType,
  registeredKeys,
  measureOf,
  periodUnit,
} from "../src/domain";

const OUT = ".planning/v4/ACTIVITIES.md";

/** "Daily", "Weekdays", "Any 3 a week". */
function howOften(key: string): string {
  const s = getActivityType(key).defaults.schedule;
  if (s.kind === "minimum") return `Any ${s.perWeek} a week`;
  if (s.days.length === 7) return "Daily";
  if (s.days.length === 5 && s.days.every((d) => d <= 5)) return "Weekdays";
  return `${s.days.length} days a week`;
}

/**
 * How often a failed period can cost money.
 *
 * `periodUnit` takes a Schedule and not a ScheduleConfig. The first version of
 * this passed the wrapper, so every kind check fell through and Gym printed as
 * fined daily when its period is a week. Found by reading the table, which is
 * why it gets printed rather than trusted.
 */
function finedEvery(key: string): string {
  return periodUnit(getActivityType(key).defaults.schedule) === "week"
    ? "a week"
    : "a day";
}

function evidenceOf(key: string): string {
  const e = getActivityType(key).evidence;
  if (e.level === "none") return "none";
  const steps = e.steps?.length ? ` on ${e.steps.join(", ")}` : "";
  return `${e.level}, ${e.source}${steps}`;
}

function cueOf(key: string): string {
  const cues = getActivityType(key).reminderCues;
  return cues && cues.length > 0 ? cues.join(", ") : "from the window";
}

const keys = registeredKeys().sort((a, b) => {
  const at = getActivityType(a);
  const bt = getActivityType(b);
  const am = at.measureFor ? "either" : measureOf(at, at.defaults.config);
  const bm = bt.measureFor ? "either" : measureOf(bt, bt.defaults.config);
  if (am !== bm) return am === "consistency" ? -1 : am === "either" ? 1 : bm === "either" ? -1 : 1;
  return a.localeCompare(b);
});

const out: string[] = [];
out.push("# The activities, as the modules declare them\n");
out.push("**Generated. Do not edit.** `bun run doc:activities` rewrites it from\n");
out.push("`src/domain/`, so it cannot drift from what the app actually does.\n\n");
out.push("Every column here is a field on `ActivityType`. If a row looks wrong, the\n");
out.push("module is wrong.\n\n");

out.push("## What the columns mean\n\n");
out.push("- **Carries** is 1.49: the one number this activity shows, on every surface.\n");
out.push("  `consistency` for something you DO, where a consecutive count is an\n");
out.push("  artifact. `streak` for an abstinence, where it is the achievement.\n");
out.push("  **A `consistency` type shows no streak anywhere**, including to a group.\n");
out.push("- **Press** is `checkin.kind`, which is what the button opens.\n");
out.push("- **Cue** is C6: when you do it, which is also when Curfew asks and what\n");
out.push("  the consistency measure reads a press against. `from the window` means\n");
out.push("  the module declares none and the engine works backwards.\n");
out.push("- **Fined** is how often a failed period can cost money. It is the\n");
out.push("  activity's PERIOD, not a setting: a group sets the amount, and the\n");
out.push("  module decides what a period is. Gym is the only weekly one.\n\n");

out.push("## The eighteen\n\n");
out.push("| Activity | Carries | Kind | How often | Fined | Press | Photo | Cue |\n");
out.push("|---|---|---|---|---|---|---|---|\n");
for (const key of keys) {
  const t = getActivityType(key);
  // The condition template has no single answer: `measureFor` reads C7's
  // do-or-avoid, so one written condition carries a percentage and the next
  // carries a flame. Saying "streak" here would be stating one of two.
  const measure = t.measureFor ? "either, see C7" : measureOf(t, t.defaults.config);
  out.push(
    `| **${t.name}** \`${key}\` | ${measure} | ${t.category ?? "none"} | ` +
      `${howOften(key)} | ${finedEvery(key)} | ${t.checkin.kind} | ` +
      `${evidenceOf(key)} | ${cueOf(key)} |\n`,
  );
}

out.push("\n## The rule each one enforces\n\n");
out.push("From `summary(config)` at the module's own defaults, which is the sentence\n");
out.push("the configure screen puts above the controls.\n\n");
for (const key of keys) {
  const t = getActivityType(key);
  out.push(`- **${t.name}**: ${t.summary(t.defaults.config)}\n`);
}

out.push("\n## What is the same for all of them\n\n");
out.push("- **A fine is one failed period**, and `fineFor` reads consecutive failed\n");
out.push("  periods. It never reads a streak, which is why 1.49 changes no money.\n");
out.push("- **A group sets the amount**, per group, and can set it to nothing.\n");
out.push("- **Settling and away days apply to every type**, because both move\n");
out.push("  reputation and fines and neither touches a counter (1.44, 1.50).\n");
out.push("- **Repair and grey apply only where a streak is carried** (1.50). Both are\n");
out.push("  properties OF a streak, so they need no rule naming types.\n");
out.push("- **Nothing outside a module knows what a type means** (invariant 6). Every\n");
out.push("  column above is read through the registry, never by a `switch` on a key.\n");

const text = out.join("");

// `--check` is what CI runs. A generated file that nothing regenerates goes
// stale silently, and this one describes eighteen modules that change one at a
// time, so the first reader of a wrong row would be somebody trusting it.
// Same argument as check:shards: a check that cannot fail is not a check.
if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.log(
      `FAIL  ${OUT} is out of date. Run: bun run doc:activities`,
    );
    process.exit(1);
  }
  console.log(`ok    ${OUT} matches the registry (${keys.length} activities)`);
} else {
  writeFileSync(OUT, text);
  console.log(`${OUT}: ${keys.length} activities`);
}
