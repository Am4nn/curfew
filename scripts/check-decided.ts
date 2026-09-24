// Does the code still do what .planning/v4/DECIDED.md says it does?
//
// THE BUG THIS EXISTS FOR is not a bug in the app. On 2026-09-21 three settled
// decisions, 1.19, 1.20 and 3.1, were silently truncated out of DECIDED.md by
// an append that rewrote everything below "## 3. Open". Nothing went red. Every
// other file went on citing them by number, and the numbers still read as
// though they were there. They were recovered from git the same day.
//
// A decision record that can lose a decision without anything noticing is a
// record nobody should trust, and a decision nothing checks is a decision that
// drifts. So the mechanically checkable ones get an assertion here, each naming
// the decision it holds, and CI runs it on every push.
//
// It reads FILES and never a database, so it runs anywhere and costs nothing.
// What it cannot check is a judgement: whether Ren sounds right, whether a
// screen matches its board. Those are M3 and M4 in PLAN.md and they are a
// person's job.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let failed = 0;

function check(what: string, ok: boolean, got?: string): void {
  if (ok) {
    console.log(`ok    ${what}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${what}${got === undefined ? "" : `\n      got: ${got}`}`);
}

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** Every .ts and .tsx under a directory, so a new file cannot hide. */
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const DECIDED = read(".planning/v4/DECIDED.md");
const PLAN = read(".planning/v4/PLAN.md");
const SCHEMA = read(".planning/v4/SCHEMA.md");
const SRC = walk("src");

// ---------------------------------------------------------------------------
// The record itself. This half is what the lost decisions would have tripped.
// ---------------------------------------------------------------------------

check(
  "DECIDED.md exists and is the authority",
  DECIDED.length > 0,
  "missing",
);

// 1.1 to 1.32, with the lettered ones where they belong. A gap here means an
// append ate something, which is exactly what happened once.
const numbered = [...DECIDED.matchAll(/^### (\d+)\.(\d+)([a-z]?)/gm)].map((m) => ({
  section: Number(m[1]),
  n: Number(m[2]),
  suffix: m[3],
}));
// ONLY the unsuffixed ones count. 1.20a is a note ABOUT 1.20 and does not
// stand in for it: the first version of this check accepted it as one, and
// deleting 1.20 while 1.20a survived went straight through. Which is precisely
// the failure it was written for.
const settled = numbered.filter((d) => d.section === 1 && d.suffix === "").map((d) => d.n);
const gaps: number[] = [];
for (let i = 1; i <= Math.max(...settled); i += 1) {
  if (!settled.includes(i)) gaps.push(i);
}
check(
  "no numbered decision has gone missing from section 1",
  gaps.length === 0,
  gaps.length ? `1.${gaps.join(", 1.")} cited nowhere in the file` : undefined,
);

// Every decision number the other two files cite has to resolve. This is the
// cheap half of the same idea: a plan that references 1.33 is a plan written
// against a file somebody has since rewritten.
const cited = new Set<string>();
for (const text of [PLAN, SCHEMA]) {
  // The lookahead matters: these files are full of version numbers like 3.4.7,
  // and the "3.4" inside one of those is not a reference to decision 3.4.
  for (const m of text.matchAll(/\b(1\.\d+[a-z]?|3\.\d+)(?!\.?\d)/g)) cited.add(m[1]);
}
const present = new Set(numbered.map((d) => `${d.section}.${d.n}${d.suffix}`));
const dangling = [...cited].filter((c) => !present.has(c)).sort();
check(
  "every decision PLAN and SCHEMA cite actually exists",
  dangling.length === 0,
  dangling.join(", "),
);

// ---------------------------------------------------------------------------
// 1.21 — the model is somebody else's, and the provider comes from the
// environment. The one assertion here that is about a business decision rather
// than a shape: Aman pays for this out of pocket (1.17) and chose cheap
// providers, so an Anthropic SDK creeping in is a bill he did not agree to.
// ---------------------------------------------------------------------------

