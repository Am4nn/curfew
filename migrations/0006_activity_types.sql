-- v3, decision 63. Which activity types the app offers.
--
-- The module registry in code says what a type IS. This table says only whether
-- it is AVAILABLE, which is the one thing an admin changes at runtime. A type is
-- offered when it has a row here AND the latest row is enabled, so a module in a
-- branch that nobody has reconciled cannot reach anyone.
--
-- Append-only and effective-dated, like every other config table. A change is a
-- new row, never an UPDATE, because decision 59 requires answering "was this
-- type on last Tuesday" and `bun run verify` would otherwise report every past
-- period as drift the first time an admin toggled anything.
--
-- effective_at is a timestamptz, not a date: admin switches take effect
-- immediately (decision 65). That is the narrow carve-out from invariant 4,
-- which continues to govern scoring config. See .planning/v3/CONFIG.md.
CREATE TABLE IF NOT EXISTS activity_types (
  id           bigserial PRIMARY KEY,
  type_key     text        NOT NULL,
  enabled      boolean     NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  changed_by   text        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Resolution is always "the latest row at or before an instant", for one key or
-- for all of them. This index serves both.
CREATE INDEX IF NOT EXISTS activity_types_key_effective_idx
  ON activity_types (type_key, effective_at DESC, id DESC);
