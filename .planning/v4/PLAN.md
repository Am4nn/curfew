# PLAN.md — Build order for v4

Eight phases. Each one ends with something that works and something you can
look at, and no phase is done until its tests are green and its boards have
been opened beside the running screen.

Read `DECIDED.md` for what and why, and this file only for the order. Every
decision referenced here by number lives there. `SCHEMA.md` is the tables.

The canvas is https://claude.ai/artifact/V5Q54R7heSttj1aXT5PVqP, 41 boards,
approved 2026-09-21 and caught up with the decisions the same day. Sources are
in `.design/v5/`.

**v4 ships as one tag (1.30).** Not phased over two releases, and not with the
coach dark behind the admin switch. The phases below are a build order, not a
release order: nothing reaches production until all eight are done.

---

## The order, and why it is this one

3.2 asked what gets built first and left it here. Three candidates were on the
table and the argument settles it:

**The engine first, the coach last.** Ren is the riskiest thing in v4 and the
instinct is to answer the riskiest thing first. That instinct is wrong here,
because he reads a digest (1.22) and the digest is built from activity
outcomes, streaks and group shares. Building him first means building him
against data that is about to change shape twice, and 1.19 changes what an
activity list even looks like.

**The design is not a phase.** v3 built screens phase by phase against
`SCREENS.md` and that was right, because the screens were new. Here the routes
exist and the look changes, so the redesign rides along inside each phase
rather than being a phase of its own. A phase that is only "make it look right"
is a phase that gets cut when time is short.

**The one hard ordering constraint** is that Monk mode cannot be built before
the five new types exist, because it aggregates them (1.16), and the five
cannot be grouped on Home before they exist either (1.19). So Phase 1 is types,
Phase 2 is the grouped row, Phase 3 is Monk mode, and nothing about the coach
happens until Phase 5.

---

## Phase 0 — Ground

- `CLAUDE.md`: "Current phase" becomes v4, the Voice section is replaced by
  `DECIDED.md` as 1.1 promised, and the "Not in v3" list is replaced by v4's.
- `.planning/v3/SCREENS.md` is re-pointed at the v5 canvas (1.8), or retired
  and replaced by a v4 equivalent that names boards rather than `.design/`
  artboards. Decide which in this phase, not later.
- New environment keys in all three `.env` files and in Vercel, per
  environment: `COACH_PROVIDER`, `COACH_MODEL`, `COACH_API_KEY`,
  `COACH_MONTHLY_CEILING`, `COACH_DAILY_ASKS`. Added to `.env.example` in the
  same commit, because a key missing from one file leaks in from `.env.local`
  and that has cost an afternoon before.
- **`PUSH_REMINDERS` stays 1 in production and 0 in Preview, and the coach gets
  the same treatment.** Dev must never call a paid provider. Prove it the way
  3.3 proved the reminder tick: hit the route on dev with a valid secret and
  read `{ ok: true, skipped: "disabled" }` back.

**Done when:** `bun run check:deps`, `check:cron` and the full CI run are green
on a branch that has changed no behaviour, and dev is proven unable to spend
money.

## Phase 1 — The five new types

- Five declarative modules, all held-or-slipped with no evidence, which is
  Sugar-free's shape: Cold shower, Morning sunlight, No junk food, No alcohol,
  No social media (3.1).
- **A `category` field on the module interface**: BODY, FOOD, MIND, SLEEP, and
  null for a member-written one. This is what 1.16's required categories read
  and it is the only engine change in this phase.
- Backfill the category on the twelve existing modules.
- Member-written conditions: same module, a row the member names, `category`
  null (1.19). Nothing that reads category may assume one exists.
- `bun run sync:activities` picks them up, disabled, as it does for everything.

**Done when:** all seventeen types appear in the catalog, a member-written one
can be created and checked in, `check:offer` passes for every new type, and
`bun run simulate` runs a week with all five without a drift row.

## Phase 2 — The grouped row

- Home draws every `checkin.kind` of held-or-slipped under one expandable row,
  `Simple ones, 3 of 5` (1.19). It is presentation only: no new event, no new
  score, no aggregate stored anywhere.
- Each keeps its own streak, its own window and its own sharing toggle. The
  group is a `<details>`-shaped thing and nothing else.
- Catalog, Activities, Sharing and Settings list them the same way.

**Done when:** five types occupy one row on Home, opening it shows five
streaks, and turning one off removes it from the group without touching the
other four.

## Phase 3 — Monk mode

- The aggregate: passed over scheduled, resolved as the set stood on the day
  being read (1.16). It stores nothing and is rebuildable, because the things
  under it already are.
- The set is effective-dated, insert-only, with a future `effective_from`.
  Invariant 4 applies to it unchanged.
- Compulsory activities, and the four required categories, reading the field
  Phase 1 added. **If a required category is uncovered, Monk mode does not
  appear at all** and the screen says what is missing (1.16, `MonkLocked`).
- A weekly counts on the days it was done and is not asked otherwise, so the
  denominator moves daily. **0 of 0 renders as a dash and never as 0%.**
- **The stricter monk bar (1.29), and this is the expensive part.** A second
  scope on `activity_scores`, a second pass computing it, and `verify` diffing
  both. The second verdict appears nowhere but Monk mode's own screen.
- A share toggle per group (1.29). No camera switch: there is no photograph.

**Done when:** `verify` diffs both scopes over a seeded month with no drift, a
day with nothing scheduled shows a dash, and removing a required activity makes
Monk mode disappear rather than degrade.

## Phase 4 — Nudges

