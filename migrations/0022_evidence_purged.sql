-- ===========================================================================
-- 0022  Two facts about a deleted photograph, held apart.
--
-- `deleted_at` had been carrying two meanings at once: the person pressed
-- Delete, and the file is gone from the bucket. Keeping them in one column is
-- what forced the delete to happen inside the request. The object had to go
-- first, because a row saying a photograph had been removed while the file sat
-- in the bucket is the failure that actually matters, and the column could not
-- say "asked for, not yet gone". So forty photographs meant forty round trips
-- from sin1 to R2, one after another, with the person watching a spinner for
-- all of them.
--
-- Split in two and the wait goes away without the promise weakening:
--
--   deleted_at   the person asked, or retention came due. From this instant
--                the row is invisible on every screen and no presigned URL
--                will ever be issued for it again, so the photograph is
--                already unreachable by anyone.
--   purged_at    the object is gone from the bucket. Written by the nightly
--                sweep, which is now the only thing that deletes an object.
--
-- The dangerous state is a row that says deleted while the file survives, and
-- that state is now NAMED rather than avoided: deleted_at set, purged_at null.
-- The sweep's third case selects exactly that and is what closes it. A file can
-- outlive the press by at most one night, and nothing can lose track of it,
-- because the row that points at it is never removed.
--
-- Item 13 of .planning/v3.1/SCOPE.md.
-- ===========================================================================

alter table evidence add column if not exists purged_at timestamptz;

-- Every row already marked deleted had its object removed first: that was the
-- old order, in both delete paths and in both sweep cases. So they are purged,
-- and saying so keeps the sweep from walking the whole history of deletions
-- asking R2 to remove files it removed months ago.
update evidence set purged_at = deleted_at where deleted_at is not null;

-- The sweep's third case reads this and nothing else. Partial, so it indexes
-- the work outstanding rather than every photograph ever deleted: the rows
-- leave the index as they are purged, and the steady state is near empty.
create index if not exists evidence_unpurged_idx
  on evidence (deleted_at)
  where deleted_at is not null and purged_at is null;

comment on column evidence.purged_at is
  'When the object was deleted from the bucket. Null with deleted_at set means the person has asked and the nightly sweep has not run yet: the photograph is already unreachable, the file is not yet gone.';
