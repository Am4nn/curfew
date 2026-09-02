# SCOPE.md — Curfew v3, the master scope

Decisions taken by Aman between 2026-09-01 and 2026-09-02 in a brainstorm round
before any mock or code. This file is the index and the contract. The detail
lives in the companion `v3-*` docs. When mocks or implementation disagree with
these files, that is drift: fix the code or amend the doc deliberately, never
silently.

Companion docs:

| File | Covers |
|---|---|
| `ACTIVITIES.md` | The activity model, periods, streaks, grace, pass tests, the catalog |
| `EVIDENCE.md` | Photo capture, the camera UI, per-window evidence rules, storage, retention |
| `REPUTATION.md` | The score, its curve, breadth, decay, rebuildability |
| `RANKS.md` | Rank names, bands, colors, icons |
| `GROUPS.md` | Sharing, accepted types, money, leaving, the group evidence view |
| `UX.md` | Navigation, Home vs Activities, visual language |
| `ARCHITECTURE.md` | Runtime, schema, the module spec, scoring jobs, uploads, testing |
| `CONFIG.md` | The module registry, app settings, the sync script, caching |
| `SCREENS.md` | Every artboard, its route, and the review gate that stops drift |
| `PLAN.md` | The nine build phases and what done means for each |
| `TRUST-SAFETY.md` | Consent, policies, moderation, deletion, the post-v3 security round |

`../BACKLOG.md` holds what v3 pushes out (RLS, DB-backed roles). `../PLAN-v3.md` is
superseded by this set and now points here.

## The reframe

Curfew is a **personal habit tracker with evidence**. Groups are an opt-in
accountability layer on top, not the point.

- A user tracks their own activities and keeps a streak per activity. This works
  with zero groups.
- A new user is enrolled in **no** activities and joins **no** groups. They opt
  into everything.
- Activities are **customizable per user**: period, frequency, windows, pass
  threshold, grace, evidence rules. Two people can both track Gym and be held to
  different things.
- **Evidence is a first-class feature.** Most activities can carry a photo taken
  live in the app. Evidence is off, optional or required per activity and per
  window, by the user's own choice.
- **Groups are always invite-only.** Open signup is a later release and even then
  only means anyone can hold an account, never that groups become discoverable.
- **Reputation is always on** in a group. **Money is a per-group toggle** the
  creator sets. Money remains IOU tracking only, no payment integration
  (PRD section 8).
- The app must be fast and dumb to use. Zero time wasted. A check-in is one tap,
  or one tap and a shutter press when evidence is required.

## What v3 ships

1. **Engine rework: activity-defined periods.** v1 hardcodes a daily
   noon-to-noon period everywhere. v3 makes the period, the scheduled days and
   the pass test properties of the activity. This is the real work and comes
   first. See `ACTIVITIES.md`.
2. **Activity catalog and per-user customization.** A user picks activities from
   a catalog and configures each one. Adding a new activity type must be cheap.
3. **Evidence capture.** Own camera UI, live capture, per-window rules, object
   storage, 30-day auto-delete. See `EVIDENCE.md`.
4. **Reputation and ranks.** A 0 to 1000 running score per user per group, six
   rank labels with their own colors and icons. See `REPUTATION.md` and
   `RANKS.md`.
5. **Groups reshaped.** A group declares accepted activity types; a member
   chooses per type whether to share, and whether evidence goes with it. Money
   is a group toggle with owner-set fines per activity. See `GROUPS.md`.
6. **Group evidence view.** A dated log of the photos members shared.
7. **Data controls.** Settings gains delete-specific-data, delete-all-data and
   delete-account. See `TRUST-SAFETY.md`.
8. **Five-tab navigation.** Home, Activities, Groups, Stats, Settings. See
   `UX.md`.

## What v3 does not ship

- **Objections.** Deferred to the release after v3. When they land they are
  flag-only and affect reputation in that one group. Nothing about them is built
  now, but the data model must not make them impossible.
- **Open signup.** Invite-only stands.
- **Native app.** Web only until there are real users.
- **AI nutrition derivation** from a food photo. A future opt-in capability.
- **Evidence types beyond images.** The model leaves room; only images ship.
- **Health integrations** (Apple Health, Google Fit). Steps stays manual, with an
  optional photo of a watch or app screen.
