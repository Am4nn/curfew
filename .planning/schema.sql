-- Curfew - v1 schema (PostgreSQL 14+ / Neon)
--
-- V1 TRACKS SLEEP AND NOTHING ELSE. The schema is activity-generic so that gym,
-- office attendance or step counts can be added later without a migration, but
-- exactly one activity type is registered in v1. Do not build the others.
--
-- Design invariants:
--   1. EVENTS is the only source of truth. Everything else is derived.
--   2. LEDGER_ENTRIES is append-only. No UPDATE, no DELETE. Corrections are rows.
--   3. ACTIVITY_SCORES / ACTIVITY_OUTCOMES are rebuildable caches.
--   4. Scoring reads ONLY events of type 'checkin.*'. Never sessions, never last_seen.
--   5. Config is versioned and effective-dated. History never changes.
--   6. A check-in is ONE physical act. One event, evaluated once per activity
--      TYPE, applied to every group tracking that type.
--   7. Nothing outside an activity module knows what "sleep" means. The engine
--      consumes { passed, detail } and nothing more.
--
-- AUTH: `users`, `sessions`, `accounts`, `verifications` are owned and migrated by
-- Better Auth. Configure PLURAL modelNames or you get a table called `user` - a
-- reserved word. Do NOT add `timezone` as an additionalField; it lives in
-- user_settings, versioned. Better Auth ids are TEXT, not uuid.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ===========================================================================
-- ACCESS CONTROL
-- Invite-only end to end:
--   1. Google sign-in creates a user row (Better Auth).
--   2. user_approvals gates the ACCOUNT. Pending users see a waiting screen and
--      nothing else - no groups, no invites, no data.
--   3. group_invites gates each GROUP. No public or discoverable groups.
-- ===========================================================================

CREATE TABLE user_approvals (
    user_id      text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status       text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
    is_admin     boolean NOT NULL DEFAULT false,
    requested_at timestamptz NOT NULL DEFAULT now(),
    decided_at   timestamptz,
    decided_by   text REFERENCES users(id),
    CHECK ((status = 'pending') = (decided_at IS NULL))
);
-- Seed the first admin by hand after signing in once:
--   UPDATE user_approvals SET status='approved', is_admin=true,
--          decided_at=now() WHERE user_id = '<your id>';

CREATE TABLE groups (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    created_by  text NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);

