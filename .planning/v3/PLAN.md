# PLAN.md — Build order for v3

Nine phases. Each one ends with something that works and something you can look
at. No phase is done until its rows in `SCREENS.md` are ticked and its tests are
green.

Read `SCOPE.md` for what and why, `ARCHITECTURE.md` for how, `SCREENS.md` for
the screen contract.

## Phase 0 — Ground

- Confirm the fresh start one last time before anything is dropped
  (decision 22). After this phase there is no going back to v1 data.
- Amend `CLAUDE.md`: invariant 4 names **scoring config** rather than all
  config, the drift list records the IMMACULATE glow exception, "Current phase"
  becomes v3, and the "Not in v1" list is replaced by v3's own.
- R2 bucket, Upstash instance, secrets in Vercel, the cron secret.
- `bun run sync:activities` with `--check`, wired into `bun run migrate` and CI.

**Done when:** migrate runs clean against an empty database and CI fails if a
module has no row.

## Phase 1 — The engine

The real work, and it comes first because everything else assumes it.

- `periodStart()` rewritten: takes an activity's boundary and schedule, no
  hardcoded noon, no hardcoded day.
- The schedule model: named days, or a minimum a week. Week runs Monday to
  Sunday.
- Streak rules, including the graced week keeping the days already counted.
- Pass tests: count, threshold with a direction, and both at once.
- The module interface and the registry. Sleep and Gym as the first two, chosen
  because they are the two shapes: windowed daily, and weekly minimum.
- Grace per activity per calendar month.

**Tests:** the whole of this phase is domain code with no database. Period
boundaries, every streak case in `ACTIVITIES.md`, both threshold directions,
grace, and the frequency week judged at week end.

**Done when:** `bun run test` covers every rule in `ACTIVITIES.md` and the two
modules score correctly against fixtures.

## Phase 2 — Config and control

- `activity_types`, `app_settings`, both append-only with `effective_at`.
- The one cached read, tagged `app-config`, invalidated on save.
- Resolution as-of, including "judged against the settings when the period
  closed" (decision 65).
- Admin Controls, Groups, and the save-then-confirm flow with the generic sheet.
- `notices` and the blocking overlay.

**Done when:** money can be switched off app-wide, on for one group, and a
period straddling the switch is judged correctly by a test.

## Phase 3 — The other ten modules

Food, Supplements, Office, Study, Steps, Water, Reading, Screen, Nightfast,
Sugar-free. Each is one file. If any of them needs engine changes, Phase 1 got
the interface wrong and it is fixed there, not worked around here.

**Done when:** all twelve configure screens render from their specs and every
row in the Configure section of `SCREENS.md` is ticked.

## Phase 4 — Check-in

- The five check-in kinds, drawn by the engine from `checkin.kind`.
- Idempotent writes, one event a check-in, through `recordEvent()`.
- Invariant 9 holds: nothing is ever recorded on a GET.
- Rate limits on the write path.

**Done when:** a check-in can be made for all twelve types in preview, and
replaying the same check-in twice changes nothing.

## Phase 5 — Evidence

- Client compression and EXIF stripping.
- Presigned PUT to R2, the pending row, the confirm callback.
- The check-in page with the photo slot, Send blocked when required, the red
  cross to remove.
- The camera and confirm screens.
- The retention sweep, and the orphan sweep for files with no confirmed row.
- **The storage maths.** Photos a user a day, compressed size, cost at 7, 30 and
  90 days. Retention is 30 days until this says otherwise.

**Done when:** a photo can be taken, attached, sent and seen, and killing the
browser mid-upload leaves no check-in and no orphan after the sweep.

## Phase 6 — Scoring and reputation

- The nightly cron: close, score, outcomes, reputation, sweep.
- The lazy close on read, sharing one implementation with the cron.
- `reputation_daily`, the curve, the breadth ceiling, drift, idle decay, the
  7-day settling window.
- The global score over shared activities only.
- `bun run verify` extended to reputation.

**Done when:** verify reports no drift over a seeded month, and the target
properties in `REPUTATION.md` hold against a simulation.

## Phase 7 — Groups

- Accepted types, sharing with the evidence checkbox, the join flow including
  setting up an untracked type.
- The four hub tabs, group stats, the full ledger.
- Fines: owner-set per activity, split among the members who passed that period,
  exact sums (invariant 7).
- Leaving: money retained, everything else invisible.

**Done when:** two seeded members can miss, be fined, settle, and every row in
the Groups section of `SCREENS.md` is ticked.

## Phase 8 — Surfaces

- Home, all four states plus the notice overlay.
- Activities and the catalog.
- Stats: the overview and the four chart kinds.
- Settings, sharing, delete data.
- Admin Overview, Users, Insights, Ops.

**Done when:** every remaining row in `SCREENS.md` is ticked.

## Phase 9 — Before anyone uses it

- Consent form and policies (`TRUST-SAFETY.md`).
- Data deletion: specific, all, account, with the ledger rule.
- Security review, then the deliberate attempt to break it: check-in replay,
  back-dating, fetching another group's evidence URL, escalating to owner,
  scrubbing reputation by un-sharing, uploading a non-image, uploading something
  enormous, deleting an account with money outstanding.
- CONTRIBUTING and the "adding an activity type" walkthrough.

**Done when:** every item on that list has been tried and what fell over is
fixed.

## The cutover

Not a phase, but the list that must not be improvised on the day.

1. Point Vercel Production's `DATABASE_URL_POOLED` and `DATABASE_URL_DIRECT` at
   the APAC project.
2. `bun run migrate:production` against it.
3. Add `"regions": ["sin1"]` back to `vercel.json`. It was removed after Phase 0
   because production sat in `us-east-2` and a tag would have moved the
   functions away from their database.
4. Bump `package.json`, tag, push. The workflow deploys and promotes.
5. Delete the old Neon project after a week of nobody complaining.

## Order notes

- **Phase 1 before anything visual.** Every screen assumes periods, schedules
  and streaks behave. Building UI first means building it twice.
- **Phase 2 before Phase 3**, because a type that cannot be enabled cannot be
  tested end to end.
- **Phase 5 after Phase 4**, so a check-in exists before a photo attaches to it.
- **Phase 6 after Phase 5**, because fines need evidence rules settled and the
  cron sweeps evidence.
- Phases 7 and 8 can overlap. Phase 9 cannot start until both are done.
