-- ===========================================================================
-- 0024  A photograph belongs to the groups it was sent to.
--
-- Until now it belonged to nobody, and which groups could see it was worked out
-- on every read from the CURRENT share state: the member shares this type with
-- this group today, so every photograph they ever took of it is in the feed.
-- Turning sharing on handed over the back catalogue. Joining a group and
-- turning sharing on handed over a back catalogue to people who were not there
-- for any of it.
--
-- `joined_at` was patched over the worst of that, and it is a date, so a member
-- who joined at two in the afternoon still saw that morning's photographs. This
-- table ends the question rather than narrowing it: a photograph is tagged with
-- the groups sharing that activity AT THE MOMENT THE CHECK-IN IS SENT, and
-- never again. A group added to your sharing tomorrow gets tomorrow's
-- photographs. It never gets this one.
--
-- Two things make that hold, and both are the primary key:
--
--   - Tagging is insert-only, on conflict do nothing. A re-share cannot add a
--     tag that was revoked, because the row is already there.
--   - So `revoked_at` is final. Sharing again, or leaving and rejoining, does
--     not bring a photograph back, which is what a person un-sharing means.
--
-- `revoked_at` rather than a delete, for the reason ledger_entries keeps its
-- corrections as rows: what a group could see and when is a fact about the past
-- and stays answerable. Your Photos reads it, which is why a group that saw a
-- photograph once still appears there, struck through.
--
-- ON DELETE CASCADE from evidence is right and is not a hole: deleting the
-- photograph is the one thing that really does end the visibility, because
-- there is nothing left to be visible.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS evidence_groups (
    evidence_id bigint      NOT NULL REFERENCES evidence (id) ON DELETE CASCADE,
    group_id    uuid        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    tagged_at   timestamptz NOT NULL DEFAULT now(),
    -- Set once, when sharing stops or the member leaves. Never cleared.
    revoked_at  timestamptz,
    PRIMARY KEY (evidence_id, group_id)
);

-- The group's evidence tab: this group's live tags, newest first. The tab pages
-- on the evidence row's confirmed_at, so this index carries the group and the
-- filter and the join does the ordering.
CREATE INDEX IF NOT EXISTS evidence_groups_group_idx
  ON evidence_groups (group_id)
  WHERE revoked_at IS NULL;
