# PLAN.md — Build order for v4

Eight phases. Each ends with something that works and something you can look at,
and no phase is done until its tests are green, its `SCREENS.md` rows are ticked
and its decisions have been re-read.

Read `DECIDED.md` for what and why, `SCHEMA.md` for the tables, and this file
only for the order. Every decision referenced here by number lives there.

The canvas is https://claude.ai/artifact/V5Q54R7heSttj1aXT5PVqP, 41 boards,
approved 2026-09-21. Sources in `.design/v5/`.

**v4 ships as one tag (1.30).** Not phased over two releases, not with the coach
dark behind the admin switch. The phases below are a build order, not a release
order.

---

## Why this order

3.2 settles it: **the engine first and the coach last.**

The instinct is to answer the riskiest thing first, and it is wrong here. Ren
reads a digest built from outcomes, streaks and group shares (1.22), and 1.19
changes what an activity list even is. Build him first and you build him twice.

**The design is not a phase.** v3 built screens phase by phase against
`SCREENS.md` because the screens were new. Here the routes exist and the look
changes, so the redesign rides inside each phase. A phase that is only "make it
look right" is the phase that gets cut when time is short.

**The one hard constraint:** Monk mode aggregates the new types (1.16) and the
grouped row groups them (1.19), so types come first. Phase 1 types, Phase 2 the
row, Phase 3 Monk mode, and nothing about the coach until Phase 5.

---

## How this does not drift (1.32)

Four mechanisms, all four chosen, each catching what the others cannot.

**M1 — checks that fail CI.** House shape is `scripts/check-money.ts`: a
`check(what, ok, got)` helper, a counter, `process.exit(failed === 0 ? 0 : 1)`,
and a header naming the bug it exists for.

- **`check:decided`** — every mechanically checkable decision. The five types
  registered with categories (3.1); no member-written condition has a category
  (1.19); **no `anthropic` or `claude` string anywhere in `src/`** (1.21); the
  coach job declared with its failure callback (1.23); the cap and the ceiling
  read from env, never hardcoded (1.26); `monkPassed` in exactly five files
  (1.29); `CONSENT_VERSION === 2` (1.30).
- **`check:monk`** — seven assertions, listed in Phase 3.
- **`check:member`** — invariant 10. Any exported function in `src/server/`
  taking a `groupId` calls `assertMember` or sits on a named allowlist with a
  reason. Crude, and it is the shape of the one leak this app has shipped.
- **`check:coach`** — no digit in a line that is not in its digest (1.24).

**M2 — every commit names its decision.** A phase commit cites the numbers it
implements; `DECIDED.md` gains a **Built in** column. A convention, so it holds
only while somebody remembers, which is why M1 exists.

**M3 — `.planning/v4/SCREENS.md`.** All 41 boards, ticked by a person who opened
the screen beside the board, in the same commit. **A phase cannot close with an
unticked row it touched.** v3's file was never ticked once. No screenshot
tooling: a reference capture is a capture of what was built, so it locks in
drift rather than preventing it.

**M4 — a phase closes by re-reading its decisions.** Walk that phase's entries
in `DECIDED.md` line by line against what was built and write down what differs,
in the closing commit. About an hour, and it catches interpretation drift no
assertion can.

---

## Phase 0 — Ground

- **Correct the planning files first.** `SCHEMA.md` priced the monk bar against
  a foreign key deleted in `migrations/0012_group_model.sql:72`, and put
  `category` on an append-only history table. Both corrected 2026-09-21; the
  reasoning is preserved in `SCHEMA.md`'s opening section and in 1.16.
- `CLAUDE.md`: current phase becomes v4, the Voice section is replaced by
  `DECIDED.md` as 1.1 promised, "Not in v3" replaced by v4's own.
- Retire v3's screen gate to `.planning/v3/SCREENS-retired.md`; generate the
  v4 one from `canvas.json` (M3).
- New env keys in all three `.env` files, `.env.example` and Vercel per
  environment: `COACH_PROVIDER`, `COACH_MODEL`, `COACH_API_KEY`,
  `COACH_MONTHLY_CEILING`, `COACH_DAILY_ASKS`, `COACH_ENABLED`. **A key missing
  from one file does not fall back to a default, it leaks in from `.env.local`**,
  and that has cost an afternoon before.
- `check:decided` and `check:member` exist and pass.

**Done when:** CI is green on a branch that changed no behaviour, and dev is
*proven* unable to call a paid provider: hit the route with a valid `CRON_SECRET`
and read `{ ok: true, skipped: "disabled" }` back, the way 3.3 proved the
reminder tick rather than assuming it.

## Phase 1 — The five new types (3.1)

Five files in `src/domain/`, each about nineteen lines calling
`abstinenceActivity({...})`, plus `register()` in `src/domain/index.ts` and an
icon path in `src/app/activity-icon.tsx` — **a missing icon name renders
nothing**, silently.

`category?: "body" | "food" | "mind" | "sleep"` on `ActivityType` in
`src/domain/types.ts`. Backfill the twelve. **It is a field in code and not a
column** (see `SCHEMA.md`). Member-written conditions get a `user_conditions`
row and no category (1.19).

