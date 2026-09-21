// Does every query that takes a group AND a caller still check membership?
//
// THE BUG THIS EXISTS FOR shipped in v3.1: a group saw a member's whole back
// catalogue the moment they joined. Invariant 10 says membership is enforced in
// the query layer via one helper, on every query, and `break-in` proves the
// EXISTING routes refuse. Nothing proves the next one will.
//
// That is the gap this fills. `scripts/break-in/http.ts` sweeps a
// hand-maintained list of routes, so it catches a new leak exactly when
// somebody remembered to add the route to the list. This needs no memory.
//
// THE RULE IS NARROWER THAN "TAKES A groupId", and the narrowing is the whole
// design. `assertMember(groupId, userId)` needs a caller. A function taking a
// groupId and NO userId has nobody to check: `sharesAsOf(groupId, at)` and
// `fineRulesAsOf(groupId, at)` are config resolvers called by the scoring pass,
// which runs as nobody. Flagging those would mean allowlisting a dozen honest
// functions, and an allowlist a dozen long is a check nobody reads.
//
// So: BOTH a group and a caller, and no membership check, is the shape of the
// v3.1 leak.
//
// What counts as a check is also broader than one helper, because the codebase
// has three honest spellings: `assertMember`, `memberRole` (the predicate the
// helper is built on), and an inline query against `groupMembers`, which is
// the query layer doing it directly.
//
// v4 adds group-scoped reads for nudges and for Monk mode's share toggle, which
// is why this lands in Phase 0 rather than after them.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let failed = 0;

function check(what: string, ok: boolean, got?: string): void {
  if (ok) {
    console.log(`ok    ${what}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${what}${got === undefined ? "" : `\n      ${got}`}`);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}

/**
 * Functions that take a group and a caller and still do not check membership.
 * Every line needs a reason, and the reason is the point: adding one is a
 * deliberate act that goes through review, the way `check:deps` allowlist does.
 */
const ALLOWED: Record<string, string> = {
  assertMember: "it IS the helper",
  memberRole: "the predicate the helper is built on",
  archiveGroup: "admin only, guarded by requireCapability at the route",
  restoreGroup: "admin only, guarded by requireCapability at the route",
  getGroupInspector: "admin only, guarded by requireCapability at the route",
  setMoneyOverride: "admin only, guarded by requireCapability at the route",
  revokeTags: "a sweep over one member's own tags when they stop sharing",

  // THE ONE DISTINCTION THIS CHECK CANNOT SEE. In these three the userId is the
  // SUBJECT of the query, not the caller making it: `sharesFor(groupId,
  // m.userId)` deliberately reads another member's shares, on a screen that has
  // already checked the viewer. Their callers prove it —
  // `group-view.ts:172` and `settings/page.tsx:80` pass somebody else's id on
  // purpose, and `scoring.ts:601` passes one while running as nobody.
  //
  // A parameter called `subjectId` would let the check tell them apart by
  // itself. That rename is worth doing the next time any of these three is
  // opened for another reason, and is not worth a commit of its own.
  cleanRunIn: "userId is the subject; the viewer is checked at the route",
  sharesFor: "userId is the subject; the viewer is checked at the route",
  sharesAsOf: "the scoring pass, which runs as nobody",
};

// The three honest spellings of the same question.
const CHECKS = /assertMember|memberRole|requireOwner|requireCapability|groupMembers/;

const files = walk("src/server");
const offenders: string[] = [];
let scanned = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");

  const fns = [
    ...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gs),
    ...source.matchAll(
      /export\s+const\s+(\w+)\s*=\s*(?:cache\()?\s*(?:async\s*)?\(([^)]*)\)/gs,
    ),
  ];

  for (const m of fns) {
    const name = m[1];
    const params = m[2];

    // Both, or it is not the shape this is about. `changedBy` and `adminId`
    // are callers too: a writer is as much an identity as a reader.
    const hasGroup = /\bgroupId\b/.test(params);
    const hasCaller = /\b(userId|adminId|changedBy|memberId|actorId)\b/.test(params);
    if (!hasGroup || !hasCaller) continue;

    scanned += 1;
    if (ALLOWED[name]) continue;

    const from = m.index ?? 0;
    const nextExport = source.indexOf("\nexport ", from + 1);
    const body = source.slice(from, nextExport === -1 ? source.length : nextExport);
    if (!CHECKS.test(body)) {
      offenders.push(`${file.replace(/\\/g, "/")}  ${name}`);
    }
  }
}

check(
  `every query taking a group AND a caller checks membership (${scanned} scanned)`,
  offenders.length === 0,
  offenders.join("\n      "),
);

// An allowlist is only honest while every name on it still exists. A stale
// entry is a hole somebody opened and nobody closed.
const allSource = files.map((f) => readFileSync(f, "utf8")).join("\n");
const stale = Object.keys(ALLOWED).filter(
  (name) => !new RegExp(`\\b${name}\\b`).test(allSource),
);
check(
  "nothing on the allowlist has been renamed or deleted out from under it",
  stale.length === 0,
  stale.join(", "),
);

check(
  "the helper itself still exists",
  existsSync("src/server/membership.ts") &&
    readFileSync("src/server/membership.ts", "utf8").includes("assertMember"),
);

// And the scan has to have found something, or a refactor that renamed every
// parameter would turn this green by finding nothing at all. A check that
// cannot fail is worse than no check, because it is also a claim.
check(
  "the scan found group-scoped queries to look at",
  scanned >= 10,
  `only ${scanned}`,
);

console.log(
  failed === 0
    ? "\nok: invariant 10 holds in the query layer."
    : "\nA query takes a group and a caller and never asks whether they belong.",
);
process.exit(failed === 0 ? 0 : 1);