// CLAUDE.md is cited in comments across the tree and always will be, so the
// filename is not what this looks for. What it looks for is the PROVIDER: an
// import, a host, or a model id.
const PROVIDER = /@anthropic-ai|api\.anthropic\.com|["'`]claude-[a-z0-9-]+["'`]|new Anthropic/i;
const banned = SRC.filter((f) => PROVIDER.test(readFileSync(f, "utf8")));
check(
  "1.21  no Anthropic SDK, host or model id anywhere in src/",
  banned.length === 0,
  banned.join(", "),
);

const pkg = read("package.json");
check(
  "1.21  no model SDK is a dependency, because the seam is raw fetch",
  !/"@anthropic-ai\/|"openai"|"@google\/gen/.test(pkg),
);

const env = read("src/lib/env.ts");
check("1.21  COACH_PROVIDER is read from the environment", env.includes("COACH_PROVIDER"));
check("1.21  COACH_MODEL is read from the environment", env.includes("COACH_MODEL"));

// ---------------------------------------------------------------------------
// 1.26 — the cap and the ceiling are settings, not literals. A number in the
// source is a number nobody can change without a deploy.
// ---------------------------------------------------------------------------

check("1.26  COACH_DAILY_ASKS is read from the environment", env.includes("COACH_DAILY_ASKS"));
check(
  "1.26  COACH_MONTHLY_CEILING is read from the environment",
  env.includes("COACH_MONTHLY_CEILING"),
);

// 1.23 and PUSH_REMINDERS' rule: unset means off, so a new environment cannot
// quietly start spending.
check("1.23  COACH_ENABLED exists, and unset means off", env.includes("COACH_ENABLED"));

const example = read(".env.example");
const keys = [
  "COACH_ENABLED",
  "COACH_PROVIDER",
  "COACH_MODEL",
  "COACH_API_KEY",
  "COACH_DAILY_ASKS",
  "COACH_MONTHLY_CEILING",
];
const undocumented = keys.filter((k) => !example.includes(k));
check(
  "every COACH_ key is in .env.example, because a key in one file leaks from another",
  undocumented.length === 0,
  undocumented.join(", "),
);

// ---------------------------------------------------------------------------
// Phase 3 onward. These assert nothing until the phase lands, and then they
// assert for ever. Written now so the phase cannot close without them.
// ---------------------------------------------------------------------------

const scoring = read("src/server/scoring.ts");

if (scoring.includes("monkPassed")) {
  // 1.29 — the second verdict appears nowhere but Monk mode's own screen. This
  // is the one thing the chosen shape does not enforce structurally, so it is
  // enforced here.
  const ALLOWED = [
    "src\\db\\schema\\app.ts",
    "src\\server\\scoring.ts",
    "src\\server\\verify.ts",
    "src\\server\\monk.ts",
  ].map((p) => p.replace(/\\/g, "/"));
  const leaked = SRC.filter(
    (f) => readFileSync(f, "utf8").includes("monkPassed"),
  )
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !ALLOWED.some((a) => f.endsWith(a.split("src/")[1])) && !/monk/i.test(f));
  check(
    "1.29  monkPassed has not leaked out of the four files allowed to read it",
    leaked.length === 0,
    leaked.join(", "),
  );

  // 1.16 — no streak, no pass, no fine. The money path must never see it.
  const outcomeBlock = scoring.slice(
    scoring.indexOf("recomputeGroups"),
    scoring.indexOf("settleFines"),
  );
  check(
    "1.16  the group outcome pass does not read the monk verdict",
    !outcomeBlock.includes("monkPassed"),
  );
} else {
  console.log("skip  1.29  monkPassed does not exist yet (Phase 3)");
}

const consent = read("src/server/consent.ts");
if (consent.includes("CONSENT_VERSION")) {
  const m = consent.match(/CONSENT_VERSION\s*=\s*(\d+)/);
  const version = m ? Number(m[1]) : 0;
  // 1.30 — one tag, and all three members re-accept. Bumping the version is
  // the only thing that puts the gate in front of them.
  // Phase 7 bumps this, and it is what puts the gate in front of all three
  // members. Asserting it before the gate's own copy exists would be red for
  // the whole of Phases 0 to 6, and a check that is red on purpose is a check
  // everybody learns to scroll past.
  const gateRewritten = consent.includes("REN, THE COACH") || consent.includes("Ren reads");
  if (gateRewritten) {
    check(
      "1.30  CONSENT_VERSION is 2, which is what makes all three re-accept",
      version === 2,
      String(version),
    );
  } else {
    console.log("skip  1.30  the gate has not been rewritten yet (Phase 7)");
  }
}