**Three test files hard-code the type list and are updated by hand, never
derived** — that is their job, and they are a tripwire rather than a chore:
`catalog.test.ts:29` (`toHaveLength(12)`), `configure.test.ts:12-43` (a label
per type, in order), `checkin.test.ts:38-62` (which types repeat).

**Done when:** seventeen types in the catalog, a member-written one can be
created and checked in, `check:offer` passes for every new type, and `simulate`
runs a week with all five and reports no drift.

## Phase 2 — The grouped row (1.19)

Home draws every held-or-slipped type under one expandable row,
`Simple ones, 3 of 5`. **Presentation only**: no new event, no new score,
nothing stored. Each keeps its own streak, window and sharing toggle. Catalog,
Activities, Sharing and You list them the same way.

**Done when:** five types occupy one row, opening it shows five streaks, and
turning one off removes it from the group without touching the other four.

## Phase 3 — Monk mode (1.16, 1.29)

- `monk_sets`, effective-dated and insert-only. Invariant 4 applied to a view:
  add Cold shower today and it counts from tomorrow.
- `src/server/monk.ts`, the read layer and **the only file that reads
  `monkPassed`**. Passed over scheduled. **0 of 0 returns null, never 0.**
- `monkBar?(config): Config` on `ActivityType`. Water, Screen and Sleep
  implement it and nothing else does. The module returns **the stricter of the
  member's own setting and the bar**, so somebody already drinking twelve is not
  handed ten. Invariant 6 survives: the engine never learns the field is called
  `glasses`.
- **A monotonicity property test lands in `registry.test.ts` BEFORE anything
  writes the column.** `evaluate(monkBar(c)).passed` implies `evaluate(c).passed`,
  and `configSchema.parse(monkBar(c))` does not throw. The second half is not
  decoration: `split()` at `scoring.ts:150-156` hands config to `evaluate`
  **unparsed**, so a monk config its own schema would reject reaches `evaluate`
  and can throw mid-score, taking `scoreUser` down for that member.
- **Three edits to `scoring.ts` and nothing else.** `ScoreRow` at `:193-203`
  gains `monkPassed: boolean | null`; a guarded second `evaluate` after `:380-388`
  reusing the already-resolved config, which satisfies invariant 5 for free; and
  `monkPassed` in the upsert `set` block at `:855-866`. **`:647-653` and
  `:670-679` are not touched, and that is the whole point of the shape.**
- Four lines in `verify.ts:68-108`, the same shape as `settling` and `paused`.
- Compulsory: Sleep, No junk food, Screen, Steps. Four required categories. If
  one is uncovered, **Monk mode does not appear at all** (`MonkLocked`).
- A share toggle per group (1.29). No camera switch: there is no photograph.
- **No backfill.** Rows stay NULL until the nightly full replay fills them
  within a night; the hourly resume only rescans from `dayFrom - 7`
  (`scoring.ts:292`). Say so on screen, or press Rebuild in Ops once.

`check:monk` asserts: no duplicate row; `monk_passed ⇒ passed` over every stored
row; coverage is NULL exactly where `monkBar` is undefined; **money and streaks
untouched** when a bar is swapped for something absurd; `monkPassed` occurs only
in the five allowed files; the set is effective-dated; 0 of 0 is null.

**Done when:** those seven pass, `verify` diffs `monkPassed` over a seeded month
with no drift, a day with nothing scheduled shows a dash, and removing a
required activity makes Monk mode disappear rather than degrade.

## Phase 4 — Nudges (1.5, 1.13, 1.27)

At-risk on Home: window open, closing soon, nothing logged. **Per activity,
never per person.** Four set messages stored by `message_key`, the words in code
beside `notification-copy.ts` so they go through review — *Don't break it*,
*You've got time*, *Mine's done*, *Come on*, which are the streak, the window,
the example and the shove.

**Push AND the card on Home.** Push is best-effort and permission can be off;
the card always lands. **The window is the rate limit**: no counter, no claim
row. Quiet hours still win. One switch to refuse, and nobody is told (1.13).

**Done when:** a seeded at-risk member can be nudged, the target sees both, the
card clears when the activity is done, and a nudge outside an open window is
impossible.

## Phase 5 — The coach, against a stub

Everything about Ren except the call, so the model is the last variable rather
than the first.

- `src/server/coach/digest.ts` — the structured summary, and **which
  photographs matter** (1.22). Pure, testable, no network.
- `src/server/coach/provider.ts` — one interface, `COACH_PROVIDER` picks the
  implementation (1.21). **A stub provider ships here and stays for ever**,
  because no test should need a network.
- `/api/cron/coach`, its own QStash schedule, `0 4 * * *`, declared in `JOBS`
  with the forwarded secret and the failure callback, plus a slot claim
  (`events_one_coach_run_idx`). Its heartbeat joins `HEARTBEATS` in
  `src/server/ops.ts` so `schedulerHealth()` reports four jobs.
