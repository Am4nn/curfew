-- ===========================================================================
-- 0019  The streak, stored, so reading one is reading one.
--
-- A streak was derived on every read: load every closed period for the type,
-- walk them, count the run. That is a lot of work to learn a number that only
-- ever changes when someone presses a button, and it was wrong for weekly
-- types, because the walk was handed one row per PERIOD. A gym week arrived as
-- a single Monday, fell below its own three-a-week minimum, and reported three
-- passed weeks as a streak of 1 while quietly spending grace on weeks that
-- passed.
--
-- So the counter lives here and the press moves it. events stays the truth and
-- this stays a cache (invariant 1): streakOver rebuilds it from events, the
-- nightly close repairs it, and `bun run verify` diffs the two.
--
-- No day log beside it. events already IS the immutable log every streak design
-- calls for, with events_one_checkin_idx enforcing one check-in per user, type,
-- period and idempotency key. A second table of days would be derived state
-- with a source of truth already sitting next to it.
--
-- week_sessions and week_start are the week in flight. A weekly type adds a day
-- as it happens and the week is judged when it ends, so the count has to
-- survive between presses; week_start says which week it belongs to, so a new
-- week resets it rather than inheriting the last one.
--
-- There is no column for the value a week opened on, and that is deliberate. A
-- streak adds one or goes to zero, and grace makes it do neither: it holds.
-- Nothing ever rewinds it to an earlier number.
--
-- closed_through is how far the close has accounted for. It makes closing
-- idempotent and lets a missed night catch up without counting a day twice.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS activity_streaks (
    user_id        text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type_key       text        NOT NULL,
    current        integer     NOT NULL DEFAULT 0 CHECK (current >= 0),
    best           integer     NOT NULL DEFAULT 0 CHECK (best >= 0),
    -- The last activity-day counted into `current`. Null until the first one.
    last_day       date,
    -- The Monday of the week in flight, for a weekly type. Null for daily ones.
    week_start     date,
    week_sessions  integer     NOT NULL DEFAULT 0 CHECK (week_sessions >= 0),
    -- Grace spent, keyed "yyyy-MM". Unused grace does not carry over.
    grace_spent    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    -- Every day up to here has been accounted for by the close.
    closed_through date,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, type_key)
);
