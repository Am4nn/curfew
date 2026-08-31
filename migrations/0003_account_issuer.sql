-- Better Auth 1.7 scopes OAuth account identity by issuer. Add the column to
-- databases created before 0001 carried it. Nullable: credential accounts and
-- any pre-existing rows have no issuer.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS issuer text;