- **Paid tiers.** Not being considered.
- **RLS and DB-backed roles.** See `../BACKLOG.md`.

## Decision log

Every decision below was taken explicitly. If one is revisited, amend it here.

| # | Decision | Taken |
|---|---|---|
| 1 | Curfew is a personal habit tracker; groups are opt-in accountability | 2026-09-01 |
| 2 | Streaks are always counted in **days**, per user per activity | 2026-09-02 |
| 3 | A streak counts days on which the activity was actually done, and a frequency-based week must meet its minimum for that week's days to count | 2026-09-02 |
| 4 | Activities are fully customizable per user, including multiple check-in windows a day | 2026-09-02 |
| 5 | Grace is per activity, per calendar month. It protects the **streak only**. The fine still applies and reputation still dips. This reverses v1/v2, where grace waived the fine | 2026-09-02 |
| 6 | **Evidence is fixed by the activity type**, not chosen by the user: off, optional or required, and live-capture or gallery-allowed. The configure screen states it, never offers it. This replaces the earlier version where the user chose | 2026-09-02 |
| 7 | When evidence is required, the camera opens as part of check-in. There is no path to a pass without it | 2026-09-02 |
| 8 | Evidence is ephemeral, auto-deleted after **30 days** (placeholder until the storage maths) | 2026-09-02 |
| 9 | Reputation is a running 0 to 1000 score, per user per group, starting at 200 | 2026-09-02 |
| 10 | A **global reputation** sets a user's starting score in a new group, bounded 100 to 300, and never affects the live score afterwards. It is **shown to its owner** at the top of Activities and to nobody else, and is disclosed in the consent form | 2026-09-02 |
| 11 | Gains shrink as the score climbs and losses soften too. 1000 is asymptotic. Above 950 is a distinct title | 2026-09-02 |
| 12 | Ranks: DOUBT, INTENT, PRACTICE, DISCIPLINE, UNBROKEN, plus IMMACULATE above 950 | 2026-09-02 |
| 13 | Rank is a band on the number, per group. Ranks are comparable within a group | 2026-09-02 |
| 14 | The reputation ceiling scales with **breadth**: how many of the group's accepted types you share | 2026-09-02 |
| 15 | On un-sharing, or an owner removing a type, the score freezes and drifts down to the new ceiling. No cliff | 2026-09-02 |
| 16 | Sharing granularity is two toggles only: group accepts a type, member shares a type (plus evidence yes or no). No per-day or per-photo choices | 2026-09-02 |
| 17 | On leaving a group, money due is retained. Streaks, reputation and evidence stop being visible to that group | 2026-09-02 |
| 18 | Money is a per-group toggle set by the creator. Fines are owner-set, per activity | 2026-09-02 |
| 19 | Groups are always invite-only | 2026-09-02 |
| 20 | Web only for v3 | 2026-09-02 |
| 21 | Home shows today's completion; Activities is the manager. Five bottom tabs | 2026-09-02 |
| 22 | **Fresh start** on migration. v3 does not carry v1/v2 data | 2026-09-02 |
| 23 | Objections deferred, flag-only when they land, affecting reputation in that group only | 2026-09-02 |
| 24 | Activity modules follow SOLID and stay highly extensible, because the repo is open source and will take outside PRs | 2026-09-02 |
| 25 | Backend stays in Next.js. Only object storage moves out. No service split, no paid tier | 2026-09-02 |
| 26 | Group hub tabs are Overview, Evidence, Standing, Settings, the same four in every group. Standing carries reputation always and money when the group tracks it | 2026-09-02 |
| 27 | One group Settings tab, not a Rules/Settings split: accepted activity types and fines are the same owner job | 2026-09-02 |
| 28 | The evidence tab loads today and yesterday only, older days on demand | 2026-09-02 |
| 29 | Rank rings are rejected. Two icon sets mocked (custom geometric ladder, or the Lucide/Phosphor idiom); choice pending | 2026-09-02 |
| 30 | Glow is allowed on IMMACULATE only, as a deliberate exception to the CLAUDE.md ban | 2026-09-02 |
| 31 | Both activity entry points, Your activities and Add activity, open the same configure screen; a tracked activity gets a stop control, an untracked one gets prefilled defaults and an add button | 2026-09-02 |
| 32 | Joining a group can enrol you in an activity you do not track yet: set it up first, then share | 2026-09-02 |
| 33 | Nav badges are a round dot only, no count: the Groups tab marks pending invites, the Admin header link marks pending admin work | 2026-09-02 |
| 34 | **One check-in page for every activity that needs anything.** No evidence at all is a single tap on Home. Everything else opens the same page: photo slot, then the activity's fields, then Discard and Send. Replaces the earlier split where required opened the camera directly | 2026-09-02 |
| 35 | When a photo is required, **Send stays disabled until one is attached**. An attached photo carries a red cross to remove it | 2026-09-02 |
| 36 | Activity types have one-word names and a one-line description: Sleep, Gym, Food, Supplements, Office, Study, Steps | 2026-09-02 |
| 37 | Configure uses real controls: steppers, segmented switches, day pickers, time ranges, number fields. No chevron-only rows | 2026-09-02 |
| 38 | Sharing is one toggle per activity, plus a **checkbox, "share evidence with this group"**. Evidence means the photo and any extra fields, not the photo alone | 2026-09-02 |
| 39 | Rank icons are the Lucide idiom, ending on a crown for IMMACULATE. Geometric rings and bars are both rejected | 2026-09-02 |
| 40 | Reputation is shown as a coloured rank icon plus a coloured number. The rank word is dropped from list rows. Streak keeps the only gradient in the app | 2026-09-02 |
| 41 | Palette A for ranks: the colours already in the app's tokens | 2026-09-02 |
| 42 | Rank icons settled: shield slashed (DOUBT), sprout (INTENT), target (PRACTICE), shield ticked (DISCIPLINE), summit (UNBROKEN), crown (IMMACULATE) | 2026-09-02 |
| 43 | **Money can vanish from the app entirely.** If no group the user belongs to tracks money, Home shows no balances and no screen mentions money | 2026-09-02 |
| 44 | 12-hour clock with AM/PM everywhere | 2026-09-02 |
| 45 | Type evidence rules fixed: Sleep required on the confirm window, Gym required, **Food requires the photo and the calorie figure**, Supplements required, Study required, Office optional, Steps optional with gallery allowed | 2026-09-02 |
| 46 | Supplements is once a day with no window. Office defaults to 10 AM to 2 PM | 2026-09-02 |
| 47 | Every input validates in place: bad values are marked where they are, with the reason, and Save stays disabled until they clear | 2026-09-02 |
| 48 | The catalog says to ask an admin for a missing type. Nothing in the UI mentions the project being open source | 2026-09-02 |
| 49 | Five more types: Water, Reading, Screen, Nightfast, Sugar-free. Twelve in total | 2026-09-02 |
| 50 | **Abstinence types** (Nightfast, Sugar-free) pass by declaration, not by silence. One check-in a day, "it held" or "I slipped". Silence is a miss, or the app would reward never opening it (invariant 2) | 2026-09-02 |
| 51 | Abstinence types carry **no evidence**. Nothing can prove absence | 2026-09-02 |
| 52 | A threshold can run in either direction: Steps passes at or above, Screen passes at or below | 2026-09-02 |
| 53 | The **global score counts only shared activities**, so a private experiment can never hurt it | 2026-09-02 |
| 54 | A newly added or newly shared activity has a **7-day settling period** before it can move reputation. Fines still apply from day one | 2026-09-02 |
| 55 | The schedule is one control: a day row with an ANY cell that turns it into a minimum a week. Period is not a separate field | 2026-09-03 |
| 56 | **Nothing an admin toggles saves on the flip.** A changed switch is marked unsaved, a bar offers Discard or a red Save, and Save opens a sheet built from the pending changes with the consequences of each | 2026-09-03 |
| 57 | The sheet carries an unticked "tell users what changed" checkbox | 2026-09-03 |
| 58 | A user notice is a **blocking overlay on every route**, not a banner. The app does nothing until it is acknowledged. One at a time, and acknowledging is final | 2026-09-03 |
| 59 | **Every calculation resolves the on/off state as it stood on the period being scored.** Turning anything off never rewrites history and never creates a retroactive miss. See the table in `ACTIVITIES.md` | 2026-09-03 |
| 60 | Admin console is Overview, Users, Insights, Controls, Ops. Overview approves pending users inline. Controls regulates the whole app. Admin counts behaviour and never reads it | 2026-09-03 |
| 61 | Group stats hang off the group Overview rather than taking a fifth tab | 2026-09-03 |
| 62 | Stats is an overview plus a per-activity picker, and the chart follows the type | 2026-09-03 |
| 63 | A type is offered only when it has a row in `activity_types` **and** that row is enabled. `bun run sync:activities` reconciles the registry into rows, disabled, and runs inside `bun run migrate`. CI runs it with `--check` | 2026-09-03 |
| 64 | `app_settings` is append-only and effective-dated, same as every other config table. A change is a new row | 2026-09-03 |
| 65 | **Admin switches take effect immediately**, so the column is `effective_at timestamptz`. A period is judged against the settings as they stood **when the period closed**. This is a narrow carve-out from invariant 4, which continues to govern scoring config | 2026-09-03 |
| 66 | Money resolves app-wide, then a per-group admin override, then the owner's own toggle. An owner can never turn money on where an admin has it off | 2026-09-03 |
| 67 | Admin gains a **Groups** tab: the group directory, per-group money, and archive rather than delete. Six admin tabs | 2026-09-03 |
| 68 | Config is read through one `unstable_cache` call tagged `app-config` with a 60 second TTL, invalidated by `revalidateTag` on every admin save. Scoring never reads the cache, it resolves as-of the period | 2026-09-03 |
| 69 | **Evolve the schema, rewrite the scoring core.** Events, ledger, groups and the effective-dated config pattern are kept. `periodStart`, the pass tests, the module interface and the check-in state machine are rewritten | 2026-09-03 |
| 70 | Periods close on a **nightly cron, with a lazy close on read** so nothing is ever wrong because a job was late. One implementation, two callers, idempotent | 2026-09-03 |
| 71 | Photos go **straight to R2 by presigned PUT**. No image passes through a serverless function. The check-in is the confirm callback, so a check-in never exists without its photo | 2026-09-03 |
| 72 | Reputation is a **nightly batch**, one row a user a group a day, replayable from the join date and checkpointed monthly | 2026-09-03 |
| 73 | An activity module is a **declarative spec with no React in it**. Five check-in kinds cover twelve types: tap, counter, number, camera, declare. A new shape extends the engine rather than living in a module | 2026-09-03 |
| 74 | Drift is prevented by a **screen inventory and a review gate** (`SCREENS.md`), not by screenshot tests | 2026-09-03 |
| 75 | Rate limiting on check-ins and upload URLs through **Upstash Redis** | 2026-09-03 |
| 76 | Runtime is **Vercel, Neon, R2, Vercel Cron, Upstash** | 2026-09-03 |

