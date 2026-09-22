# SCHEMA.md — What v4 adds to the database

Migrations 0033 upward. Every one of them is **additive**, which matters for a
reason `.planning/RELEASE.md` spells out: an additive migration goes before the
tag and a hostile one after the promote, because the live version is still
running between them. **v4 has no hostile migration and it must stay that way.**

Read `DECIDED.md` for why any of this exists and `PLAN.md` for when it is built.
The phase each migration belongs to is named beside it.

The invariants are unchanged. `events` is still the only source of truth (1),
scoring still reads only `checkin.*` (2), `ledger_entries` is still append-only
(3), and scoring config is still insert-only with a future `effective_from` (4).
**Nothing v4 adds is allowed to be a second source of truth for a fact that
already lives in `events`.**

---

## First: two corrections to the draft this file replaces

Written down because the first draft was wrong in ways that would have cost a
release, and both errors came from reasoning about the schema instead of reading
it.

### The foreign key it planned around does not exist

The draft said `activity_outcomes` holds
`FOREIGN KEY (user_id, type_key, period_start) REFERENCES activity_scores (...)`
and that the monk migration had to drop and re-add it.

It was declared in `migrations/0002_app.sql:270-271` and **dropped in
`migrations/0012_group_model.sql:72`**, when the table was dropped and recreated
for the group model. Drizzle never declared it (`src/db/schema/app.ts:184-208`
has a `primaryKey` and nothing else). `scripts/break-in/direct.ts:251-260` is
the proof: it inserts outcome rows with no matching score rows and passes.

So `ALTER TABLE activity_scores DROP CONSTRAINT activity_scores_pkey` would have
failed outright against a real database, and the safety the draft leaned on was
imaginary.

### `activity_types` is not where a per-type attribute goes

The draft offered `ALTER TABLE activity_types ADD COLUMN category`.
`activity_types` is **append-only, effective-dated admin-toggle history with no
unique constraint on `type_key`** (`migrations/0006_activity_types.sql`). It
records whether a type is *available*, resolved as "the latest row at or before
an instant". A per-type attribute in it would have one value per historical row.

`category` is a field on `ActivityType` in `src/domain/types.ts`, in code, and
nowhere else. **There is no migration for it.**

---

## 0033 — Member-written conditions, Phase 1

A condition somebody names themselves is the same held-or-slipped module with a
different label, so it needs a place to keep the label. Per user, not global:
`activity_types` is the registry and a member cannot write to the registry.

```sql
CREATE TABLE user_conditions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    retired_at  timestamptz
);
CREATE UNIQUE INDEX user_conditions_live_idx
    ON user_conditions (user_id, lower(label)) WHERE retired_at IS NULL;
CREATE INDEX user_conditions_user_idx
    ON user_conditions (user_id) WHERE retired_at IS NULL;
```

**`type_key` was in this draft and is not in the table.** It was described as
"the shared held-or-slipped module", which would have been the same literal
string `condition` on every row: a column with one value is not a column. The
key is **derived** the other way, `condition:<id>`, and `getActivityType`
strips the prefix, so one module stands behind all of them and the hundred-odd
callers of that function never learn there is such a thing.

Storing it would also have been a second place the key lives, and the two could
disagree. Built 2026-09-22.

**The label is written into the config blob as well**, which looks like two
sources for one fact and is not: `listUserActivities` merges this table's label
over the blob's on every read, so the copy can never be read stale. What the
copy buys is that a raw `user_activity_config` row parses on its own, without a
join, anywhere that has one in hand. A rename is one UPDATE here rather than a
rewrite of every historical config row.

**Retired rather than deleted**, because a check-in made against it is an event
and events do not go away. A retired condition stops being offered and its
history stays readable, which is the same shape as stopping tracking anything
else.

**It carries no category, and that is the rule rather than an omission** (1.19).
Nothing can know whether "no doomscroll" is a MIND thing, and 1.16's required
categories exist so the number means the same for everybody.

---

## 0034 — Monk mode's set, Phase 3

Effective-dated and insert-only, which is invariant 4 applied to a view (1.16).
Add Cold shower today and it counts from tomorrow; September does not move.

```sql
CREATE TABLE monk_sets (
    user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version         serial PRIMARY KEY,
    effective_from  date NOT NULL,       -- app rejects <= CURRENT_DATE
    type_keys       text[] NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX monk_sets_user_idx ON monk_sets (user_id, effective_from DESC);
```

**The percentage is not stored.** Passed over scheduled, computed from
`activity_scores` at read time, rebuildable because the things under it already
are. Storing it would make it a second source of truth for a derivable fact,
which is invariant 1.

