-- ===========================================================================
-- 0015  Freeze the name onto every ledger row.
--
-- ledger_entries held only from_user_id and to_user_id, both pointing at
-- users. Deleting an account renames the person to "Former member"
-- (deleteAccount), so every historical debt lost its owner the moment they
-- left: the other members could still see the amount, and no longer see who.
-- A debt nobody can name is not a debt anyone can settle.
--
-- So the name is copied onto the row at the moment it is written and never
-- looked up again. This does not fight invariant 3: the columns are written
-- once, at insert, and nothing ever rewrites them. A row is a record of what
-- was owed, by whom, on the day it was charged.
--
-- The name is deliberately NOT removed by deletion. It is the one piece of a
-- deleted account that survives, which is why /settings/data and the consent
-- text both have to say so.
-- ===========================================================================

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS from_user_name text;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS to_user_name   text;

UPDATE ledger_entries l
   SET from_user_name = COALESCE(u.name, 'Former member')
  FROM users u
 WHERE u.id = l.from_user_id
   AND l.from_user_name IS NULL;

UPDATE ledger_entries l
   SET to_user_name = COALESCE(u.name, 'Former member')
  FROM users u
 WHERE u.id = l.to_user_id
   AND l.to_user_name IS NULL;

-- Anything the join could not reach (a row whose user is already gone) still
-- has to carry something readable.
UPDATE ledger_entries SET from_user_name = 'Former member' WHERE from_user_name IS NULL;
UPDATE ledger_entries SET to_user_name   = 'Former member' WHERE to_user_name   IS NULL;

ALTER TABLE ledger_entries ALTER COLUMN from_user_name SET NOT NULL;
ALTER TABLE ledger_entries ALTER COLUMN to_user_name   SET NOT NULL;
