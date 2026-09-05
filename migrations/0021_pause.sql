-- ===========================================================================
-- 0021  Pause: a declared absence.
--
-- The whole design is one sentence, and everything below follows from it: a
-- paused day is a day with NOTHING SCHEDULED. Not a miss. So no fine can arise
-- from it and reputation is not marked down for it, neither of which needs a
-- rule, because the engine already knows what to do with a day on which nothing
-- concluded. What it costs is the streak, outright, when the first paused day
-- CLOSES, exactly the way a missed day takes one. Grace does not cover it. That
-- single fact is why there is no quota: pausing every weekend would reset the
-- streak every weekend, and a weekday-only schedule already does the honest
-- version of the same thing. Decisions 133 to 137.
--
-- INSERT ONLY, in the same family as user_settings and group_activity_rules
-- (invariant 4). A row is a complete statement of one pause as it stood when it
-- was declared. Extending it or coming home early writes another row with the
-- same pause_id, and the one in force is the highest version of each pause_id.
-- Nothing is ever updated, so the record of what was originally declared
-- survives, which is the part a group would actually want to see when a trip
-- keeps growing.
--
-- Two rules the app enforces and the database deliberately does not, the same
-- way it does not enforce invariant 4's future effective_from:
--
--   starts_on must be tomorrow or later. Declaring afterwards would convert a
--   miss that has already happened into a day that was never scheduled, which
--   is the erase that closed retroactive un-sharing (decision 15).
--
--   at least three days. Enough for a weekend trip, not usable as a one-night
--   excuse.
--
-- `cancelled` is set at insert and never updated. It is how a pause that has
-- not started yet goes away entirely: an empty range would be a date pair that
-- reads as nonsense, and coming home early from a pause already running is a
-- shorter ends_on rather than a cancellation.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS user_pauses (
    version     serial      PRIMARY KEY,
    -- Stable across the declaration, the extension and the early return. A new
    -- trip is a new pause_id; the same trip changing shape is not.
    pause_id    uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id     text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Both inclusive, and both a day in the MEMBER's own zone, like every other
    -- date the scorer reads.
    starts_on   date        NOT NULL,
    ends_on     date        NOT NULL,
    cancelled   boolean     NOT NULL DEFAULT false,
    declared_at timestamptz NOT NULL DEFAULT now()
);

-- Resolving a user's pauses reads their rows newest first, which is every
-- query this table has.
CREATE INDEX IF NOT EXISTS user_pauses_user_idx
    ON user_pauses (user_id, version DESC);

-- ---------------------------------------------------------------------------
-- The period-level mark, which is what makes the rest of the engine behave
-- without knowing what a pause is.
--
-- It mirrors `settling` exactly: the period is still scored and still stored,
-- so the record has no hole in it and `verify` can still see the day, but the
-- reputation pass reads it as nothing having concluded and no fine is posted
-- from it. The streak is the one place that treats it as a real day, because
-- ending the run is the price of the pause.
--
-- A period is paused only when EVERY day of it falls inside the pause. A daily
-- period is one day, so that is the obvious reading. A weekly one needs the
-- whole week inside, which stops a three-day pause from erasing a whole gym
-- week, and a three-day pause every weekend from erasing two of them.
-- ---------------------------------------------------------------------------

ALTER TABLE activity_scores
    ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;
