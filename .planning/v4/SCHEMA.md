# SCHEMA.md — What v4 adds to the database

Migrations 0033 upward. Every one of them is **additive**, which matters for a
reason `.planning/RELEASE.md` spells out: an additive migration goes before the
tag and a hostile one after the promote, because the live version is still
running between them. v4 has no hostile migration and it should stay that way.

Read `DECIDED.md` for why any of this exists and `PLAN.md` for when it is
built. The phase each migration belongs to is named beside it.

The invariants are unchanged. In particular: `events` is still the only source
of truth (1), scoring still reads only `checkin.*` (2), `ledger_entries` is
still append-only (3), and scoring config is still insert-only with a future
`effective_from` (4). **Nothing v4 adds is allowed to be a second source of
truth for a fact that already lives in `events`.**

---

## 0033 — `category` on a module, Phase 1

Not a migration at all: `category` is a field on the declarative module, in
code, and `activity_types` already carries whatever `sync:activities`
reconciles. If the catalog screen needs to filter by it, it gets a column here
and `sync:activities` fills it.

```sql
ALTER TABLE activity_types
    ADD COLUMN IF NOT EXISTS category text;   -- body | food | mind | sleep, or NULL
```

**NULL is a real value and means a member wrote this one** (1.19). Everything
that reads category has to handle it, and the thing that reads it is Monk
mode's required-categories check, which treats NULL as covering nothing.

The five new types are rows `sync:activities` writes, disabled, like every type
before them. No migration writes them.

---

## 0034 — Member-written conditions, Phase 1

A condition somebody names themselves is the same module with a different
label, so it needs a place to keep the label. It is per user, not global:
`activity_types` is the registry and a member cannot write to the registry.

```sql
CREATE TABLE user_conditions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_key    text NOT NULL,          -- the shared held-or-slipped module
    label       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    retired_at  timestamptz
);
CREATE UNIQUE INDEX user_conditions_live_idx
    ON user_conditions (user_id, lower(label)) WHERE retired_at IS NULL;
```

**Retired rather than deleted**, because a check-in made against it is an event
and events do not go away. A retired condition stops being offered and its
history stays readable, which is the same shape as stopping tracking anything
else.

---

## 0035 — Monk mode's set, Phase 3

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

**The percentage is not stored.** It is passed over scheduled, computed from
`activity_scores` at read time, and rebuildable because the things under it
already are. Storing it would make it a second source of truth for a fact that
is already derivable, which is invariant 1.

**0 of 0 is not 0%.** A day where nothing in the set was scheduled has no
score, and the read layer returns null rather than zero. Whatever renders it
draws a dash.

---

## 0036 — The stricter monk bar, Phase 3

The expensive one, priced in 1.16 and chosen knowingly in 1.29. One activity
carries two verdicts for one day: passed against your own target, and passed or
not against the monk bar.

`activity_scores` is keyed `(user_id, type_key, period_start)`, so a second
verdict needs a second scope. **A new column on the primary key, not a new
table**, because every consumer already joins on those three and
`activity_outcomes` has a foreign key into them.

```sql
ALTER TABLE activity_scores
    ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'own';  -- own | monk

ALTER TABLE activity_scores DROP CONSTRAINT activity_scores_pkey;
ALTER TABLE activity_scores
    ADD PRIMARY KEY (user_id, type_key, period_start, scope);
```

**Read this before writing it.** `activity_outcomes` has

```sql
FOREIGN KEY (user_id, type_key, period_start)
    REFERENCES activity_scores (user_id, type_key, period_start)
```

and that reference stops being unique the moment `scope` joins the key. The
foreign key has to be dropped and re-added against
`(user_id, type_key, period_start, scope)` with `scope` fixed to `'own'`,
because **a consequence is only ever a consequence of your own target**. A monk
row can never produce a fine, a streak or a ledger entry (1.16: no streak, no
pass, no fine).

That is the whole reason this is expensive, and it is why the alternative in
1.16 was a harder target on the activity itself.

