-- ===========================================================================
-- 0013  Consent.
--
-- A hidden score that affects people is acceptable when documented and
-- indefensible when discovered, so what Curfew records is stated plainly and
-- accepted before the app can be used (TRUST-SAFETY.md).
--
-- Versioned, because the text will change and an old acceptance does not cover
-- new wording. Append-only: a re-acceptance is another row, never an update, so
-- what somebody agreed to and when is always answerable.
-- ===========================================================================

CREATE TABLE consent_records (
    id          bigserial PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version     int NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX consent_one_per_version_idx ON consent_records (user_id, version);
CREATE INDEX consent_user_idx ON consent_records (user_id, version DESC);