CREATE TABLE group_members (
    group_id  uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at date NOT NULL,      -- scoring starts here. Never fined before it.
    left_at   date,               -- scoring stops here. Balance survives.
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON group_members (user_id) WHERE left_at IS NULL;

CREATE TABLE group_invites (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    email        citext NOT NULL,
    invited_by   text NOT NULL REFERENCES users(id),
    status       text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz
);
CREATE UNIQUE INDEX group_invites_pending_idx
    ON group_invites (group_id, email) WHERE status = 'pending';

-- ===========================================================================
-- ACTIVITIES
--
-- An activity is "this group tracks this type of thing". type_key resolves to a
-- module in the application registry. V1 registers 'sleep' only.
--
-- period is declared by the TYPE, not the row: sleep and steps are 'day', gym
-- and office attendance are 'week'. It is denormalised here so SQL can group by
-- period without loading the registry.
-- ===========================================================================

CREATE TABLE activities (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    type_key    text NOT NULL,        -- 'sleep' in v1. Registry key.
    period      text NOT NULL CHECK (period IN ('day', 'week', 'month')),
    name        text,                 -- optional label, e.g. "Weeknights only"
    created_by  text NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);
-- One activity of a given type per group. Two sleep contracts in one group is
-- a config change, not a second activity.
CREATE UNIQUE INDEX activities_group_type_idx
    ON activities (group_id, type_key) WHERE archived_at IS NULL;

-- ===========================================================================
-- CONFIGURATION - three scopes, identical mechanics
--
--   USER_SETTINGS         timezone. Per user, global, versioned.
--   USER_ACTIVITY_CONFIG  the person's own targets for a TYPE - for sleep, the
--                         three window times. Keyed by type_key, NOT activity:
--                         one bedtime whatever groups you are in.
--   ACTIVITY_RULES        the group's stake for one activity: fine policy,
--                         currency, grace, and any type-level config.
--
-- All insert-only and effective-dated. Never UPDATEd or DELETEd.
-- ===========================================================================

CREATE TABLE user_settings (
    version        serial PRIMARY KEY,
    user_id        text REFERENCES users(id) ON DELETE CASCADE,  -- NULL = default
    timezone       text NOT NULL DEFAULT 'Asia/Kolkata',
    effective_from date NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_settings_effective_idx
    ON user_settings (user_id, effective_from) NULLS NOT DISTINCT;
INSERT INTO user_settings (user_id, timezone, effective_from)
VALUES (NULL, 'Asia/Kolkata', CURRENT_DATE);


CREATE TABLE user_activity_config (
    version        serial PRIMARY KEY,
    user_id        text REFERENCES users(id) ON DELETE CASCADE,  -- NULL = default
    type_key       text NOT NULL,
    -- Validated by the activity module's configSchema, never by the DB.
    -- sleep: {night_open, night_close, wake_open, wake_close,
    --         confirm_open, confirm_close}
    config         jsonb NOT NULL,
    effective_from date NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_activity_config_effective_idx
    ON user_activity_config (user_id, type_key, effective_from) NULLS NOT DISTINCT;

INSERT INTO user_activity_config (user_id, type_key, config, effective_from)
VALUES (NULL, 'sleep',
        '{"night_open":"22:00","night_close":"22:45",
          "wake_open":"06:00","wake_close":"07:00",
          "confirm_open":"07:30","confirm_close":"07:45"}'::jsonb,
        CURRENT_DATE);


CREATE TABLE activity_rules (
    version         serial PRIMARY KEY,
    activity_id     uuid REFERENCES activities(id) ON DELETE CASCADE, -- NULL = default
    --   'flat'       -> always fine_amount
    --   'escalating' -> fine_amount + fine_step * consecutive_failures_before,
    --                   capped at fine_cap. SHIP WITH 'flat'.
    fine_mode       text   NOT NULL DEFAULT 'flat'
                      CHECK (fine_mode IN ('flat', 'escalating')),
    fine_amount     bigint NOT NULL CHECK (fine_amount > 0),   -- minor units
    fine_step       bigint NOT NULL DEFAULT 0 CHECK (fine_step >= 0),
    fine_cap        bigint CHECK (fine_cap IS NULL OR fine_cap >= fine_amount),
    currency        char(3) NOT NULL DEFAULT 'INR',
    grace_per_month int  NOT NULL DEFAULT 2 CHECK (grace_per_month >= 0),
    -- Group-level knobs the activity module understands, e.g. gym: {"target":3}
    config          jsonb NOT NULL DEFAULT '{}'::jsonb,
    effective_from  date NOT NULL,
    changed_by      text REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (fine_mode = 'flat' OR fine_step > 0)
);
CREATE UNIQUE INDEX activity_rules_effective_idx
    ON activity_rules (activity_id, effective_from) NULLS NOT DISTINCT;
INSERT INTO activity_rules (activity_id, fine_mode, fine_amount, currency,
                            grace_per_month, effective_from)
VALUES (NULL, 'flat', 5000, 'INR', 2, CURRENT_DATE);   -- 5000 paise = Rs 50

-- ===========================================================================
-- IMMUTABILITY OF HISTORY  -- read before writing the scoring job
-- ===========================================================================
-- Config rows are NEVER updated or deleted. A change is a new row with a FUTURE
-- effective_from. The APP must reject effective_from <= CURRENT_DATE; nothing in
-- the DB enforces it, and a backdated row silently rewrites scored periods.
--
-- Every computation resolves each scope as it stood ON THAT PERIOD's start:
--
--   SELECT * FROM user_activity_config
--   WHERE (user_id = $uid OR user_id IS NULL) AND type_key = $type
--     AND effective_from <= $period_start
--   ORDER BY user_id NULLS LAST, effective_from DESC LIMIT 1;
--
--   SELECT * FROM activity_rules
--   WHERE (activity_id = $aid OR activity_id IS NULL)
--     AND effective_from <= $period_start
--   ORDER BY activity_id NULLS LAST, effective_from DESC LIMIT 1;
--
--   * Raise a fine to 1000 effective 15 Sep -> periods to 14 Sep score 500.
--     Ledger rows snapshot their own amount and are never recomputed.
--   * Move country -> old periods keep resolving in the old timezone.
--   * /verify MUST use these same lookups or it flags all history as drift.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- events  -- append-only, source of truth. GLOBAL PER USER: no group_id, no
-- activity_id. A check-in is a physical act, not a per-group act.
-- types: login, logout, checkin.<type_key>.<step>, fine.applied,
--        settlement.recorded, config.*.changed, group.*, admin.*
-- payload for a check-in: { type_key, step, period_start, evidence: {...} }
-- `evidence` is whatever the activity module's evidenceSchema declares. For
-- sleep it is empty - the timestamp IS the evidence.
-- ---------------------------------------------------------------------------
CREATE TABLE events (
    id          bigserial PRIMARY KEY,
    user_id     text REFERENCES users(id) ON DELETE SET NULL,   -- null: failed login
    session_id  text REFERENCES sessions(id) ON DELETE SET NULL,
    type        text NOT NULL,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()              -- server clock only
);
CREATE INDEX events_user_time_idx ON events (user_id, occurred_at DESC);
CREATE INDEX events_type_time_idx ON events (type, occurred_at DESC);

-- One check-in per user per type per step per period. Stops double-tap at 22:44.
CREATE UNIQUE INDEX events_one_checkin_idx
    ON events (user_id, type, (payload->>'period_start'))
    WHERE type LIKE 'checkin.%';

CREATE INDEX events_checkin_period_idx
    ON events ((payload->>'type_key'), (payload->>'period_start'))
    WHERE type LIKE 'checkin.%';

-- ---------------------------------------------------------------------------
-- activity_scores  -- did this person meet THEIR OWN targets this period?
-- Keyed by type_key, not activity: personal targets are global, so a user in
-- three sleep groups is evaluated ONCE. detail is the module's own output and
-- is never interpreted by the engine.
-- ---------------------------------------------------------------------------
CREATE TABLE activity_scores (
    user_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_key            text NOT NULL,
    period_start        date NOT NULL,   -- resolved in that period's timezone
    period_end          date NOT NULL,
    passed              boolean NOT NULL,
    -- sleep: {"night_ok":true,"wake_ok":true,"confirm_ok":false}
    detail              jsonb NOT NULL DEFAULT '{}'::jsonb,
    user_config_version int NOT NULL REFERENCES user_activity_config(version),
    computed_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, type_key, period_start)
);
CREATE INDEX activity_scores_period_idx ON activity_scores (type_key, period_start DESC);

-- ---------------------------------------------------------------------------
-- activity_outcomes  -- the CONSEQUENCES of that period, per group activity.
-- Same pass/fail, different money, streak and grace per group.
-- ---------------------------------------------------------------------------
CREATE TABLE activity_outcomes (
    activity_id    uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id        text NOT NULL,
    type_key       text NOT NULL,
    period_start   date NOT NULL,
    grace_used     boolean NOT NULL DEFAULT false,
    streak_after   int     NOT NULL DEFAULT 0,
    fine_amount    bigint  NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
    currency       char(3) NOT NULL DEFAULT 'INR',
    rules_version  int NOT NULL REFERENCES activity_rules(version),
    computed_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, user_id, period_start),
    FOREIGN KEY (user_id, type_key, period_start)
        REFERENCES activity_scores (user_id, type_key, period_start) ON DELETE CASCADE
);
CREATE INDEX activity_outcomes_activity_period_idx
    ON activity_outcomes (activity_id, period_start DESC);