// 3.1 and 1.19 — the five types, and the category that Monk mode's required
// kinds read.
//
// The keys come OUT OF 3.1's table rather than out of this file. The first
// version held three of its own invention (nojunkfood, noalcohol, nosocial),
// which had never been agreed anywhere and would have passed against whatever
// the modules happened to be called.
// Comments stripped, because "// register(socialfreeActivity);" satisfied the
// first version of this: it asked whether the KEY appeared in the file, and an
// import line carries it whether or not anything registers it. Proved by
// commenting one out and watching the check stay green.
const index = read("src/domain/index.ts").replace(/^\s*\/\/.*$/gm, "");
const FIVE = [...DECIDED.matchAll(/^\| [A-Z][^|]*\| `([a-z]+)` \| [A-Z]+ \|$/gm)].map(
  (m) => m[1],
);
check("3.1  names five types, with a key each", FIVE.length === 5, FIVE.join(", "));
const registered = (k: string) => index.includes(`register(${k}Activity)`);
if (FIVE.length > 0 && FIVE.some(registered)) {
  const missing = FIVE.filter((k) => !registered(k));
  check("3.1  all five new types are registered", missing.length === 0, missing.join(", "));
  check(
    "1.16  ActivityType carries a category, which the required kinds read",
    read("src/domain/types.ts").includes("category?: Category"),
  );
  // 1.16 needs a BODY, a FOOD, a MIND and a SLEEP to exist at all. The domain
  // test asserts every registered type has one; this asserts the four are
  // reachable, which is what makes Monk mode buildable.
  const modules = walk("src/domain")
    .map((p) => readFileSync(p, "utf8"))
    .join(" ");
  const declared = new Set(
    [...modules.matchAll(/category: "([a-z]+)"/g)].map((m) => m[1]),
  );
  for (const kind of ["body", "food", "mind", "sleep"]) {
    check(`1.16  a ${kind.toUpperCase()} type exists`, declared.has(kind));
  }
  // The answers a declare module names are rendered, never read. Hardcoding
  // them back into the engine is the drift this catches.
  check(
    "3.1  the engine draws a declare type's own two answers",
    !read("src/app/activity-row.tsx").includes('label="It held"'),
  );
} else {
  console.log("skip  3.1  the five new types do not exist yet (Phase 1)");
}

// 1.49 — an activity declares which number it carries, and every surface draws
// that. The failure this catches is a SURFACE deciding for itself: a Home row
// that branches on a type key, or a group hub that always draws a flame.
//
// The exact split lives in registry.test.ts, which can run the modules. This
// half is the part a test cannot see, that no surface has its own opinion.
if (read("src/domain/types.ts").includes("measure: Measure")) {
  const SURFACES = [
    "src/server/today.ts",
    "src/server/group-view.ts",
    "src/server/stats.ts",
    "src/server/stop-cost.ts",
  ];
  const branching = SURFACES.filter((f) => {
    const text = read(f);
    return /typeKey === "|key === "(sleep|gym|food|water|screen|nightfast|sugarfree)"/.test(text);
  });
  check(
    "1.49  no surface decides which number to draw by looking at a type key",
    branching.length === 0,
    branching.join(", "),
  );
} else {
  console.log("skip  1.49  measure does not exist yet (Phase 2)");
}

// 1.19 — a condition somebody writes themselves has NO category, because
// nothing can know whether "no doomscroll" is a MIND thing, and Monk mode's
// four requirements exist so the number means the same for everybody.
//
// The registry test asserts the exact list of uncategorised types. This is the
// other half: the template is registered, so an admin can switch the whole
// feature off in one place, and the catalog leaves it out because it is the
// shape of a thing to track rather than one.
if (existsSync("src/domain/condition/index.ts")) {
  const condition = read("src/domain/condition/index.ts");
  check(
    "1.19  the condition template declares no category",
    !/^\s*category:/m.test(condition),
  );
  check("1.19  it is registered, so the admin switch reaches it", registered("condition"));
  check(
    "1.19  the catalog leaves the template out",
    read("src/server/activities.ts").includes('key !== "condition"'),
  );
} else {
  console.log("skip  1.19  member-written conditions do not exist yet (Phase 1)");
}

// 1.23 — the coach is its own schedule, and a job that breaks says so.
const jobs = read("scripts/schedule-jobs.ts");
if (jobs.includes("/api/cron/coach")) {
  check("1.23  the coach job is declared in JOBS", jobs.includes("/api/cron/coach"));
  check(
    "1.23  every schedule still names a failure callback",
    jobs.includes("Upstash-Failure-Callback"),
  );
} else {
  console.log("skip  1.23  the coach job does not exist yet (Phase 5)");
}

// ---------------------------------------------------------------------------

console.log(
  failed === 0
    ? "\nok: the code still says what DECIDED.md says."
    : `\n${failed} decision(s) the code no longer honours.`,
);
process.exit(failed === 0 ? 0 : 1);