The monk bar per type is config, so it lives where config lives:

```sql
-- inside user_activity_config's existing jsonb, not a new table
-- { "water": { "target": 8, "monk": 10 }, "screen": { "max": 180, "monk": 120 } }
```

**`verify` has to diff both scopes or half the work goes unchecked.** That is
the line to remember from 1.16, and it is a change to `verify` rather than to
the schema.

---

## 0037 — Nudges, Phase 4

One row per nudge. It is a notification a member caused, which is the first of
those in this codebase, so it is recorded rather than only sent.

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
```

**No rate-limit table and no claim row**, because the window is the limit
(1.27). A nudge is only possible while the target is at risk, and at risk is a
computed state over an open window with nothing logged.

`message_key` and never the text: the four messages live in code beside
`notification-copy.ts` so they go through review, which is the rule a bad
release bought in v3.3.

**Nudges refused** is one boolean on the member, not a blocklist (1.13):

```sql
ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS nudges_enabled boolean NOT NULL DEFAULT true;
```

---

## 0038 — The coach, Phase 5

Three tables and none of them holds anything the app needs to work.

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
    user_id      text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    summary      text NOT NULL,
    edited_by_user boolean NOT NULL DEFAULT false,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Every call, so Ops can count them and the ceiling can bite. 1.26.
CREATE TABLE coach_calls (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text REFERENCES users(id) ON DELETE SET NULL,
    kind        text NOT NULL,     -- nightly | ask
    provider    text NOT NULL,
    model       text NOT NULL,
    input_tokens  int,
    output_tokens int,
    images      int NOT NULL DEFAULT 0,
    cost_minor  bigint NOT NULL DEFAULT 0,   -- integer minor units, invariant 7
    called_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_calls_month_idx ON coach_calls (called_at DESC);
```

**`coach_memory` is one row and is rewritten**, which is the one place in this
codebase that deliberately is not append-only. It is not a record of anything
that happened; it is a cache of an opinion, and 1.25 gives the member edit and
clear over it. `edited_by_user` exists so the nightly rewrite knows it is
overwriting something a person wrote, and so the screen can say so.

**`cost_minor` is integer minor units** because invariant 7 is about money and
this is money. Nothing here is a float.

**The daily ask cap and the monthly ceiling are both reads over
`coach_calls`**, not counters. A counter drifts; a count does not.

### The job's own claim

The coach job claims its slot the way the score run does, so two ticks cannot
overlap:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS events_one_coach_run_idx
    ON events ((payload->>'slot'))
    WHERE type = 'ops.coach.ran';
```

And its heartbeat joins `HEARTBEATS` in `src/server/ops.ts`, so
`schedulerHealth()` reports four jobs rather than three.

---

## 0039 — Consent version 2, Phase 7

No table. `CONSENT_VERSION` goes from 1 to 2 in `src/server/consent.ts`, which
is what makes `hasConsented` return false for all three members and puts the
gate in front of them (1.30).

The text itself is code, in `CONSENT` and `TERMS`, and that is deliberate:
every claim in it has to stay true as the code changes, and a policy nobody can
diff quietly stops being accurate.

---

## What v4 does NOT add

- **No table for Monk mode's percentage.** Derived, always.
- **No table for the grouped Home row.** It is presentation (1.19).
- **No nudge rate-limit table.** The window is the limit (1.27).
- **No conversation history.** 1.25 chose a rolling summary over the turns, so
  there is nothing per-question to store or to delete.
- **No counters.** The ask cap and the spend ceiling are counts over
  `coach_calls`.

## Deleting

`Delete data` and the consent gate both have to name the new rows (1.25). On
account deletion: `coach_lines`, `coach_memory`, `user_conditions` and `nudges`
sent BY the member all go with the cascade. `coach_calls` keeps its row with
`user_id` nulled, because the bill is a fact about the month rather than about
the person, and `nudges` received FROM a deleted member keep the row with the
sender nulled for the same reason a ledger row keeps a name.

Money is still never deleted. Nothing above changes that.
