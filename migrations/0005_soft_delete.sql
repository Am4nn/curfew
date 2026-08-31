-- Soft-delete for users. Groups and activities already have archived_at.
-- A disabled user is blocked at the sign-in gate and stops being scored (their
-- memberships are marked left as of the disable date). Nothing is hard-deleted:
-- events, ledger and balances survive, and the flag is reversible.
ALTER TABLE user_approvals ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
