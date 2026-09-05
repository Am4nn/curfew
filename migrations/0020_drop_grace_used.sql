-- ===========================================================================
-- 0020  A column that never had a true value.
--
-- activity_outcomes.grace_used has been written `false` on every row since it
-- was added. Grace protects the STREAK and has never protected a fine
-- (decision 5, which reversed v1/v2 deliberately), so an outcome, which is the
-- per-group record of what a period cost, has nothing to say about it. The
-- scorer wrote false unconditionally and the admin user page rendered
-- "· grace" off it, which meant a label that could only ever be absent.
--
-- Grace still exists and is still recorded, on the thing it actually protects:
-- activity_streaks.grace_spent, per calendar month, which is what the streak
-- engine reads and what `verify` diffs.
--
-- Dropping rather than backfilling, because there is nothing to backfill to.
-- If grace ever does affect an outcome, it comes back as a column that means
-- what it says.
-- ===========================================================================

ALTER TABLE activity_outcomes
    DROP COLUMN IF EXISTS grace_used;
