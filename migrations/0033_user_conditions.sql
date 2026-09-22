-- A condition somebody writes themselves (DECIDED 1.19, 3.1).
--
-- The five conditions v4 adds are ours. This is the other half of the same
-- decision: the list is ours PLUS yours, and yours is a row here rather than a
-- module. `activity_types` is the registry and a member cannot write to the
-- registry.
--
-- WHAT IT HOLDS AND WHAT IT DOES NOT. The label, and nothing else about the
-- condition. The window it is confirmed in, the schedule and the sharing
-- toggle are the same tables every other tracked activity uses, keyed by
-- `condition:<id>`, because a member-written condition IS a tracked activity
-- and giving it a parallel set of tables would be a second place every one of
-- those facts lives.
--
-- IT CARRIES NO CATEGORY, and that is the rule rather than an omission (1.19).
-- Nothing can know whether "no doomscroll" is a MIND thing, and Monk mode's
-- four required categories exist so the number means the same for everybody.
-- A condition somebody wrote counts toward its own streak and toward nothing
-- else.
--
-- RETIRED, NEVER DELETED. A check-in made against one is an event, and events
-- do not go away (invariant 1). A retired condition stops being offered and its
-- history stays readable, which is the same shape as stopping tracking anything
-- else. Deleting the row would leave `checkin.condition:<id>.declare` events
-- pointing at a label nothing can resolve, and the ledger would print a blank.
--
-- ADDITIVE. Nothing reads this table until the code that creates one ships, so
-- it goes before the tag like everything else in v4.
CREATE TABLE IF NOT EXISTS user_conditions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    retired_at  timestamptz
);

-- One live condition per name, per person. Partial, so retiring "No doomscroll"
-- and writing it again later is allowed: the old one keeps its history and the
-- new one is a new activity with a new key.
--
-- `lower()`, because "No Doomscroll" and "no doomscroll" are the same thing to
-- everybody except a byte comparison.
CREATE UNIQUE INDEX IF NOT EXISTS user_conditions_live_idx
    ON user_conditions (user_id, lower(label)) WHERE retired_at IS NULL;

-- Home and the catalog both ask "what does this person have live", which is
-- every read of this table that happens on a page load.
CREATE INDEX IF NOT EXISTS user_conditions_user_idx
    ON user_conditions (user_id) WHERE retired_at IS NULL;
