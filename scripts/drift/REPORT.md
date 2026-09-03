# v3 drift audit — 54 screens, mock vs real app

## Round 4 — second numbered pass, 2026-09-04

### #54, the reputation drift: found and fixed

Round 3 flagged this and did not touch it. It is now understood and closed, and
it was two bugs, not one.

**The scoring bug.** `recomputeGroups()` set the score a member starts a group
on by reading the LATEST row out of `reputation_daily`:

```ts
const [before] = await db.select({ score: reputationDaily.score })
  .from(reputationDaily)
  .where(and(eq(userId), isNull(groupId)))
  .orderBy(sql`day desc`).limit(1);
let score = joiningScore(before ? Number(before.score) : START_SCORE);
```

Two things wrong with those five lines:

1. **It read the global score as it stands NOW, not as it stood on the join
   date.** Invariant 5, exactly. Every time the global score moved, every
   group's starting point moved with it, and the whole of that group's
   history was re-judged from a different number.
2. **A recompute read the table the recompute writes.** So each run was seeded
   by the previous run's output. Verify could never converge: it compared a
   replay-from-the-previous-answer against the stored previous answer, and the
   gap grew by a day's decay every day.

That is why the numbers looked the way they did: stored and computed both
started at "delta 0.000, reason neutral" and disagreed anyway (140.000 against
154.202), then tracked each other's shape forever at a fixed offset that
compounded.

The fix takes the starting score from the freshly replayed global series that
`replayGlobal()` has already produced in memory, on the day before the join.
The recompute is now a pure function of events, and resolves as-of the join.

`bun run verify` over full local history: **235 reputation rows differing before,
0 after.** Admin Ops now reads "No drift. Stored rows match a fresh recompute."

**The reporting bug.** Admin Overview said "0 periods differ" on the same data
where Ops listed a hundred rows, because `getLastRun()` counted only
`kind === "score"` drift and dropped every reputation row on the floor. It now
counts both, and the copy reads "rows" rather than "periods", since a reputation
row is a day.

### Fixed this round

| # | What it was |
|---|---|
| 36 | Ledger's "entries are never edited" footer removed. It is in the consent form |
| 38 | Reading's evidence line shortened to one line: "Live camera, of the page you stopped on." A deliberate drift from the artboard, which has the longer sentence |
| 39 | Heatmap was `--fg` at five opacities; now the mock's five-step flame ramp with its none/all legend and week count, and weeks read down a column as a calendar does. New `--heat-1..5` tokens, with their own light-mode steps. Activity rows carry the streak flame the mock shows |
| 44 | Rank icons were 20px against the mock's 26 (and 42 against 30 in the header). Sizes matched, and the row rebuilt to the mock's shape: the range sits beside the name, the hero is a bordered box |
| 45 | Dark/Light was two 64px buttons; now full width, split in half, `Dark`/`Light` in sentence case on a rule border, as drawn |
| 48 | Admin header had no Curfew mark and carried a border the mock puts under the nav instead. Mark added, header border removed, active tab is an inset shadow rather than a second border. All seven tabs now fit at 390px, so **Reports is visible**: it was never removed, it was scrolled off the right edge by an 18px gap |

### Stats detail pages, built

The four `/stats?a=…` routes had a chart and nothing else. They now carry what
the artboards carry:

- **The three tiles** under every chart: current streak on the flame gradient,
  best, and a third that follows the kind (grace left, average a period,
  sessions a week). `chartFor()` returns the standing to feed them.
- **The weekday bars**, `PASS RATE BY WEEKDAY` for every kind and
  `WHICH DAYS YOU GO` for a weekly one, which counts the session days the
  module records rather than the period.
- **The activity picker** at the top, as a real disclosure listing your other
  activities, rather than the mock's box with a chevron that does nothing.
- **Numeric**: the target line is dashed accent with a `target 8,000` label,
  and bars are solid or rule rather than green or red.
- **Weekly**: the minimum line with its label, the count above each bar, and a
  ten-week window instead of thirty days, so eight bars appear where three did.
- **Abstinence**: laid out on a real calendar so a weekday reads down a column,
  with the weekday letters and the held/slipped legend.

### Still open

- **Ledger dates.** Every entry in the seeded group ledger reads "4 Sep",
  because the fixture writes the whole history's fines in one scoring pass.
  Fixture debt, not app behaviour.
- **The `SCREENS.md` review gate** still needs a person opening each screen
  beside its artboard. That is what the gallery is for.

## Round 3 — your numbered review, 2026-09-04

Every point from your numbered pass over `.shots/index.html`, with what
actually happened. All 54 screens recaptured clean afterwards; typecheck and
226 tests green.

### The one root cause behind a third of the list

