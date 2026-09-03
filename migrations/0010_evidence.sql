-- ===========================================================================
-- 0010  Evidence photos.
--
-- No image ever passes through a serverless function (decision 71). The browser
-- compresses, asks for a presigned PUT, uploads straight to R2, and only then
-- sends the check-in. So a row here exists BEFORE its object and before its
-- check-in, and the interesting states are the broken ones:
--
--   row, no object       the browser asked for a URL and never uploaded
--   row, object, no event the upload finished and the send never happened
--   object, no row       impossible through the app; swept by key prefix
--
-- `events` stays the only source of truth (invariant 1). This table holds what
-- an event cannot: the object key, its size and type, and the date it must be
-- deleted. `confirmed_at` is a convenience: whether a photo is confirmed is
-- derivable from whether a check-in event carries its key, and the sweep uses
-- the event rather than this column when the two could disagree.
--
-- Retention is 60 days from upload. The check-in, the score and the streak are
-- kept; only the photograph goes.
-- ===========================================================================

CREATE TABLE evidence (
    id           bigserial PRIMARY KEY,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_key     text NOT NULL,
    step         text NOT NULL,
    period_start date NOT NULL,
    -- The press this photo belongs to. The check-in event carries the same key,
    -- which is what ties an object to a check-in without a transaction.
    idem         text NOT NULL,
    object_key   text NOT NULL UNIQUE,
    content_type text NOT NULL,
    bytes        integer NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    delete_after date NOT NULL,
    deleted_at   timestamptz
);

-- One photo per press. A retried upload for the same press replaces nothing and
-- is refused, so a stuck client cannot fill the bucket.
CREATE UNIQUE INDEX evidence_one_per_press_idx ON evidence (user_id, idem);

-- The sweep's two queries: what is past its date, and what was never confirmed.
CREATE INDEX evidence_expiry_idx ON evidence (delete_after) WHERE deleted_at IS NULL;
CREATE INDEX evidence_unconfirmed_idx ON evidence (requested_at)
    WHERE confirmed_at IS NULL AND deleted_at IS NULL;

-- Showing a member's evidence to their group reads by user and period.
CREATE INDEX evidence_user_period_idx ON evidence (user_id, type_key, period_start);