- `coach_lines`, `coach_memory`, `coach_calls`.
- Every screen that carries a line: Home, After a miss, Your record, the day is
  done, and his tab (1.4a). **One line per screen, never two** — that is the
  half of 1.4a which survives 1.28's reversal.
- **Copy `notification-copy.ts`'s three-layer pattern**, which is the best
  machinery in this repo: the writer is handed an opaque pre-written string and
  denied the raw numbers, so the bad sentence is *unwritable*; a
  forbidden-substring list crossed with every writer and forty seeds, plus a
  positive assertion that the opaque string survives verbatim; and the same list
  re-applied in the simulator over composed output.
- `bun run sim:coach` — a week of his lines, printed, no database, no network.

**Done when:** the coach works end to end against the stub, the nightly job
writes lines, `schedulerHealth()` shows four jobs, and no test needs a network.

## Phase 6 — The model (1.21, 1.25, 1.26)

Gemini Flash behind the seam taking the digest and the photographs; DeepSeek
behind the same seam for Ask Ren, text only. The rolling summary rewritten
nightly, with read, edit and clear (1.25). The daily cap, and the ceiling that
switches Ask Ren off while the nightly lines carry on. Ren off is a real off
(1.14).

**The failure path proved rather than assumed** (1.23): make a real call fail
and watch retries, DLQ, the empty state and the guarded recompute — the way
3.4.7's failure callback was proved on dev, rather than by writing a fake
failure row into an append-only table.

**Done when:** a real night produces real lines, unplugging the provider
produces the empty state and a working retry, and dropping the ceiling to zero
in Vercel stops Ask Ren and nothing else.

## Phase 7 — The gate, and the rest of the surface

`CONSENT` and `TERMS` gain Ren, **the sentence saying the photographs leave to a
third party**, and the rolling summary in WHAT IS RECORDED and DELETING.
`CONSENT_VERSION` → 2, which is what makes all three re-accept. The accept
button waits for the end (1.8i). First run, deterministic and unskippable,
carrying the refusal (1.15). You: profile and settings on one page, from the
avatar on Home (1.8e). Splash, sign-in, the mark.

**Done when:** a new account can be created, gated, tutored and land on a Home
that works, and all three members have re-accepted.

## Phase 8 — Before it ships

`break-in` extended: the coach routes, the recompute guard, the nudge path, and
**a member-written condition as an injection surface**. New routes go into
`http.ts`'s `routes()` and `apiRoutes()` **by hand** — the cron sweep is a
hand-written list on purpose, because forgetting one looks like nothing.
`sim:push` extended to nudges. Read a real night of lines and a real day of
nudges word for word, the way `check:push` is read the morning after a release.
`.planning/RELEASE.md` gains the fourth schedule, the new env keys and
`CONSENT_VERSION`.

**Done when:** every check green on one SHA, every `SCREENS.md` row ticked, and
a person has used it on a phone for a day.

---

## Migrations

| | | Phase |
|---|---|---|
| 0033 | `user_conditions` | 1 |
| 0034 | `monk_sets` | 3 |
| 0035 | `activity_scores.monk_passed` | 3 |
| 0036 | `nudges`, `notification_settings.nudges_enabled` | 4 |
| 0037 | `coach_lines`, `coach_memory`, `coach_calls` | 5 |
| 0038 | `events_one_coach_run_idx` | 5 |

**All additive, and v4 has no hostile migration.** Every one goes before the
tag. `category` is not a migration and `CONSENT_VERSION` is not a migration.

## Order notes

- **Phase 1 before 2 and 3.** Both read the types; Monk reads the category the
  field adds.
- **Phase 4 can overlap Phase 3.** Nudges touch groups and windows, Monk touches
  scoring. They meet nowhere.
- **Phase 5 before Phase 6, and the gap is the point.** Building the whole coach
  against a stub means the day the provider arrives, the only new thing is the
  provider. The other way round, every bug is the prompt, the digest, the
  schedule or the provider, with no way to tell which.
- **Phase 7 can start once Phase 5 is done**, because the gate's copy depends on
  what the coach does rather than on which model does it.
- **Phase 8 cannot start until everything else is finished**, and it is not the
  phase to compress.

## Known costs, accepted before starting

**Changing a monk bar later rewrites history.** `monk_passed` is a pure function
of code and `activity_scores` has no per-module logic version. Moving Water's
bar from 10 to 11 makes `verify` report every historical row as drift and the
nightly replay rewrite them. Not new — `passed` already behaves this way when a
module's `evaluate` changes — but a bar is a number somebody will be tempted to
tune, so the warning goes in the `monkBar` doc comment.

**A member whose types all lack a bar** gets a monk percentage identical to a
plain pass rate. Correct and intended under 1.29's NULL rule, and the screen
must not imply otherwise.

**`settleFines` is still O(lifetime) per run** and hourly scoring multiplies it
by 24. Free at three members and fifteen uncharged rows. It is the first thing
that will hurt, and bounding it is its own change with its own correctness
argument about late settlement. Not in v4.

**3.3 is still open.** 1.24 banned one thing, that no number may be invented,
and dated the rest. Revisit before anybody outside the three uses Curfew.
