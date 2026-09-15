-- ===========================================================================
-- 0023  A notice needs an identity, or publishing it twice announces it twice.
--
-- Every notice so far was composed from a controls change an admin had just
-- made, so it happened exactly once by construction: the save happened once.
-- Release notes are not like that. They are published by a script run by hand
-- after a tag, and a script run by hand is a script run twice. Without an
-- identity the second run inserts a second row, and because notices merge per
-- user at read time and an ack is per notice, everybody who had already
-- acknowledged the first one gets the overlay again saying the same thing.
--
-- `key` is that identity, and it is nullable on purpose. Notices composed from
-- a controls change carry none: they describe one particular save and there is
-- nothing to collide with. A release note carries "release:3.2.0" and the
-- unique index makes a second publish do nothing.
--
-- Partial, so the many NULLs from controls changes do not collide with each
-- other. A plain UNIQUE would treat them as distinct in Postgres and work, but
-- saying it here means nobody has to remember that it does.
-- ===========================================================================

ALTER TABLE notices ADD COLUMN IF NOT EXISTS key text;

CREATE UNIQUE INDEX IF NOT EXISTS notices_key_idx
  ON notices (key)
  WHERE key IS NOT NULL;
