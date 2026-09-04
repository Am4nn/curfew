-- ===========================================================================
-- 0016  Hiding an invite without answering it.
--
-- An invite has two answers, accept and decline, and both are final. Neither
-- covers "I have seen this and I do not want it sitting on my home screen."
-- Declining to get rid of the card is the wrong reason to decline: it revokes
-- the invite and the person who sent it cannot tell that apart from a refusal.
--
-- So dismissing is its own thing. The row stays pending, the sender sees no
-- change, and an invite link already in hand still works. It just stops being
-- listed anywhere in the app.
--
-- This is the recipient's decision, and an invite has exactly one recipient
-- email, so it lives on the invite row rather than in a table of its own.
-- ===========================================================================

ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- Every list of invites reads pending-and-not-dismissed for one email.
CREATE INDEX IF NOT EXISTS group_invites_visible_idx
    ON group_invites (email)
    WHERE status = 'pending' AND dismissed_at IS NULL;