-- ---------------------------------------------------------------------------
-- ledger_entries  -- append-only, per group. NEVER update or delete.
-- A failed period writes ONE ROW PER OTHER ACTIVE MEMBER: the fine split
-- equally among them. Shares must sum EXACTLY to the fine - distribute the
-- remainder one minor unit at a time, recipients ordered by user_id.
-- Two members failing the same period write both sets of rows; balances nets
-- them to zero. Both still lost the period.
-- Leaving a group does not clear a balance.
-- ---------------------------------------------------------------------------
CREATE TABLE ledger_entries (
    id           bigserial PRIMARY KEY,
    group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    activity_id  uuid REFERENCES activities(id),      -- null for settlements
    from_user_id text NOT NULL REFERENCES users(id),  -- who owes
    to_user_id   text NOT NULL REFERENCES users(id),  -- who is owed
    -- Frozen at insert, never rewritten. Deleting an account renames the user,
    -- so a joined name would erase who owed what (migration 0015).
    from_user_name text NOT NULL,
    to_user_name   text NOT NULL,
    amount       bigint  NOT NULL CHECK (amount > 0), -- minor units
    currency     char(3) NOT NULL DEFAULT 'INR',
    kind         text NOT NULL CHECK (kind IN ('fine', 'settlement', 'adjustment')),
    period_start date,                                -- null for settlements
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (from_user_id <> to_user_id),
    CHECK ((kind = 'fine') = (period_start IS NOT NULL)),
    CHECK ((kind = 'fine') = (activity_id IS NOT NULL))
);
CREATE INDEX ledger_group_time_idx ON ledger_entries (group_id, created_at DESC);
CREATE INDEX ledger_from_idx ON ledger_entries (group_id, from_user_id);
CREATE INDEX ledger_to_idx   ON ledger_entries (group_id, to_user_id);

CREATE UNIQUE INDEX ledger_one_fine_idx
    ON ledger_entries (activity_id, from_user_id, to_user_id, period_start)
    WHERE kind = 'fine';

-- ---------------------------------------------------------------------------
-- balances view - per group, per currency. Mutual failures net to zero here.
-- ---------------------------------------------------------------------------
CREATE VIEW balances AS
SELECT l.group_id, u.id AS user_id, l.currency,
       SUM(CASE WHEN l.from_user_id = u.id THEN l.amount ELSE -l.amount END) AS net_owed
FROM users u
JOIN ledger_entries l ON u.id IN (l.from_user_id, l.to_user_id)
GROUP BY l.group_id, u.id, l.currency;
