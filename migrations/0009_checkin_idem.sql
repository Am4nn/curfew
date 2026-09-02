-- ===========================================================================
-- 0009  Check-ins repeat, so idempotency moves to a key the press carries.
--
-- v1 tracked one thing, sleep, whose three steps happen once a night. One
-- check-in per user per type per period was therefore both the idempotency
-- rule and the truth of the domain, and events_one_checkin_idx enforced it.
--
-- v3's catalog is not like that. Water is eight glasses, Food is three meals,
-- Study and Reading add up sittings, Steps and Screen take a later reading as
-- a correction, and an abstinence declaration can be corrected the same way.
-- The old index forbids every one of those.
--
-- So the index keeps its job and changes its key: the button generates one
-- `idem` per press, and the uniqueness is on that. A retry, a double submit or
-- a replayed request carries the key it already used and is dropped by the
-- database. A second deliberate glass of water carries a new one and is kept.
--
-- Steps that must NOT repeat (Office's arrival, a Gym session, a sleep window)
-- are refused in the write path, from the module's own `repeats` flag. That is
-- domain knowledge and does not belong in an index.
-- ===========================================================================

DROP INDEX IF EXISTS events_one_checkin_idx;

CREATE UNIQUE INDEX events_one_checkin_idx
    ON events (user_id, type, (payload->>'period_start'), (payload->>'idem'))
    WHERE type LIKE 'checkin.%';
