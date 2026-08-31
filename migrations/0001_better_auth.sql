-- Better Auth core tables. Owned by Better Auth; ids are TEXT, names PLURAL.
-- This mirrors src/db/schema/auth.ts. Regenerate with `bun run auth:generate`
-- if the Better Auth version changes its expected shape, then reconcile.
--
-- These must exist before 0002 (schema.sql) because it FKs users(id) and
-- sessions(id).

CREATE TABLE IF NOT EXISTS users (
    id             text PRIMARY KEY,
    name           text NOT NULL,
    email          text NOT NULL UNIQUE,
    email_verified boolean NOT NULL DEFAULT false,
    image          text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    id         text PRIMARY KEY,
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
    id                       text PRIMARY KEY,
    user_id                  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id               text NOT NULL,
    provider_id              text NOT NULL,
    issuer                   text,   -- Better Auth 1.7+: account identity scoped by issuer
    access_token             text,
    refresh_token            text,
    id_token                 text,
    access_token_expires_at  timestamptz,
    refresh_token_expires_at timestamptz,
    scope                    text,
    password                 text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
    id         text PRIMARY KEY,
    identifier text NOT NULL,
    value      text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