`scripts/drift/manifest.json` pinned `mock_now` to a **fixed date, 15 Jan
2026**, on all 54 screens. But only the three `checkin-open-*` fixtures build
their data around that fixed date. Every other fixture (`default`, `all-done`,
`no-money`, `new-user`, `notice-active`, `admin`, `invite-*`) anchors on the
real clock at seed time. So the app was being asked to render a world that had
no config, no scored history and no periods on the date it was told it was —
it found nothing, and either rendered empty or threw.

That single mismatch caused **#45** (the `/settings` crash — `no sleep config
effective on 2026-01-16`), **#39** (empty heatmap), **#51** (zero check-ins a
day), and much of **#1/#2/#40-43**. Fixed by dropping `clock` from every
fixture that does not need it: no cookie, real clock, matching whatever the
seed just wrote.

### Fixed

| # | Slug | What was wrong | Fix |
|---|------|----------------|-----|
| general | `cfg-*` | Up to 5 stacked boxes per configure screen | Description and the "changes apply from tomorrow" line are plain text now, not boxed. Down to 2 boxes. |
| 1, 2 | home-today, home-done | "0 of 5 done" always | Two causes: the clock mismatch, plus the seed never wrote *today's* check-ins at all (every history helper stops at yesterday). Added `seedTodayPartial()`: Water and Nightfast done, Sleep/Gym/Steps due, Office unscheduled. Now reads "3 of 5 done". |
| 3 | home-no-money | Money shown on the no-money fixture | Real bug: `fineRuleFor` never consulted the money toggle, so fines were written to `ledger_entries` for money-off groups and `balances` had rows. Scoring now resolves `moneyOnFor` per period and zeroes the fine. Seed reports "0 fines written". |
| 4 | home-empty | Complete mismatch | Rebuilt to the mock: "TODAY" + "You are tracking nothing." headline, two bordered CTA blocks with their copy, invite-only note. |
| 5, 6 | notice-home, notice-group | Notice text was invented, matched nothing | The fixture bypassed the real pipeline and inserted a hand-written maintenance string. It now flips real switches (money off, Screen on) and composes the body through `noticeFrom()` — the same function the admin confirm sheet uses. Overlay also bolds each change's headline. |
| 21 | cfg-new-steps | "No such page" | Manifest pointed at `/activities/add/steps`, which has never existed. Fixed to `/activities/steps` on the `new-user` fixture, where Steps is genuinely untracked. |
| 23, 27 | checkin-optional, checkin-ready | Red text by default; ready state never demonstrated | Real bug: the blocked reason rendered whenever a field was empty, and Send was natively `disabled` so an attempt could never register. Now Send is always clickable, and the reason appears only after a failed press — exactly what you asked for. |
| 25, 26 | camera, capture-confirm | "No such page" | There is no `/checkin/[key]/capture` route; the camera is a client overlay. Harness now launches Chromium with a fake video device and scripts the interaction. Both screens capture the real camera UI. |
| 29 | groups-list | Group-name input before "New group" | Now a disclosure: the button alone at rest, input and Create revealed on click. |
| 32 | group-evidence | Deletion-policy paragraph | Removed. |
| 37 | join-share | Only one activity | Fixture now accepts 3 types: gym + steps (tracked, share toggles) and food (untracked, "Set it up first"), matching the mock. |
| 39 | stats-overview | Empty heatmap | Clock fix. Populated. |
| 44 | ranks | IMMACULATE icon/colour, order, ranges | Order reversed to descending (IMMACULATE last, as in the mock), ranges shown as "850-1000" not "850+", and IMMACULATE now has its own gold crown with the glow instead of reusing UNBROKEN's mountain. |
| 45 | settings | "Something failed while loading this page" | Clock fix. |
| 48 | admin (all) | Navbar border and colour | Header divider was `border-b-2 border-fg` (thick white); now `border-b border-rule`. Tab order corrected to the mock's (Overview, Users, Groups, Insights, Controls, Ops); Reports, which has no mock, moved last. |
| 49, 50 | admin-users, admin-groups | "USERS"/"GROUPS" heading above the search | Both removed. |
| 51 | admin-insights | Zero check-ins-a-day | Clock fix. Real bars now. |

### Not a bug, after checking

| # | Finding |
|---|---------|
| 9, 10 | The Save/Stop-tracking button **is** there and always was. The mock has no persistent Save either: Save appears once a control changes, "Stop tracking" shows at rest. It was invisible in the gallery because these screens scroll inside a fixed-height pane, and neither a viewport screenshot nor Playwright's own `fullPage` captures that. **Harness fixed**: it now measures the tallest scrollable pane and grows the viewport to fit, so every screenshot shows the whole screen. This was hiding content on other screens too. |
| 7 | activities-list — you called it perfect. Untouched. |
| 8 | activities-add — the current capture matches the mock structurally (catalog, ALREADY TRACKING, footer note). The earlier mismatch was the clock bug. Which types appear tracked differs from the mock because the mock's persona tracks a different set; that is sample data, not drift. |
| 24 | checkin-required-blocked bottom text — the mock demonstrates **Food** ("Take the photo and enter the calories..."), our fixture is **Sleep**, whose confirm step has no numeric field, so it correctly reads "Take the photo to send this check-in.". Same sentence shape, fewer required fields. A Food-based fixture would match literally; noted as fixture debt, not a code defect. |
| 47 | settings-data — the mock has both bottom boxes (money-owed, irreversibility) with the same copy we ship. Left alone. |

### Still open, and why

**#54, admin-ops — a real scoring bug, found while checking this screen.** The
DRIFT list is not a rendering problem: it is reporting genuine, systematic
reputation drift for one user on *every* day of history, with the gap growing
day over day (4 Aug: stored 81.473 vs recomputed 76.589; 23 Aug: 99.937 vs
95.149; "96 more not shown"). Stored and recomputed reputation come from the
same function (`scoreUser` calls `recomputeUser`), so they should agree by
construction.

Checked and ruled out: this is **not** caused by the money-toggle fix above —
`applyDay()` takes only `score`, `ceiling`, `completion` and `idleDays`, never
a fine amount. It is pre-existing.

Also inconsistent: admin **Overview** reports "Drift check · 0 periods differ
from stored" on the same data where **Ops** lists 100+ drifting rows. At least
one of those two is wrong about the same fact.

This is invariant-protected scoring code that money and reputation both depend
on. It needs a focused session, not a fix squeezed in at the end of a long
one — flagging rather than guessing.

**#40-43, the four detail-chart routes** still lack the mock's weekday
pass-rate bars and streak/best/grace tiles (report item 27 below). The
missing-data half is fixed; the missing-sections half is a build, not a fix.

---

## Round 2 — fixes applied, 2026-09-03

Everything below this section is the original round-1 findings, kept as the
record. This section is what actually got fixed afterward, in the same
session, working from the user's own read of the gallery plus the findings
below. All 54 screens recaptured at the end; `.shots/index.html` now reflects
current state. `bun run typecheck` and `bun run test` (224/224) both clean.
Nothing committed or pushed.

**Fixed (17 real bugs):**

1. Missing Activities tab in the bottom nav — added, matching the mock's icon/order.
2. Missing pending-work dot (Admin link) and pending-invite dot (Groups tab) — both wired to real counts.
3. **Notice/sheet dimming was broken app-wide.** `bg-bg/90` and `bg-bg/85` produce zero alpha — Tailwind can't inject opacity into a `var()`-defined color. Hit 4 screens: the notice overlay, admin-controls-confirm, the evidence report sheet, and the delete-data sheet. Added `--scrim`/`--scrim-85` tokens in `globals.css`, switched all four to inline `style`.
4. Tab bar was leaking onto `/checkin/[key]`, overlapping the Send button, despite the page's own comment promising no tab bar.
5. `group-stats` and `group-ledger` were showing a tab row they were never meant to have. Restructured the group route tree under a `(hub)` route group so those two are genuine standalone pushes.
6. Ceiling bar on Standing rendered as flat gray — `colour.replace("text-", "bg-")` builds a class name at runtime, which Tailwind's static scanner never sees, so no CSS is ever generated for it. Added a real `RANK_BG` table.
7. Missing Settle button on Standing — added, linking into the Ledger tab's existing settle flow.
8. Group-evidence repeated the same "only shared members see this" fact in two separate boxes — trimmed the empty-state copy.
9. Ledger correction rows showed "X to Y" instead of "Reversed" — `direction()` now special-cases `kind === "adjustment"`.
10. Numeric fields showed `8000` instead of `8,000` — `type="number"` can never show a thousands separator; switched to a formatted text input.
11. Gym's weekly bars were invisible — a percentage height was nested inside a flex item with no resolvable height (the `items-end` parent lets its children shrink to content); gave the bar's track an explicit height instead.
12. The join flow's "Add and share" button saved correctly but never navigated anywhere — a server-side `redirect()` doesn't propagate through a plain awaited call from a client transition. Moved navigation to the client.
13. Missing "Add for myself only" option on the join-configure screen — added, with a `share` flag threading through the save action.
14. `/settings/data` and group-evidence would 500 outright if a single photo failed to presign (a real risk once evidence data exists) — both wrapped so one bad photo is skipped, not fatal to the page.
15. Admin `users`/`groups` counts showed "1 activities"/"1 groups" — `count(*)` comes back from Postgres as a bigint string; `=== 1` never matched. Cast to `::int`.
16. Admin sub-nav tab labels were Sentence case; the mock's raw text nodes are literally typed in caps. Fixed casing + matched the mock's font-size/tracking.
17. Rebuilt `/admin` (Overview), `/admin/insights`, `/admin/users`, `/admin/groups`, and `/admin/ops` against their mocks — six stat tiles in the right order (value-first), the "LAST NIGHT'S RUN" section, per-type pass rates, 14-day abandonment rates, a computed trend caption, search + filters on Users/Groups, the privacy disclosure box, and a real RECOMPUTE/Rebuild path on Ops. See the per-screen notes below for the honesty tradeoffs made where no persisted run-log exists.

**Built (1 new feature):** single-photo delete on `/settings/data` — a thumbnail picker (`listOwnPhotos`), ownership-checked per-photo delete (`deleteOnePhoto`), and the same confirm-then-act pattern the rest of that screen uses.

**Corrected from round 1 (2 false findings):** the "dead routes" `cfg-new-steps` and `join-setup` turned out to be errors in my own test manifest, not app bugs — the real URLs (`/activities/[key]`, `/activities/[key]?from=join&invite=`) work and always did.

**Fixed (18th bug, found chasing the gallery's "No such page" reports):** `resolveUserSleepConfigRow` (`src/server/config.ts`, feeds `/settings`) parsed a stored sleep config against `sleepConfigSchema` directly. The app actually has two valid storage shapes for that column: the seed's own `userId=null` default row is flat (written before this convention existed), and every real per-user save via `saveUserActivity` wraps it as `{ schedule, config }` (see `splitConfig` in `activities.ts`, which `listUserActivities` already unwraps correctly). This function never unwrapped, so it worked only until a real user saved their own sleep settings once, at which point `/settings` threw a ZodError and 500'd for that user permanently. **Pre-existing, confirmed via `git diff` — nothing this session's agents touched.** Fixed with a shape-detecting unwrap (`moduleConfigOf`) rather than assuming either shape. Blast radius checked: only `getPersonalSettings`/`/settings` calls this function; scoring reads sleep config through the already-correct `listUserActivities` path, so this never touched scoring.

**Fixed (19th bug — the real cause of the `activity_types` "flakiness"):** not flakiness at all. `activity_types.changed_by` references `users.id`, and `wipe()`'s `TRUNCATE ... users ... CASCADE` silently cascades into `activity_types` too, even though it's never named in the explicit TRUNCATE list — Postgres cascades to every table with a foreign key to a truncated table, not only the ones spelled out. Every `local:seed` run was wiping type-enablement as an unintended side effect of wiping users. Fixed permanently in `scripts/seed-local.ts`: a new `ensureTypesEnabled()` runs once, **after** `builder()` (i.e. after `wipe()`), re-enabling all twelve registered types every reseed. Verified: recreated the Docker container from scratch, reseeded twice, confirmed all 12 types read back enabled both times, `bun run typecheck` and `bun run test` (226/226) both clean.

**Built (2nd new feature this round) — the sleep wake-time chart, per your decision to extend the module rather than amend the mock:**
- `src/domain/sleep/index.ts`: `evaluate()` now records the earliest `wake` check-in's actual instant, converted to minutes-since-midnight in the period's own timezone (respects invariant 5 — resolved once, at scoring time, using the config that period was actually scored against), plus that period's `wake_open`/`wake_close` window in the same units. Three new `detail` fields (`wake_at_minutes`, `wake_window_open_minutes`, `wake_window_close_minutes`) alongside the existing three booleans. Two new unit tests (earliest-of-multiple-presses, no-wake-checkin case); the two existing `toEqual` tests updated for the new shape.
- `src/app/stats/charts.tsx`: `Windowed` rewritten from the old three-row pass/fail grid (never in the mock) to the mock's actual shape — a scatter of each day's wake time against a dashed window band, axis labels in 12-hour clock, and a computed "N mornings landed outside the window" caption. Pass/fail color follows `wake_ok` specifically, not the day's overall pass.
- `scripts/seed-local.ts`: the wake check-in's seeded instant was always the exact window midpoint, which made every day identical and the new chart render as a flat line. Added a deterministic (not `Math.random` — a reseed must reproduce the same screenshot) wobble within the window (15% to 85% of its span) so the chart has a real scatter to show; night and confirm keep the old midpoint.
- Verified against `.shots/stats-sleep.app.png` vs `.shots/stats-sleep.mock.png`: the window band, dot scatter, and axis labels now genuinely match. **Not built**: the mock's "PASS RATE BY WEEKDAY" bars and CURRENT STREAK/BEST/GRACE LEFT tiles below it — that's report item 27 below, a systemic gap across all four detail-chart routes (sleep, steps, gym, nightfast), out of scope for this round.

**Not done — flagged, not fixed:**
- Time-of-day inputs are still the platform's native `<input type="time">` (12/24-hour follows the device) — documented as intentional in CLAUDE.md.
- Item 27 below (weekday pass-rate + streak/best/grace tiles missing from all four detail-chart routes) — real, not fixed this round.

**Full recapture, after the `activity_types` fix:** all 54 screens, `node scripts/drift/run-all.mjs`, every fixture reseeded from scratch in sequence. `mockOk`/`appOk` true on all 54 — no "No such page" failures anywhere in the run, confirming the cascade-truncate fix holds across repeated reseeds, not just one.

---


Local-only run, nothing pushed. Screenshots live in `.shots/` (gitignored) —
open `.shots/index.html` in a browser for the side-by-side gallery this report
refers to by slug. Six sonnet agents did the first pass (screenshots +
source read); every DRIFT and FUNCTIONAL claim below was either verified
directly by Opus against the actual PNGs/source, or is marked **UNVERIFIED**
where it wasn't. One agent claim was found to be a flat misread and is struck
from the record, noted under Corrections.

Severity key: **BUG** (real, fix it) · **COSMETIC** (real, low stakes) ·
**INTENTIONAL** (documented reason, not a bug) · **ARTIFACT** (a limitation of
this test rig, not the app) · **NEEDS-LIVE-CHECK** (couldn't confirm from a
screenshot alone).

---

## Corrections to the sub-agent passes

- **Not a bug**: the Home/Activities/Ranks agent claimed `activities-list` and
  `ranks` show a 5th "Activities" tab in the bottom nav, contradicting the
  4-tab `nav.tsx`. Checked both PNGs directly — both show the same 4 tabs
  (Home/Groups/Stats/Settings) as every other screen. The agent misread its
  own screenshot.
- **Not a bug**: the Admin agent read admin's 5-tab sub-nav (Overview,
  Insights, Users, Groups, Reports — no Controls, no Ops) as a capability
  resolution bug. It's `overflow-x-auto` (`admin-nav.tsx`) — Controls and Ops
  are real, present, and reachable (`curl` confirms 200), just scrolled off a
  390px screenshot. The real (minor) issue is that the app's tab spacing
  doesn't fit six tabs where the mock's tighter labels do.
- **Fixed during this audit, not a shipped bug**: 6 of 14 Configure screens
  (Food, Supplements, Study, Reading, Screen, Sugar-free) 404'd because this
  local database had all twelve activity types registered `disabled` — the
  default state after `sync:activities` — and nobody had enabled them here.
  Enabled all six and recaptured; they render now. **This was a gap in my own
  local setup, not application code.**
- **Likely an artifact of my seed timing, not a live bug**: the first
  `/settings` capture showed a hard error screen ("Something failed while
  loading this page"). A direct `curl` afterward returned 200 cleanly, and
  the dev server log shows a foreign-key violation on `reputation_daily`
  timed to a `TRUNCATE ... CASCADE` from the *next* fixture's reseed racing
  an in-flight request from the previous one — an artifact of the
  reseed-while-serving orchestration in this audit, not a defect the real app
  would hit (production never truncates `users`). Recaptured cleanly on
  rerun. Flagged **NEEDS-LIVE-CHECK** anyway since I didn't fully rule out a
  narrower race in the app itself.

---

## Home (6 screens)

1. **BUG** — Bottom nav is missing the mock's 5th tab, **Activities**
   (`nav.tsx` `TABS` has 4 entries; every mock shows 5). This is the drift you
   spotted before this audit started, now confirmed on every one of the 54
   screens, not just Home.
2. **BUG** — Mock's `Admin ›` header link and Groups tab both carry a small
   red notification dot for pending work / pending invites. Neither is
   implemented (`page.tsx` renders a plain `Admin ›`, `nav.tsx` has no badge
   logic at all).
3. **BUG, home-empty** — New-user empty state is much thinner than the mock:
   missing the "TODAY" label, missing the bordered-box treatment on both the
   activity and group prompts, missing the second persuasion paragraph for
   starting a group ("Keeping it up alone is harder..."), missing the closing
   invite-only note. Confirmed directly — see `home-empty.mock.png` vs
   `.app.png`. Copy is also shorter than the mock's.
4. **ARTIFACT, home-today / home-done / home-no-money** — these three should
   be visually distinct fixture states but the agent that reviewed them
   reported them looking closer to the same live moment than the fixtures
   intend (`home-done` not reliably showing "all done", `home-no-money` still
   showing a balances block). **NEEDS-LIVE-CHECK**: I didn't independently
   re-verify this claim against the actual `all-done`/`no-money` fixtures —
   worth a direct look at `home-done.app.png` / `home-no-money.app.png`
   before trusting it either way.
5. **MATCH** — `notice-home` / `notice-group`: the blocking overlay, its
   copy, and the single "Got it" acknowledgement (no dismiss) all check out
   against source (`notice-overlay.tsx`) and mock.
6. Money formatting: mock shows "₹150" (no decimals), app shows "₹250.00".
   This is `Intl.NumberFormat`-correct behavior for INR (2 minor-unit
   digits) — the mock simplified for legibility. **INTENTIONAL**, not a bug,
   confirmed by the Groups agent's read of `formatMoney`/`minorUnitExponent`
   and the money invariant.

## Activities (2 screens)

7. **MATCH** — `activities-list`: score card, per-row streak, summary
   strings all match the mock precisely, punctuation included.
8. **ARTIFACT** — `activities-add` showed an empty catalog before the
   type-enable fix (nothing left to add, since only 6/12 types existed
   app-wide). Should be re-checked post-fix; not re-captured in this pass.

## Configure (14 screens)

9. **BUG (systemic)** — Numeric fields render with no thousands separator
   (`8000`, not `8,000`) while the Stepper control does format with commas.
   One component fix (`NumberBox` in `configure-form.tsx`), affects
   `cfg-steps`, `cfg-new-steps`, and (unverified) `cfg-food`'s calorie limit
   and `cfg-screen`'s target — confirmed present on `cfg-food` in the
   recapture (`2000` not `2,000`).
10. **INTENTIONAL** — Time fields (`cfg-sleep`, `cfg-office`, `cfg-nightfast`)
    render as the platform's `<input type="time">` instead of the mock's
    12-hour text. Documented in CLAUDE.md's Current Phase section.
11. **NEEDS-LIVE-CHECK** — `cfg-errors`: the scripted validation-error
    interaction didn't reproduce any error styling in the app capture (came
    back as the plain valid form). Could be the interaction script failing to
    trigger the right invalid state, not the app lacking one — the agent
    couldn't confirm the error-marking pattern visually either way.
12. **ARTIFACT, cfg-food / cfg-supplements / cfg-study / cfg-reading /
    cfg-screen / cfg-sugarfree** — now render (post type-enable fix) but in
    the **untracked "start tracking" state**, not the mock's **tracked
    "editing" state** (confirmed directly on `cfg-food`: app shows "Start
    tracking Food" with no streak header, mock shows "41 days · best 41" and
    "Stop tracking Food"). This is because the seed leaves those six types
    untracked for the admin account — a test-data gap I introduced, not
    something to conclude either way about the tracked-state UI without
    re-seeding those six as tracked.
13. **MATCH** — `cfg-sleep`, `cfg-gym`, `cfg-office`, `cfg-water`,
    `cfg-nightfast`, `cfg-new-steps`: layout, copy, control order, evidence
    badges, settling-note copy all check out.
14. **FUNCTIONAL, MATCH** — `configure-form.tsx` has zero per-type branching,
    driven entirely by `type.fields()`/`type.facts`/`type.evidence`/
    `type.validate()` (invariant 6). Save re-validates `enabledTypes`
    server-side, not just at page load. `effectiveFrom` is always
    computer-derived forward, never a manually-passed date (invariant 4).

## Evidence and check-in (6 screens)

15. **BUG** — The global `TabBar` renders on `/checkin/[key]` despite
    `page.tsx`'s own comment promising "Bare chrome, no tab bar" and every
    mock showing none. `nav.tsx`'s `HIDDEN` list only excludes `/signin` and
    `/pending`. Confirmed directly: on `checkin-required-blocked` and
    `checkin-abstinence` this isn't just cosmetic — the tab bar visibly
    truncates the Send/Discard buttons and cuts off the abstinence
    consequence copy ("A slip breaks the streak and costs your ⟨cut off⟩").
16. **DOC BUG, not app bug** — `SCREENS.md` and this audit's own manifest
    describe a `/checkin/[activity]/capture` route. It doesn't exist. The
    camera is a client-state overlay inside `checkin-form.tsx`
    (`cameraOpen`), not a navigable URL — confirmed via file listing. The
    camera/capture-confirm/checkin-ready mock states are architecturally
    correct by source inspection, just not URL-addressable, so this harness
    couldn't screenshot them (**UNTESTABLE-HEADLESS**, 3 of the 6 slugs).
17. **FUNCTIONAL, MATCH, worth calling out as genuinely solid**: the required-
    photo block is enforced server-side in `performCheckin` independent of
    the disabled Send button — a direct POST bypassing the client is still
    refused (`needsPhoto` recheck against `pendingFor()`). The idempotency
    key is enforced by a real DB unique index
    (`events_one_checkin_idx` on `user_id, type, period_start, idem`), not
    just client debouncing. `occurred_at` is a DB-default column, never
    client-supplied. Invariants 8 and 9 hold under inspection.
18. **MATCH** — `checkin-optional`: layout, PHOTO/optional label, dashed
    slot, Note placeholder all line up.

## Groups (10 screens) — highest invariant stakes, all held

19. **BUG** — `group-stats` and `group-ledger-full` both render the
    Overview/Evidence/Standing/Settings tab row above their own content,
    directly contradicting `group-tabs.tsx`'s own comment: *"Group stats hang
    off Overview rather than taking a fifth, because a tab you visit once a
    week does not earn permanent chrome."* Root cause: both pages nest under
    `layout.tsx`, which renders `<GroupTabs>` unconditionally. Mocks show
    both as standalone pushes with just a back-chevron header.
20. **BUG** — Mock's Standing screen has an inline **Settle** button next to
    "You owe X"; the built screen has none — settling is only reachable via
    Full Ledger. Confirmed absent from `standing/page.tsx` by full read, not
    a data-dependent omission.
21. **BUG** — `/join/[inviteId]/setup`, as named in `SCREENS.md` and this
    audit's manifest, is a dead route (confirmed 404). The real flow reuses
    `/activities/[key]?from=join&invite=[id]`, and that reused screen drops a
    real mock feature: the mock offers **"Add and share"** and **"Add for
    myself only"**; the app renders only the share button
    (`configure-form.tsx`). A user arriving from a group invite to configure
    an untracked type currently cannot decline to share it with that group.
22. **COSMETIC** — `groups-list`'s "+ New group" always shows the name input
    inline; mock shows it collapsed until tapped. Missing invite red-dot
    (same root cause as Home finding 2). Ledger correction rows
    (`kind === "adjustment"`) call the same `direction()` helper as normal
    rows, so they'd render "X to Y" instead of the mock's "Reversed" label —
    confirmed from source, not visible in the specific row captured.
    `group-stats` header copy differs: "BY ACTIVITY" vs mock's "WHAT THE
    GROUP FINDS HARD".
23. **FUNCTIONAL, MATCH — the important one.** Every group-scoped read
    checked (`group-view.ts`, `ledger.ts`, `sharing.ts`) calls
    `assertMember`/`memberRole` against the session-derived viewer id, never
    a caller-supplied one. The earlier-fixed `getGroupLedgerRows` /
    `listGroupMembers` bug (documented in this project's history) is
    confirmed still fixed. No `.update(`/`.delete(` anywhere against
    `ledger_entries` (invariant 3 holds). The money-off group's suppression
    is genuinely server-side (`moneyOnFor()` gates before render, not a
    client hide) — no leakage even in the payload.
24. **MATCH** — `group-overview`, `group-settings`, `group-evidence`,
    `join-share`, `group-standing-money-off` all check out against source and
    mock, control for control.

## Stats + Settings (8 screens)

25. **NEEDS-A-PERSON, not a screenshot fix** — the sleep detail chart
    (`stats-sleep`) can't structurally match its mock. The mock wants a
    wake-time scatter plot against a window band; the sleep module
    (`src/domain/sleep/index.ts`) only ever emits three booleans
    (`night_ok`/`wake_ok`/`confirm_ok`), never an actual clock time, so
    there's no data to plot a time series from. This is a genuine
    spec-vs-implementation contradiction, not a rendering bug — per CLAUDE.md's
    own working-style rule ("raise contradictions rather than picking one
    silently"), this needs a decision: either the sleep module starts
    recording real times, or SCREENS.md's description gets amended to match
    what was actually built (a pass/fail strip chart).
26. **BUG (rendering)** — `stats-gym`'s weekly bar chart renders numeric
    labels (`0 0 3 4 3 3 4 3`) but **no bars at all** — confirmed directly,
    just numbers floating on black. Likely `peak` computing to 0 or the flex
    container collapsing in `charts.tsx`'s `Weekly` component. Also missing:
    the dashed minimum-line.
27. **BUG (systemic)** — None of the four detail chart routes (sleep, steps,
    gym, nightfast) render the mock's weekday pass-rate breakdown or the
    streak/best/grace stat tiles — present on every mock, absent from all
    four built screens. One systemic gap, not four.
28. **BUG** — `settings-data` is missing the mock's "Delete a single photo"
    row (only "Delete all photos" exists;  no per-photo action wired in
    `delete-form.tsx`).
29. **FUNCTIONAL, MATCH — the important one.** `deleteAccount()` genuinely
    keeps `ledgerEntries` and never hard-deletes the `users` row (matches "a
    debt with no counterparty is not a debt"). `deleteHistory()` genuinely
    strips identifying payload from kept `events` rows rather than deleting
    them outright (matches invariant 1). The historical `/100` hardcoding bug
    on this screen is confirmed still fixed — money goes through
    `formatMoney`/`minorUnitExponent`.
30. **MATCH** — `stats-overview` heatmap/figures, `stats-nightfast`'s
    mark-not-color-only cells (✓/✕, not color alone — satisfies the Voice
    rule), `settings-sharing`'s toggle/checkbox/copy all check out.
31. **COSMETIC** — `settings-data`'s history section lists a delete row per
    tracked type instead of the mock's one generic picker row — arguably
    clearer, but a different IA than mocked and not reflected in SCREENS.md.

## Admin (7 screens)

32. **BUG (major, admin-overview)** — The six stat tiles show entirely
    different metrics than the mock (Users/Groups/Check-ins-7d/Total-Fined/
    Outstanding/Last-Scored vs mock's Users/Groups/Pending-Invites/
    Activities-Tracked/Evidence-Stored/Check-ins-Scored%). The mock's entire
    "LAST NIGHT'S RUN" job-status section (Scoring/Reputation/Retention-
    sweep/Drift-check rows) doesn't exist in the built page at all.
33. **BUG (major, admin-insights)** — Different chart set entirely from the
    mock, and **"abandonment rates," named directly in `SCREENS.md`'s own
    description of this screen, has no backing query anywhere** in
    `insights.ts`. Worth a follow-up, unconfirmed as a bug from a screenshot
    alone: the Pass Rate chart's date axis doesn't match the Check-ins
    chart's, and pass rate drops to a flat 0% at the very right edge —
    possibly today's still-open period being counted as a fail instead of
    excluded.
34. **BUG** — `admin-users` and `admin-groups` both drop their mock's search
    box and filter chips; `admin-users` also drops the "never reads" privacy
    disclosure box entirely (the underlying privacy guarantee still holds —
    see finding 36 — the on-screen reassurance just isn't there).
35. **MATCH — the two things this project specifically worried about
    before.** `admin-controls`: confirmed no "add a type" button anywhere,
    citing decision 82. `admin-controls-confirm`: confirmed no freeform
    "where did this come from" text box — the invented field from earlier in
    this project's history has not crept back. The notify mechanism is
    exactly what was asked for: `noticeFrom()` composes copy from the
    sheet's own consequence blocks, gated by a checkbox, no freeform input.
36. **FUNCTIONAL, MATCH — the privacy promise holds.** Every admin query
    traced (`listAllUsers`, `getUserInspector`, `wakeTrend`, `evidenceOps`)
    reads only counts, statuses, and structural fields — never check-in
    `payload` detail, never `evidence.objectKey`. `/admin/reports` remains
    the one confirmed exception, exactly as documented.
37. **BUG (minor)** — `admin-ops` reorganizes into separate Scoring/Verify
    sections and drops the mock's Rebuild button and its "DRIFT, LAST RUN"
    persisted results list. The underlying actions are real
    (`runScoring`/`runVerify` call `scoreAll`/`verifyAll`), not decorative —
    just the results aren't surfaced back to the screen after a run.

---

## Tally

- **Real bugs (fix these)**: missing Activities tab (nav-wide, #1) · missing
  notification dots (#2) · thin home-empty copy (#3) · numeric-formatting
  commas (#9) · tab bar leaking onto check-in screens and obscuring buttons
  (#15) · group-stats/ledger tab-row leak (#19) · missing Settle button (#20)
  · dead `/join/[id]/setup` route + missing "add for myself only" (#21) ·
  gym chart bars invisible (#26) · missing weekday/streak sections on all
  four stats detail charts (#27) · missing single-photo delete (#28) · admin
  overview/insights/users/groups all substantially rebuilt from their mocks
  (#32–34) · admin ops missing rebuild + persisted drift list (#37).
- **Needs a person's decision, not a screenshot fix**: the sleep module
  doesn't store what its own mock needs plotted (#25).
- **Needs a live check before trusting either way**: cfg-errors validation
  styling (#11), home-done/home-no-money fixture fidelity (#4), the
  `/settings` transient crash (Corrections).
- **Confirmed solid** (the stuff worth knowing didn't break): every
  invariant-10 membership check, invariant-3 ledger append-only-ness, the
  money-off suppression being genuinely server-side, evidence-required
  server-side re-validation, idempotent check-ins on a real DB constraint,
  server-only timestamps, deletion's ledger/event handling, the admin
  privacy boundary, and both previously-fixed issues (the ledger/members
  trust bug, the invented free-text field) staying fixed.

Open `.shots/index.html` for the pictures. Nothing here has been committed or
pushed.
