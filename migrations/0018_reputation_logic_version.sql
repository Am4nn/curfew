-- ===========================================================================
-- 0018  Which version of the maths produced this score.
--
-- Reputation is a running score: day D is day D-1 plus a delta. It has always
-- been stored that way, one row a day, which makes reputation_daily a closing
-- record in the accounting sense. It was never READ as one. Every page load
-- replayed the whole curve from the join date to arrive at a number already
-- sitting in the table.
--
-- Carrying yesterday forward is safe as long as yesterday was computed by the
-- same rules. It is not safe across a change to applyDay or to the CONSTANTS
-- in src/domain/reputation.ts: the stored number would then be an input from a
-- world that no longer exists, and every day after it would inherit that.
--
-- Idempotent is not the same as still correct. Re-running a close gives the
-- same answer; changing the maths does not. So each row records the version of
-- the curve that made it, and the incremental path refuses to carry a row it
-- does not recognise, replaying that user from the beginning instead.
--
-- Existing rows are version 1, which is the version in code today.
-- ===========================================================================

ALTER TABLE reputation_daily
    ADD COLUMN IF NOT EXISTS logic_version integer NOT NULL DEFAULT 1;
