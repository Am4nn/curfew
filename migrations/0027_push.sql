-- ===========================================================================
-- 0027  Curfew can reach a phone, and knows when to.
--
-- Two tables and one index, for item 30 to 34. Additive throughout: nothing
-- here removes a column or tightens a constraint, so it ships BEFORE the tag
-- and the running version never sees anything it does not understand
-- (.planning/RELEASE.md).
--
-- `push_subscriptions` is one row per DEVICE, not per person. The browser hands
-- back an endpoint URL owned by Apple or Google, plus two keys the payload is
-- encrypted against, and that triple is the whole address. A person with a
-- phone and a laptop has two rows and gets two copies, which is correct: a
-- notification is delivered to a device and there is no such thing as
-- delivering one to an account.
--
-- The ROW IS THE PREFERENCE. There is no enabled flag beside it, because a flag
-- and a browser permission are two records of the same fact and they drift: a
-- person revokes notifications in iOS settings, the flag still says on, and the
-- app confidently reports a state the device stopped honouring weeks ago.
-- Turning notifications off deletes the row. Nothing can then disagree.
--
-- `endpoint` is the primary key rather than a surrogate id, because the push
-- service already guarantees it unique and re-subscribing on the same device
-- returns the same string. That makes the upsert on re-subscribe free, which
-- matters: iOS expires a subscription without telling anybody, so the client
-- re-subscribes on every launch and would otherwise accumulate a row a day.
--
-- `activity_reminders` is the member's own reminder times, per activity, as
-- "HH:mm" wall clock in whatever zone they are in when it fires. Stored as text
-- and not `time`, because it is a clock reading and never an instant: 8:00 PM
-- means 8:00 PM after a flight, which is the entire point, and a `time` column
-- invites somebody to combine it with a date in SQL and get UTC.
--
-- These rows are OPERATIONAL and take effect at once, so they are plain and
-- updatable rather than the insert-only effective-dated shape every scoring
-- setting uses. Invariant 4 exists because changing a threshold mid-period
-- rewrites how a period in progress is judged. A reminder time judges nothing.
-- It cannot change whether a day counted, what a fine was, or what any screen
-- reports about the past, so dating it into the future would buy nothing and
-- cost somebody a day's wait to fix a typo.
--
-- The third statement is idempotency for a send, and it is deliberately the
-- same shape as events_one_checkin_idx (0009): a unique index over a payload
-- key, so `recordEvent`'s existing `ignoreConflict` path returns null on the
-- second attempt and the caller knows not to send. No push_sends table. The
-- send is an event like everything else (invariant 1), and what was sent to
-- whom is then answerable from the same place every other question is.
--
-- `slot` is the member's local date and the tick it fired in, "2026-09-17T19:15".
-- One digest per slot per person is what the index enforces, which caps a
-- runaway tick at one notification per fifteen minutes even if every other
-- guard fails.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    -- The push service's own URL for this device. Unique by construction.
    endpoint   text        PRIMARY KEY,
    user_id    text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The two halves of the encryption key the browser generated. Useless
    -- without the endpoint, and the endpoint is useless without our VAPID key.
    p256dh     text        NOT NULL,
    auth       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- Last time the push service accepted a delivery. A row that has never
    -- succeeded is how a misconfigured VAPID key shows up.
    last_ok_at timestamptz
);

-- The tick enumerates subscribers and then reads each one's devices.
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
    ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS activity_reminders (
    user_id  text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type_key text NOT NULL,
    -- "HH:mm", wall clock, in the member's zone at the moment it fires.
    at       text NOT NULL,
    PRIMARY KEY (user_id, type_key, at)
);

-- One digest per person per tick, whatever else goes wrong. Partial, so it
-- costs nothing on the millions of rows that are not pushes.
CREATE UNIQUE INDEX IF NOT EXISTS events_one_push_idx
    ON events (user_id, (payload->>'slot'))
    WHERE type = 'push.sent';