**0 of 0 is not 0%.** A day where nothing in the set was scheduled has no score;
the read layer returns null rather than zero and the screen draws a dash.

---

## 0035 — The monk bar, Phase 3

1.29 chose a stricter bar on a few types: Water is 8 normally and 10 for monk
purposes. So one activity carries two verdicts for one day.

**One nullable boolean on the existing row.** Not a second row, not a second
table, not a key inside `detail`.

```sql
ALTER TABLE activity_scores
    ADD COLUMN IF NOT EXISTS monk_passed boolean;
```

```
NULL  this module declares no stricter bar, so the monk verdict IS the own
      verdict and the read layer falls back to `passed`.

      NULL DOES NOT MEAN EXCLUDED FROM THE DENOMINATOR. If it did, adding Cold
      shower to a monk set would silently shrink the denominator, and the
      number would measure the two or three types that happen to have a bar
      while reading as though it measured everything. 1.16 says the aggregate
      reads `passed`; the bar is an exception for a few types, not the rule.

      This is the one thing a later reader will get backwards.
```

### Why this shape and not a discriminator in the primary key

1.29 accepted *"a second scope on `activity_scores`, a second pass, and `verify`
diffing both"*. **Two thirds of that price survives and is cheap. The second
scope was priced against the foreign key that does not exist, and it goes.**

- **Additive.** A discriminator in the primary key is a *hostile* migration: the
  running version's upsert names three columns (`src/server/scoring.ts:855-856`)
  and Postgres rejects an `ON CONFLICT` with no matching constraint. `closeOutstanding`
  (`scoring.ts:751`) runs on every page read, so that is every screen throwing
  for the length of the promote.
- **Zero read sites break.** Every read of `activity_scores` selects named
  columns. A second row would have broken around twelve of them **silently**,
  the worst being `streak.ts:137-146` and `:183-192` (a monk miss ends a real
  streak), `clean-run.ts:61-89` (ends an IMMACULATE run), `stats.ts:62-77` (the
  heatmap denominator doubles) and `verify.ts:66` (the map key collides, so
  verify stops being a check without saying so).
- **Money cannot be touched, structurally.** `scoring.ts:647-653` builds the
  outcome list by filtering scores with no scope predicate; a second row would
  have produced a duplicate outcome on the same primary key, and a monk failure
  could overwrite a real pass with `passed: false` and a fine. That needs a
  second row to exist. There isn't one. **This is a proof, not a guard somebody
  has to remember**, and it is the strongest reason for this shape.
- **Verify diffs it in four lines** inside the loop at `verify.ts:68-108`, in
  the same shape as `settling` and `paused` at `:85-107`. No new query, no new
  key, no new drift kind, and no orphan class to check for.
- **Reversible in one statement.**

Named `monk_passed` / `monkPassed`, **not** `scope`: `scope` already means the
reputation scope in this codebase (`scoring.ts:235`, `verify.ts:125`,
`ResumePoint.scores`).

### The module side, which is where the bar actually lives

```ts
// src/domain/types.ts, on ActivityType
monkBar?(config: Config): Config;
```

The module returns **its own config, tightened**, and it returns the stricter of
the member's own setting and the bar, so somebody already drinking twelve
glasses is not handed a target of ten. Invariant 6 survives exactly: the engine
calls `evaluate` with whatever comes back and never learns the field is called
`glasses`. Water, Screen and Sleep implement it; everything else omits it.

**The bar is code, the same for everybody.** It is not a member setting. A
member-settable bar is precisely the cheap alternative 1.16 named and 1.29
refused, and it would break the comparability that 1.29's share toggle rests on.

**A monotonicity property test lands before anything writes the column**:
`evaluate(monkBar(c)).passed` implies `evaluate(c).passed`, and
`configSchema.parse(monkBar(c))` does not throw. The second half is not
decoration: `split()` at `scoring.ts:150-156` hands config to `evaluate`
**unparsed**, so a monk config its own schema would reject reaches `evaluate`
and can throw mid-score, taking `scoreUser` down for that member.

### No backfill

Every existing row stays NULL until recomputed. The nightly `scoreAll` without a
resume fills every row within one night; the hourly resume path only rescans
from `dayFrom - 7` (`scoring.ts:292`). So for up to a day the percentage is
computed over a thinner window. Say so on the screen rather than discovering it,
or press Rebuild in Ops once after the deploy.

---

## 0036 — Nudges, Phase 4

One row per nudge. It is a notification a member caused, the first of those in
this codebase, so it is recorded rather than only sent.

