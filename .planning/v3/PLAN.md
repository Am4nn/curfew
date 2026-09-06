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
- **The storage maths.** Done, in `ARCHITECTURE.md`. Six photos a day at about
  180 KB puts fifty people at 3.2 GB over a 60-day retention, inside R2's free
  10 GB. Retention is **60 days** (decision 101).

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

Per-group reputation waits for Phase 7's sharing, since its ceiling is shared
types over accepted types. Phase 6 ships the curve, the scoring rewrite for all
twelve types, and the global score, which is full breadth and needs no group.

## Phase 7 — Groups

- Accepted types, sharing with the evidence checkbox, the join flow including
  setting up an untracked type.
- The four hub tabs, group stats, the full ledger.
- Fines: owner-set per activity, split among the members who passed that period,
  exact sums (invariant 7).
- Leaving: money retained, everything else invisible.

**Done when:** two seeded members can miss, be fined, settle, and every row in
the Groups section of `SCREENS.md` is ticked.

The model changed here, not just the screens: `activities` and `activity_rules`
are gone, and a group's types live in `group_activity_types` (accepted,
operational) and `group_activity_rules` (fines, future-dated). See
decision 108.

## Phase 8 — Surfaces

- Home, all four states plus the notice overlay.
- Activities and the catalog.
- Stats: the overview and the four chart kinds.
- Settings, sharing, delete data.
- Admin Overview, Users, Insights, Ops.

**Done when:** every remaining row in `SCREENS.md` is ticked.

Deleting data landed here rather than in Phase 9, account deletion included.
`/chart` became `/stats`, which is what every artboard says.

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

Nothing is carried across (decision 22, reconfirmed 2026-09-07). The old
project is deleted, not migrated, and `curfew-apac` is emptied first: it holds
the accounts and groups that were made while building, and they would otherwise
be what the live site serves on its first day.

1. **Empty `curfew-apac`'s default branch.** In the Neon SQL editor, against
   that branch and no other:

   ```sql
   drop schema public cascade;
   create schema public;
   ```

   That takes `_migrations` with it, which is the point: step 3 then applies
   every numbered file from empty, the same path CI proves on every push.
   It does not touch `curfew-apac-dev`, which is a branch of its own and keeps
   whatever it had.
2. Point Vercel Production's `DATABASE_URL_POOLED` and `DATABASE_URL_DIRECT` at
   `curfew-apac`'s default branch, and `.env.production` at the same two values.
   Preview already points at `curfew-apac-dev`.
3. `bun run migrate:production` against it, then check `activity_types` carries
   twelve rows, all disabled.
4. **Make an admin again.** The wipe took every account with it, and a fresh
   database has nobody who can approve anybody, so the first sign-in lands on
   the pending screen with no way off it. Sign in once, then run the statement
   under "Approve yourself" in the README against the same branch. Do this
   before the tag: the alternative is discovering it on the live site.
5. Enable the activity types the members will use, from admin Controls. Every
   one is disabled after a sync, and a type with no row is not offered.
6. `vercel.json` already pins `sin1`. Check it is still there: it is only
   correct once step 2 has moved the database to APAC, and until then the pin
   is the reason no tag may be cut.
7. Bump `package.json` to `3.0.0`, push it to `main`, and let CI finish. The
   deploy workflow reads CI's result by SHA and refuses a tag CI never saw.
8. Tag and push. The workflow deploys and promotes.
9. `bun run check:cors:production`, and open the live site to check the admin
   header reads `v3.0.0`.
10. Delete the old `curfew` Neon project after a week of nobody complaining.

**Dev after the cutover.** `bun run dev`, `bun run migrate` and `bun run verify`
all read `.env.preview`, which is now the `curfew-apac-dev` branch, so a
migration written after the cutover is applied twice: once there and once with
`migrate:production`. Reset the branch from its parent in Neon when it drifts.

## Order notes

- **Phase 1 before anything visual.** Every screen assumes periods, schedules
  and streaks behave. Building UI first means building it twice.
- **Phase 2 before Phase 3**, because a type that cannot be enabled cannot be
  tested end to end.
- **Phase 5 after Phase 4**, so a check-in exists before a photo attaches to it.
- **Phase 6 after Phase 5**, because fines need evidence rules settled and the
  cron sweeps evidence.
- Phases 7 and 8 can overlap. Phase 9 cannot start until both are done.
