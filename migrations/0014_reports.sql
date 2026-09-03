-- ===========================================================================
-- 0014  Reports, and a reason on a ban.
--
-- Photos of people, in a group, means rules and a way to enforce them
-- (TRUST-SAFETY.md). Any member can report a photo or a person; reports go to
-- admins, who can remove the photo and suspend or ban the account.
--
-- A report is append-only like everything else: reviewing one sets its outcome
-- and who decided, and never deletes the row. What was reported and what was
-- done about it has to stay answerable.
-- ===========================================================================

CREATE TABLE reports (
    id           bigserial PRIMARY KEY,
    reporter_id  text NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    -- Who or what is being reported. evidence_id is null for a report about a
    -- person rather than one photograph.
    subject_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evidence_id  bigint REFERENCES evidence(id) ON DELETE SET NULL,
    group_id     uuid REFERENCES groups(id) ON DELETE SET NULL,
    reason       text NOT NULL,          -- nsfw | someone_else | personal_info | other
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    -- open | upheld | dismissed
    outcome      text NOT NULL DEFAULT 'open',
    reviewed_by  text REFERENCES users(id),
    reviewed_at  timestamptz
);

CREATE INDEX reports_open_idx ON reports (created_at DESC) WHERE outcome = 'open';
CREATE INDEX reports_subject_idx ON reports (subject_id, created_at DESC);

-- One open report per person per photo. A pile-on is one report, not fifty.
CREATE UNIQUE INDEX reports_one_open_idx
    ON reports (reporter_id, subject_id, COALESCE(evidence_id, 0))
    WHERE outcome = 'open';

-- Why an account was disabled, so a ban can be told from an admin tidying up.
ALTER TABLE user_approvals ADD COLUMN IF NOT EXISTS disabled_reason text;