```sql
CREATE TABLE nudges (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_key      text NOT NULL,
    period_start  date NOT NULL,
    message_key   text NOT NULL,          -- one of the four set messages
    sent_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nudges_to_idx ON nudges (to_user_id, sent_at DESC);

ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS nudges_enabled boolean NOT NULL DEFAULT true;
```

**No rate-limit table and no claim row**, because the window is the limit
(1.27). A nudge is only possible while the target is at risk, and at risk is a
computed state over an open window with nothing logged.

`message_key` and never the text: the four messages live in code beside
`notification-copy.ts` so they go through review, which is the rule a bad
release bought in v3.3.

**Nudges refused is one boolean, not a blocklist** (1.13). In a group of three,
a per-person mute is a thing people work out, and the app would have built them
a quiet blocklist to work it out with.

---

## 0037 — The coach, Phase 5

Three tables, and none of them holds anything the app needs in order to work.

```sql
-- What he wrote, for which day, for which surface.
CREATE TABLE coach_lines (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day         date NOT NULL,
    surface     text NOT NULL,     -- home | miss | record | done | tab
    body        text NOT NULL,
    provider    text NOT NULL,
    model       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day, surface)
);

-- The rolling summary, 1.25. ONE row per person, rewritten, never appended.
CREATE TABLE coach_memory (
    user_id        text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    summary        text NOT NULL,
    edited_by_user boolean NOT NULL DEFAULT false,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Every call, so Ops can count them and the ceiling can bite. 1.26.
CREATE TABLE coach_calls (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       text REFERENCES users(id) ON DELETE SET NULL,
    kind          text NOT NULL,     -- nightly | ask
    provider      text NOT NULL,
    model         text NOT NULL,
    input_tokens  int,
    output_tokens int,
    images        int NOT NULL DEFAULT 0,
    cost_minor    bigint NOT NULL DEFAULT 0,   -- integer minor units, invariant 7
    called_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_calls_month_idx ON coach_calls (called_at DESC);
```

**`coach_memory` is one row and is rewritten**, which is the only place in this
codebase that deliberately is not append-only. It is not a record of anything
that happened; it is a cache of an opinion, and 1.25 gives the member read, edit
and clear over it. `edited_by_user` exists so the nightly rewrite knows it is
overwriting something a person wrote, and so the screen can say so.

**`cost_minor` is integer minor units** because invariant 7 is about money and
this is money. Nothing here is a float.

**The daily ask cap and the monthly ceiling are reads over `coach_calls`, not
counters.** A counter drifts; a count does not.

---

## 0038 — The coach job's slot claim, Phase 5

```sql
CREATE UNIQUE INDEX IF NOT EXISTS events_one_coach_run_idx
    ON events ((payload->>'slot'))
    WHERE type = 'ops.coach.ran';
```

Same shape as `events_one_score_run_idx`, so two ticks cannot overlap. Its
heartbeat joins `HEARTBEATS` in `src/server/ops.ts`, so `schedulerHealth()`
reports four jobs rather than three.

---

## Not a migration

- **`category`** — a field on `ActivityType` in code (see the corrections at the
  top).
- **`CONSENT_VERSION` → 2** — a constant in `src/server/consent.ts`, which is
  what makes `hasConsented` return false and puts the gate in front of all three
  members (1.30). The text itself is code, in `CONSENT` and `TERMS`, deliberately:
  every claim in it has to stay true as the code changes, and a policy nobody
  can diff quietly stops being accurate.

## What v4 does NOT add

- **No table for Monk mode's percentage.** Derived, always.
- **No table for the grouped Home row.** It is presentation (1.19).
- **No nudge rate-limit table.** The window is the limit (1.27).
- **No conversation history.** 1.25 chose a rolling summary over the turns, so
  there is nothing per-question to store or to delete.
- **No counters.** The ask cap and the spend ceiling are counts over
  `coach_calls`.
- **No version column on `activity_scores`.** Scores are always recomputed from
  events, so there is nothing to gate. `verify` is what proves the monk half is
  right, which is why it has to be taught the column rather than left alone.

## Deleting

`Delete data` and the consent gate both name the new rows (1.25). On account
deletion, `coach_lines`, `coach_memory`, `user_conditions` and `nudges` sent BY
the member all go with the cascade. `coach_calls` keeps its row with `user_id`
nulled, because the bill is a fact about the month rather than about the person,
and `nudges` received FROM a deleted member keep the row with the sender nulled,
for the same reason a ledger row keeps a name.

Money is still never deleted. Nothing above changes that.