## Invariants

The v1 invariants in `../../CLAUDE.md` all still hold. Three need a note.

- **Invariant 1 (`events` is the only source of truth).** Reputation is a running
  score, but it must be **replayable** from events between the join date and
  today. Store it like `activity_scores`: derived, rebuildable, never the record.
  Monthly checkpoints are allowed as an optimisation, not as truth.
- **Invariant 4 (config is insert-only with a future `effective_from`).** Needs
  rewording: it governs **scoring config**, meaning a user's windows and targets
  and a group's fines and grace. App settings are operational, still append-only
  and still resolved as-of, but they take effect immediately. See `CONFIG.md`.
- **Invariant 5 (resolve config as it stood on the period being scored).** With
  customizable activities this matters more, not less. A config change lands at
  the **next period start** for that activity, weekly activities included.
- **Invariant 6 (nothing outside a module knows what "sleep" means).** v3 makes
  this load-bearing. Adding an activity type must mean adding a module, never
  editing the engine.

**Fresh start (decision 22)** means the v1 sleep tables and ledger are not
migrated. That is only defensible because the user base is tiny. Confirm this is
still true before implementation begins.

## Open questions

Three left, and none of them block the start of the build.

- **Retention.** 30 days is a placeholder until the storage maths in Phase 5.
- **Reputation constants.** The target properties in `REPUTATION.md` are the
  spec; the constants are tuned in Phase 6 until those properties hold.
- **Fresh start.** Confirmed, but Phase 0 asks once more before anything is
  dropped, because it is the only irreversible step in the plan.

Settled and recorded elsewhere: the day boundary is fixed by the type
(decision, `ACTIVITIES.md`), activity icons are drawn in the mocks and listed in
`SCREENS.md`, and every architectural fork is decided in `ARCHITECTURE.md`.
