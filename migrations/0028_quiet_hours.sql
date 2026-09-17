-- ===========================================================================
-- 0028  Nothing arrives while you are asleep.
--
-- One table. Additive, so it ships BEFORE the tag and the running version
-- never sees anything it does not understand (.planning/RELEASE.md).
--
-- 0027 shipped a waking band hardcoded at 8:00 AM to 9:30 PM, and it only ever
-- filtered the cues the ENGINE derives. A time the member typed went through
-- it, and so did every reason to send that is not a clock: a window about to
-- close, a peer logging something, a streak ending. That was survivable while
-- the only trigger was a cue time. It is not survivable now that a last call
-- can fire off a deadline, because the eight activity types whose window is
-- the whole day close at 11:59 PM, and a last call on one of those lands at
-- 11:30 PM every night. A notification at 11:30 PM about a window nobody was
-- awake to make is the notification that gets notifications turned off, and
-- there is no way back from that except a trip into iOS settings.
--
-- So the band becomes a per-member setting and a gate above EVERY reason to
-- send, with no exception for urgency. Urgency is exactly the argument that
-- would reintroduce the 2:00 AM notification.
--
-- Defaults live in the column, not in the application, so a member with no row
-- is not a special case anybody has to remember: the read returns the same
-- shape either way and there is nothing to backfill.
--
-- "HH:mm" text rather than `time`, for the same reason as activity_reminders:
-- these are clock readings, never instants. 9:30 PM means 9:30 PM after a
-- flight. A `time` column invites somebody to combine it with a date in SQL
-- and silently get UTC.
--
-- OPERATIONAL, so plain and updatable rather than the insert-only
-- effective-dated shape every scoring setting uses. Invariant 4 governs
-- settings that decide how a period is judged. A quiet hour judges nothing: it
-- cannot change whether a day counted, what a fine was, or what any screen
-- reports about the past. Dating it into the future would buy nothing and cost
-- somebody a day's wait to stop being woken up.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS notification_settings (
    user_id    text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    -- Wall clock in the member's own zone. The band WRAPS midnight, which is
    -- the normal case rather than the awkward one: from > to means "from
    -- 9:30 PM until 8:00 AM tomorrow", and every reader has to handle it.
    quiet_from text NOT NULL DEFAULT '21:30',
    quiet_to   text NOT NULL DEFAULT '08:00'
);