- At-risk on Home: window open, closing soon, nothing logged. It is computed
  per activity and never per person (1.5).
- The nudge itself: four set messages, no typing. The first feature where one
  member can put a notification on another member's phone.
- **Delivery is push AND the card on Home** (1.27). Push is best-effort;
  the card always lands.
- **The window is the rate limit** (1.27). At-risk is the only state a nudge
  can move, so there is no counter and no claim row. Quiet hours still win.
- One switch to refuse them, and nobody is told you turned it off (1.13).

**Done when:** a seeded member at risk can be nudged, the target sees both the
push and the card, the card clears when the activity is done, and a nudge is
impossible outside an open window.

## Phase 5 — The coach, without a model

Everything about Ren except the call. This phase exists so that the model is
the last variable rather than the first.

- `src/server/coach/digest.ts`: the structured summary the server builds from
  outcomes, streaks, windows, group shares and **which photographs matter**
  (1.22). Pure, testable, no network.
- `src/server/coach/provider.ts`: one interface, `COACH_PROVIDER` picks the
  implementation (1.21). A stub provider that returns fixed text ships in this
  phase and stays for tests for ever.
- `/api/cron/coach`, its own QStash schedule, `0 4 * * *` (1.23). Bearer check,
  heartbeat, failure callback, declared in `JOBS` like the other three.
- The lines table, the rolling summary table, the recompute claim.
- Every screen that carries a line: Home, After a miss, Your record, the day is
  done, and his tab (1.4a).
- **The one hard rule, enforced here rather than in a prompt**: every number in
  a line comes from the digest verbatim (1.24). A test walks the stub's output
  and fails on a digit that is not in the input.

**Done when:** the whole coach works end to end against the stub, the nightly
job writes lines, `schedulerHealth()` shows four jobs, and no test anywhere
needs a network.

## Phase 6 — The model

- Gemini Flash behind the seam, taking the digest and the photographs.
- DeepSeek behind the same seam for Ask Ren, text only (1.21).
- The rolling summary, rewritten nightly, with read, edit and clear (1.25).
- **The failure path, proved rather than assumed** (1.23): retries, DLQ, no
  line, and the recompute button that exists only when a failure is recorded.
  Prove it on dev the way 3.4.7's failure callback was proved, by making a real
  call fail rather than by writing a fake failure row.
- The daily ask cap, and the monthly ceiling that switches Ask Ren off while
  the nightly lines carry on (1.26). Every call writes an event; Ops reads them.
- Ren off, and off is a real off: no tab, no lines, nothing sent (1.14).

**Done when:** a real night produces real lines, unplugging the provider
produces the empty state and a working retry, and the ceiling can be dropped to
zero in Vercel and observed to stop Ask Ren and nothing else.

## Phase 7 — The gate, and the rest of the surface

- The consent gate at its real length: `CONSENT` and `TERMS` gain Ren, the
  provider sentence, and the rolling summary in WHAT IS RECORDED and DELETING.
  `CONSENT_VERSION` goes to 2, which is what makes all three re-accept.
- **The accept button waits until the end** (1.8i), with the progress rule.
- First run (1.15): deterministic, unskippable, and it carries the refusal
  (1.15a) with the whole tutorial branching on it.
- You: profile and settings on one page, reached from the avatar on Home, with
  the memory row and the admin row (1.8e).
- Splash, sign-in, the mark and the logotype.
- Every remaining board opened beside its route.

**Done when:** a new account can be created, gated, tutored and land on a Home
that works, and all three existing members have re-accepted.

## Phase 8 — Before it ships

- `bun run break-in` extended: the coach routes, the recompute guard, the nudge
  path, and the member-written condition as an injection surface.
- `bun run sim:push` extended to nudges, because a nudge is a notification and
  v3.3 proved that a sentence nobody read before shipping is a sentence that
  ships wrong.
- A new check, `check:coach`: the digest contains no number the lines invented,
  and a stub run produces no line over its length limit.
- Read a real night of lines and a real day of nudges, word for word, the way
  `check:push` is read after a release.
- The release runbook: `.planning/RELEASE.md` gains the fourth schedule, the
  new env keys, and `CONSENT_VERSION`.

**Done when:** every check is green on the same SHA, and a person has used it
on a phone for a day.

---

## Order notes

- **Phase 1 before 2 and 3.** Both read the types. Monk mode reads their
  categories, which do not exist until Phase 1 adds the field.
- **Phase 4 can overlap Phase 3.** Nudges touch groups and windows; Monk mode
  touches scoring. They meet nowhere.
- **Phase 5 before Phase 6, and the gap is the point.** Building the coach
  against a stub means the day the provider arrives, the only new thing is the
  provider. Doing it the other way round means every bug is either the prompt,
  the digest, the schedule or the provider, and no way to tell which.
- **Phase 7 can start once Phase 5 is done**, because the gate's copy depends
  on what the coach does rather than on which model does it.
- **Phase 8 cannot start until everything else is finished**, and it is not the
  phase to compress.

## Known cost, accepted before starting

**The stricter monk bar is the largest single piece of engine work in v4** and
it lands on the one activity in the app that cannot punish anybody (1.16). A
second scope on `activity_scores`, a second pass, and `verify` diffing both.
The cheap alternative, letting a member set a harder target on the activity
itself, was offered and refused. This is written here so that if Phase 3 runs
long, nobody is surprised about which part.

**`settleFines` is still O(lifetime) per run** and hourly scoring multiplies it
by 24. Three members and fifteen uncharged rows make it free today. It is the
first thing that will hurt, and bounding it is its own change with its own
correctness argument about late settlement. Not in v4.
