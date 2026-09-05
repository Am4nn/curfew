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
   storage, 60-day auto-delete. See `EVIDENCE.md`.
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
| 8 | Evidence is ephemeral, auto-deleted after **60 days** (decision 101 settled the number) | 2026-09-02 |
| 9 | Reputation is a running 0 to 1000 score, per user per group, starting at 200 | 2026-09-02 |
| 10 | A **global reputation** sets a user's starting score in a new group, bounded 100 to 300, and never affects the live score afterwards. It is **shown to its owner** at the top of Activities and to nobody else, and is disclosed in the consent form | 2026-09-02 |
| 11 | Gains shrink as the score climbs and losses soften too. 1000 is asymptotic. The top carries a distinct title (**decision 122** replaces the 950 threshold with a record) | 2026-09-02 |
| 12 | Ranks: DOUBT, INTENT, PRACTICE, DISCIPLINE, UNBROKEN, plus IMMACULATE (**decision 122**: UNBROKEN from 900, and the title is 60 clean days rather than a score) | 2026-09-02 |
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
| 57 | The sheet carries an unticked "tell users what changed" checkbox. **The notice is composed from the sheet's own blocks, never typed.** An admin who has just read what a change does should not write it out again, and a hand-written notice can claim something the change did not do | 2026-09-03 |
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
| 77 | A frequency streak **counts up live and is taken back**. Each session day adds 1 immediately; a week that misses its minimum resets to 0, or holds at the week's opening value when grace covers it. The number can go down | 2026-09-03 |
| 78 | The module interface keeps `evaluate(input)` and gains a **declarative envelope** around it: name, icon, defaults, evidence rule, check-in kind, chart kind. `ARCHITECTURE.md`'s `pass(periods, config)` sketch is withdrawn: it carries no timezone, period or steps, so sleep cannot score three windows from it | 2026-09-03 |
| 79 | **The engine owns the schedule**, the module owns its own numbers. Schedule, day boundary and grace are engine fields with one shared schema; windows, targets and thresholds live in the module's `configSchema`. The period unit is derived from the schedule rather than stored beside it, so the two can never disagree | 2026-09-03 |
| 80 | A notice applies only to **accounts that existed when it was published**. Somebody who joins later never knew the old behaviour, so blocking their first screen with news about it is noise | 2026-09-03 |
| 81 | Notices are **merged per user at read time**, never queued and never merged as rows. One overlay carries every item that user has not acknowledged, and one "Got it" clears all of them. A row-level merge would be wrong the moment one user has acknowledged a notice and another has not. An admin is never blocked from publishing | 2026-09-03 |
| 82 | **"+ Add a type" is dropped from admin Controls.** A type is code, not data, and `sync:activities` already guarantees a row for every registered module, so the list is complete by construction. The button promised something the architecture cannot do | 2026-09-03 |
| 83 | A user's activity **settings** stay scoring config, future-dated in `user_activity_config` (invariant 4), but the **on/off switch** is operational and immediate, in `user_activities` with `effective_at`. A future-dated switch-off would score the day you quit as a miss, which is exactly the retroactive miss decision 59 forbids | 2026-09-03 |
| 84 | **Config timestamps are stamped by the application, never by the database's `now()`.** Neon in Singapore measured ~400ms ahead of a local machine, so a database-stamped row is briefly in the future and `resolveAt` skips it: an admin who saved a switch and reloaded would see nothing happen. One clock for the write and the read, and it is the app server's (invariant 8) | 2026-09-03 |
| 85 | **One Food check-in is a meal: a photo and its calorie figure, sent together.** Three of them make the day. The count comes from how many check-ins exist, so there is no separate counter and the photo and the number can never disagree. `ARCHITECTURE.md` listing Food under both `counter` and `camera` was a contradiction; it is `camera` | 2026-09-03 |
| 86 | **Study passes on its minutes target when one is set, and on a single check-in when it is not.** The "or" in `ACTIVITIES.md` describes two configurations, not two ways to pass one. Either-always would make the target decorative | 2026-09-03 |
| 87 | **Reading measures minutes or pages, one or the other**, chosen on the configure screen with a single target beside it. Tracking both and passing on either would leave the check-in asking for two numbers, one of them always blank | 2026-09-03 |
| 88 | A module declares its **renderable fields** beside its `configSchema`. The schema says what is valid; the fields say what it looks like. Zod cannot be introspected into a form without guessing, and a guessed control is a configure screen that does not match its mock. Three kinds cover twelve types: number, time range, segmented | 2026-09-03 |
| 89 | **A first setup lands today; a later change lands tomorrow.** Invariant 4 future-dates config so a period already being judged is not rewritten mid-flight, and a brand new activity has no such period. Future-dating the first row would mean adding an activity that does nothing until tomorrow | 2026-09-03 |
| 90 | **A step carries its own words and its own fields.** One check-in screen serves twelve types, so every sentence on it that is specific to a type comes from the type: the question, the line under the fields, what a slip costs, and which numbers to ask for. The engine prints them and never composes them (invariant 6) | 2026-09-03 |
| 91 | **The hint is computed in the browser, by the module.** "1180 so far today. The limit is 2000." becomes "1700 of 2000 once this is sent." as the number is typed. The alternative was a second implementation of the same sentence in the client, and the domain has no database imports, so it can be asked directly. It costs about 40 kB on that one route | 2026-09-03 |
| 92 | **Idempotency is a key the press carries, not one check-in a period.** Water is eight glasses and a declaration can be corrected, so uniqueness moved from (user, type, period) to (user, type, period, idem). A retry is dropped by the database; a second deliberate press is kept. Steps that must not repeat say so in the module, and the write path refuses the second one. Ceilings are 50 a period and 20 a minute | 2026-09-03 |
| 93 | **A check-in can carry a note.** One optional line, capped at 200 characters, stored on the event and never scored. It is on the V3Checkin artboard and costs nothing; the admin console still never reads check-in contents | 2026-09-03 |
| 94 | **Steps and Screen offer their rule as a control.** Both artboards draw an "at or above / at or below" switch, and both modules had the direction hardcoded. Direction was always data rather than two code paths (decision 52), so it becomes a setting: someone cutting down on steps can say so. Screen stores minutes and is set in hours, and the field declares the scale between them | 2026-09-03 |
| 95 | **A module's fields are a function of its config, and its evidence carries its own sentence.** Reading's target is labelled in the unit chosen one control above it, which a constant array cannot do. "Gallery allowed. A shot of your watch or app counts." is a sentence about steps, so it lives with Steps rather than in a table of stock phrases | 2026-09-03 |
| 96 | **Save appears only when something changed.** A tracked activity with nothing pending offers only Stop tracking, which is what every V3Cfg* board shows; a changed one offers Save, dead until it is valid, which is what V3CfgErrors shows. The two boards were reconcilable only this way | 2026-09-03 |
| 97 | **Compression is declared per type.** Food gets 1600px at quality 0.80 because a plate carries detail worth keeping; everything else gets 1280 at 0.75. It is one more type-specific fact in a file already full of them, and it is the module that knows what its photo is for | 2026-09-03 |
| 98 | **WebP where the browser can encode it, JPEG where it cannot.** About 40% fewer bytes for the same visible quality, behind one feature test. The row records which was stored. Re-encoding through a canvas is also what strips EXIF, GPS included, because a canvas only ever holds pixels | 2026-09-03 |
| 99 | **One object per check-in. No thumbnails.** At 180 KB a group feed can load the real photos, and a second object would double the presigned URLs, the sweep entries and the ways a file can be orphaned. Revisit only if a feed feels slow | 2026-09-03 |
| 100 | **Anything the browser can decode is re-encoded rather than refused.** A 40 MB HEIC becomes a 180 KB JPEG and never reaches the network at full size, so the only refusals are a source over 50 MB, refused before it is read, and a file the browser cannot decode at all. The server still caps the PUT | 2026-09-03 |
| 101 | **Retention is 60 days.** The storage maths says cost is not the constraint: fifty people at six photos a day is 3.2 GB, inside R2's free tier. The reason not to keep them longer is that an indefinite archive of people's homes, meals and gyms is a liability someone has to answer for. The check-in, the score and the streak are kept forever; only the photograph goes | 2026-09-03 |
| 102 | **The camera is in-app, on `getUserMedia`.** It is the artboard, and it is the only way "live camera, no gallery" is enforced rather than requested: the frame comes off the video stream, so no File object exists for anyone to substitute | 2026-09-03 |
| 103 | **No camera means no check-in, for a live-camera type.** Permission denied, no webcam, or an in-app browser that blocks it: the screen says so and Send stays dead. Falling back to the gallery would put a second class of evidence into the model and into every screen that shows one, and a Gym streak would stop meaning the same thing for every member of a group | 2026-09-03 |
| 104 | **Reputation always replays from the join date; a range narrows what is compared, never what is computed.** Day D depends on D-1, so a replay starting halfway starts from the wrong number and every day after it is wrong. Found by the seeded month: a bounded verify reported drift against correct rows | 2026-09-03 |
| 105 | **Gains are damped early, and a miss is priced in clean days.** A flat gain reaches the first rank in 18 days against the table's five weeks, and a flat points loss that stings at 900 is ruinous at 200. Neither pair of targets is reachable without these two changes, and two of the targets are not reachable together at all. See `REPUTATION.md` | 2026-09-03 |
| 106 | **The scoring pass writes no fines until the group model is rebuilt.** Scoring became per user and per type; fines are per group and per activity. Writing them from a half-migrated model means writing them twice. The ledger keeps every row it has | 2026-09-03 |
| 107 | **A fine with nobody who passed is not written.** A fine is a debt to specific people, so with no creditor there is no row. Keeps invariant 7 exact: every fine sums to its shares because there are always shares | 2026-09-03 |
| 108 | **A group's types live in two tables, because they answer two questions.** Acceptance is operational and append-only on an instant, so dropping a type takes effect now while a past ceiling still resolves as it stood. Fine rules are scoring config and future-dated on a date, so changing a fine cannot rewrite a period in progress. `activities` and `activity_rules` are gone; a group no longer owns an activity | 2026-09-03 |
| 109 | **Accept on an invite opens the join screen rather than joining.** Joining is where sharing is chosen, and `GROUPS.md` says a member sees exactly what the group accepts before agreeing to anything. Accepting inline would put someone in a group before they had chosen what it can see | 2026-09-03 |
| 110 | **A rejoin replays from the current join date.** The score starts from the hidden global score, never the old number, which is what stops someone leaving and rejoining to escape a bad record | 2026-09-03 |
| 111 | **Deleting keeps the event rows and detaches them.** `TRUST-SAFETY.md` left the tension between invariant 1 and the right to delete open. Settled: events are kept but stripped of anything identifying and unlinked from the person, so their history stops being theirs while everything that rebuilds from events still works. Photographs, personal fields and every derived row go outright | 2026-09-03 |
| 112 | **A user row is never hard-deleted, it is scrubbed.** Ledger rows point at it, and a debt with no counterparty is not a debt. The name and email go, sessions and linked accounts go, and signing in becomes impossible | 2026-09-03 |
| 113 | **Personal stats live at `/stats`, and `/chart` is gone.** Every artboard, every `SCREENS.md` row and the tab bar said `/stats`; `/chart` was a v2.5 name for a screen that only ever showed sleep | 2026-09-03 |
| 114 | **The consent form and the security round ship in v3.** `TRUST-SAFETY.md` marked them "after v3"; those headings predate the phase plan, and shipping a photo-sharing app to real people with no consent record and no security pass is not defensible. Content rules and reporting stay deferred: groups are invite-only, so the exposure is bounded | 2026-09-03 |
| 115 | **Consent is a blocking gate everyone passes once**, versioned, in the root layout beside the notice overlay. It blocks rather than redirects because it has to reach every screen without each one remembering to check. The same text is in Settings, because a thing you agreed to once and can never see again is not something you agreed to | 2026-09-03 |
| 116 | **`bun run break-in` is a command, not a checklist.** Every item on the security round runs against the real database and exits non-zero if anything gives, so the pass can be repeated rather than remembered | 2026-09-03 |
| 117 | **Content rules ship in v3 after all**, reversing decision 114's deferral. The rules, the liability position and the admin's right to remove and ban are in `policy.ts` beside the privacy text, shown at the same gate and readable in Settings afterwards | 2026-09-03 |
| 118 | **18 or older, and Indian law.** Money plus photographs is not a combination to have minors inside, and it keeps children's-data rules out of scope. Disputes go to the courts named in `policy.ts`; set the city before launch | 2026-09-03 |
| 119 | **Somebody else in frame without their agreement is a rule; your own face is guidance.** Banning faces outright fights the product, since a gym selfie is the honest way to prove a gym session. Photographing another person without their agreement is a removal | 2026-09-03 |
| 120 | **A report is the only route by which an admin sees a photograph**, and the fact they looked is recorded on the report. Removing a photo and removing a person are separate acts, so taking down one bad picture never quietly takes down an account | 2026-09-03 |
| 121 | **A ban never clears a debt.** Photographs go with the banned account; ledger rows stay owed and stay visible to the people owed. Otherwise getting banned would be the cheapest way to settle | 2026-09-03 |
| 122 | **IMMACULATE is a record, not a score**, reversing decisions 11 and 12. It is UNBROKEN plus 60 consecutive days with nothing missed; a day with nothing scheduled is inside the run rather than a break in it. The simulation showed 87.5% completion settling at 969 and holding the old 950 line indefinitely, and the curve saturates near the top, so no threshold on it can mean "nothing missed". UNBROKEN moves from 850 to 900 in the same pass | 2026-09-05 |
| 123 | **A group does not count the day you join it.** Reputation and money in that group start the following day; the member's own streaks and their own global record count the day exactly as they would have. Grace runs both ways, so somebody inside it neither pays a fine nor receives a share of one, which falls out of having no outcome for the day rather than needing a rule. It is shown to the whole group, because a member sitting at no score with no explanation reads as one being let off | 2026-09-05 |
| 124 | **Join and leave dates are the member's own day, not UTC.** Both are read by the scorer as day boundaries and the grace period is measured off the join date, so a UTC date hands anybody east of Greenwich who joins after midnight a grace period that has already expired | 2026-09-05 |
| 125 | **The security round borrows nobody and runs in CI.** It builds its own three people, its own admin and its own groups and removes them again, so the same round runs against a throwaway database and against preview, on every push rather than when somebody remembers. The version that found a real account by a hardcoded email and then scored it, charged it and deleted its derived rows was a destructive test pointed at a live person | 2026-09-05 |
| 126 | **The round has two halves, and the second one needs a server.** Calling a guard proves the guard exists; only a request proves the route reaches it, and a page that forgot `assertMember` passes every direct check because the direct checks call the helper that has it. The HTTP sweep carries a positive control, because a sweep for strings that never appear anywhere passes for the wrong reason | 2026-09-05 |
| 127 | **A new member's timezone is settled at the consent gate, not left to be found in Settings.** A fresh account has no `user_settings` row, so it resolves to the seeded default and anybody outside that zone is judged on somebody else's midnight with nothing on screen saying so. The gate is the one screen every member passes and it ends in one explicit press. It is written effective from their first day rather than tomorrow: invariant 4 exists because moving a boundary under a period in progress rewrites how it is judged, and at the gate no period exists | 2026-09-06 |
| 128 | **A device that disagrees with the zone on file says so, every time, not once.** The case worth catching is somebody moving country, which a prompt at signup can never see. Switch takes effect tomorrow like every config change; keeping is remembered per device and per pair of zones, because the mismatch is a fact about the device and landing somewhere new is a new question. Zones are compared by the clock they read, not by name: browsers report `Asia/Kolkata` where this runtime reports `Asia/Calcutta`, and calling that a move would be worse than saying nothing | 2026-09-06 |
| 129 | **The deploy workflow requires CI's result on the tagged SHA rather than repeating a subset of it.** Two lists of checks drift, and the deploy's copy was always the shorter one. By SHA, not by ref, because a tag can be moved to a commit CI never saw | 2026-09-06 |
| 130 | **`simulate` and `verify` run on every push.** They are integration tests in everything but name and the only things that would catch a change to the curve, the fine split or the streak rules. The 232 unit tests cover the domain, which is pure; every layer above it ran under nothing | 2026-09-06 |
| 131 | **Lint gates CI at `--max-warnings=0`, with the React Compiler on.** The compiler skips any component it cannot prove obeys the rules of React, silently, and the lint is the only place that shows. A warning that does not fail is a warning nobody reads | 2026-09-06 |
| 132 | **A deprecated dependency fails the build unless it is written down.** The registry's `deprecated` note is the only warning a package gets to give and it scrolls past during an install. `bun audit` and `check:deps` run in their own job, because both read a live registry and can go red on a morning nothing changed | 2026-09-06 |
| 133 | **A paused day is a day with nothing scheduled.** Not a miss. Everything else about a pause falls out of that one sentence rather than needing a rule of its own: no fine can arise because nothing was scheduled to miss, and reputation is not marked down because there was nothing to mark | 2026-09-06 |
| 134 | **A pause ends every streak, and grace does not cover one.** A streak is consecutive days and a pause is a gap. This is what removes the need for a quota: pausing every weekend would reset the streak every weekend, and a weekday-only schedule already does the honest version of the same thing. An earlier draft protected the streak, which made a pause strictly better than being present and needed an allowance, a reset date and an argument about the member stranded abroad on day 31 | 2026-09-06 |
| 135 | **Reputation still settles while paused, and that decay is now 1% of the score a day rather than a flat 3.** Proportional is the same shape the gains already have, pointed the other way, so a 900 falls faster than a 300 and the two are not docked the same 90 points for the same 30 quiet days. Two months of silence reads as 523 rather than 738. Away four days costs nothing; away four weeks costs what any four quiet weeks cost | 2026-09-06 |
| 136 | **Three days minimum, declared in advance, no limit on how many.** Three so it is not a one-night excuse. In advance because declaring afterwards converts a miss that already happened into a day that was never scheduled, which is the erase that closed retroactive un-sharing (decision 15). No limit because decision 134 already charges for it | 2026-09-06 |
| 137 | **One pause covers every group and the personal record, and the group sees it with its dates.** Not per group: a person is away or they are not. Visible for the same reason the join grace period is (decision 123), a member sitting at nothing reading as somebody who does not turn up, and with the dates because a pause that keeps being extended is worth seeing as such | 2026-09-06 |

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

- **Retention.** Settled at 60 days by the storage maths in Phase 5 (decision 101).
- **Reputation constants.** The target properties in `REPUTATION.md` are the
  spec; the constants are tuned in Phase 6 until those properties hold.
- **Fresh start.** Confirmed, but Phase 0 asks once more before anything is
  dropped, because it is the only irreversible step in the plan.

Settled and recorded elsewhere: the day boundary is fixed by the type
(decision, `ACTIVITIES.md`), activity icons are drawn in the mocks and listed in
`SCREENS.md`, and every architectural fork is decided in `ARCHITECTURE.md`.
