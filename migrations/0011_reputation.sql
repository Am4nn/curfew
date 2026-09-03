-- ===========================================================================
-- 0011  Reputation, one row a day.
--
-- Derived and replayable, like activity_scores: rebuildable by replaying daily
-- deltas from the join date (invariant 1). Nothing here is a source of truth;
-- `bun run verify` recomputes a range and diffs it.
--
-- group_id NULL is the global score: the same formula over the activities a
-- user shares with at least one group, at full breadth, visible only to its
-- owner. Per-group rows arrive with sharing.
-- ===========================================================================

CREATE TABLE reputation_daily (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id    uuid REFERENCES groups(id) ON DELETE CASCADE,   -- null: global
    day         date NOT NULL,
    score       numeric(7,3) NOT NULL,
    delta       numeric(7,3) NOT NULL,
    -- clean | incomplete | drift | idle | neutral. The module of record for
    -- what moved it, so a standing screen can say so without recomputing.
    reason      text NOT NULL,
    ceiling     numeric(7,3) NOT NULL,
    -- Periods passed over periods concluded, for the day. Null: none due.
    completion  numeric(4,3),
    computed_at timestamptz NOT NULL DEFAULT now()
);

-- One row per scope per day. The global row and a group row share a day.
CREATE UNIQUE INDEX reputation_daily_key_idx
    ON reputation_daily (user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), day);

-- Reading a standing, and finding where a replay must start.
CREATE INDEX reputation_daily_scope_idx ON reputation_daily (user_id, group_id, day DESC);

-- ---------------------------------------------------------------------------
-- activity_scores gains its settling flag: a period inside an activity's first
-- 7 days is scored normally and excluded from the reputation delta
-- (decision 54). Fines still apply, which is why this lives on the score and
-- not on the fine.
-- ---------------------------------------------------------------------------
ALTER TABLE activity_scores ADD COLUMN settling boolean NOT NULL DEFAULT false;
