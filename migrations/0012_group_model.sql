-- ===========================================================================
-- 0012  The group model, rebuilt.
--
-- v1 gave a group an `activities` row per type, with `activity_rules` hanging
-- off it, because a group owned the activity. v3 inverts that: a person owns
-- their activities and a group only observes the ones they share. Two things
-- follow, and neither fits the old shape.
--
-- Acceptance is OPERATIONAL. An owner adding or dropping a type takes effect at
-- once, and the ceiling on a past day must resolve as it stood then, so it is
-- append-only on `effective_at` (decision 65). That is group_activity_types,
-- already here since 0007.
--
-- Fine rules are SCORING CONFIG. Invariant 4 future-dates them on a `date`, so
-- changing a fine cannot rewrite how a period in progress is judged. That is
-- group_activity_rules, below, keyed by (group, type) rather than by an
-- activity row that no longer needs to exist.
--
-- The `activities` and `activity_rules` tables go. Nothing references them once
-- the ledger and outcomes are keyed by type, and keeping them would leave two
-- tables answering "does this group do sleep".
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- member_shares  -- the member's half of the two toggles (decision 16).
-- Append-only and immediate: un-sharing takes effect now, and the reputation
-- ceiling it lowers is resolved as it stood on each day being scored.
-- Evidence means the photo AND the fields the check-in carried (decision 38).
-- ---------------------------------------------------------------------------
CREATE TABLE member_shares (
    id             bigserial PRIMARY KEY,
    group_id       uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_key       text NOT NULL,
    shared         boolean NOT NULL,
    share_evidence boolean NOT NULL DEFAULT false,
    effective_at   timestamptz NOT NULL DEFAULT now(),
    changed_by     text REFERENCES users(id),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX member_shares_resolve_idx
    ON member_shares (group_id, user_id, type_key, effective_at DESC, id DESC);
CREATE INDEX member_shares_group_idx ON member_shares (group_id, effective_at DESC);

-- ---------------------------------------------------------------------------
-- group_activity_rules  -- what a miss costs in this group, per type.
-- Insert-only with a FUTURE effective_from (invariant 4). Grace lives on the
-- user's own activity now, not here: it protects a streak, which is personal.
-- ---------------------------------------------------------------------------
CREATE TABLE group_activity_rules (
    version        serial PRIMARY KEY,
    group_id       uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    type_key       text NOT NULL,
    fine_mode      text NOT NULL DEFAULT 'flat',      -- flat | escalating
    fine_amount    bigint NOT NULL,                   -- minor units (invariant 7)
    fine_step      bigint NOT NULL DEFAULT 0,
    fine_cap       bigint,
    currency       char(3) NOT NULL DEFAULT 'INR',
    effective_from date NOT NULL,
    changed_by     text REFERENCES users(id),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX group_activity_rules_effective_idx
    ON group_activity_rules (group_id, type_key, effective_from);

-- ---------------------------------------------------------------------------
-- The ledger and the outcomes stop pointing at an activity row.
-- Both are empty, so this is a reshape rather than a migration.
-- ---------------------------------------------------------------------------
DROP TABLE activity_outcomes;

CREATE TABLE activity_outcomes (
    group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_key     text NOT NULL,
    period_start date NOT NULL,
    passed       boolean NOT NULL,
    -- Grace protects the streak, never the fine (decision 5). Recorded so a
    -- standing screen can say a miss was forgiven and still charged.
    grace_used   boolean NOT NULL DEFAULT false,
    fine_amount  bigint NOT NULL DEFAULT 0,
    currency     char(3) NOT NULL DEFAULT 'INR',
    rules_version int REFERENCES group_activity_rules(version),
    computed_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id, type_key, period_start)
);

CREATE INDEX activity_outcomes_group_idx
    ON activity_outcomes (group_id, period_start DESC);

-- The old index is on activity_id, so it goes before the column does.
DROP INDEX IF EXISTS ledger_one_fine_idx;
ALTER TABLE ledger_entries DROP COLUMN activity_id;
ALTER TABLE ledger_entries ADD COLUMN type_key text;  -- null for settlements

-- One fine per payer per payee per type per period. Re-running the scorer never
-- double-charges.
CREATE UNIQUE INDEX ledger_one_fine_idx
    ON ledger_entries (group_id, type_key, period_start, from_user_id, to_user_id)
    WHERE kind = 'fine';

DROP TABLE activity_rules;
DROP TABLE activities;
