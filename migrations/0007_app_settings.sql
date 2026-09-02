-- v3, decisions 64 to 67. Operational state an admin changes at runtime.
--
-- Every table here is append-only and effective-dated, like activity_types and
-- every other config table. A change is a new row, never an UPDATE. Decision 59
-- requires answering "was money on last Tuesday", and `bun run verify` would
-- report every past period as drift the first time anyone toggled anything.
--
-- The column is `effective_at timestamptz`, not `effective_from date`, because
-- admin switches take effect immediately (decision 65). That is the narrow
-- carve-out from invariant 4, which continues to govern scoring config: a
-- user's windows and a group's fines stay future-dated. A period is judged
-- against the settings as they stood WHEN THE PERIOD CLOSED.

-- App-wide switches. Keys: money, photo_evidence, new_groups, invites, signups,
-- retention_days. The value is jsonb so a boolean switch and a number share one
-- table without a column per setting.
CREATE TABLE IF NOT EXISTS app_settings (
  id           bigserial PRIMARY KEY,
  key          text        NOT NULL,
  value        jsonb       NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  changed_by   text        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_settings_key_effective_idx
  ON app_settings (key, effective_at DESC, id DESC);

-- Per-group overrides an admin sets in the Groups tab (decision 66). Same shape
-- as app_settings, one scope down. This is how a single group keeps money while
-- it is off everywhere else.
--
-- It is a settings table rather than a column on group_activity_types, because
-- money is a property of a group and not of a group's relationship to one
-- activity type. Putting it there would have made "money" a row with a type_key
-- that means nothing.
CREATE TABLE IF NOT EXISTS group_settings (
  id           bigserial PRIMARY KEY,
  group_id     uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  key          text        NOT NULL,
  value        jsonb       NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  changed_by   text        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_settings_scope_effective_idx
  ON group_settings (group_id, key, effective_at DESC, id DESC);

-- Which activity types a group accepts. A member can only share a type the
-- group accepts, and the owner sets the fine per accepted type.
CREATE TABLE IF NOT EXISTS group_activity_types (
  id           bigserial PRIMARY KEY,
  group_id     uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type_key     text        NOT NULL,
  accepted     boolean     NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  changed_by   text        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_activity_types_scope_effective_idx
  ON group_activity_types (group_id, type_key, effective_at DESC, id DESC);

-- What an admin announced, and who has acknowledged it (decisions 57, 58).
-- A notice is a blocking overlay on every route: the app does nothing until it
-- is acknowledged, one at a time, and acknowledging is final. There is no
-- dismiss, only "Got it", so an ack row is the whole state.
CREATE TABLE IF NOT EXISTS notices (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  body       text        NOT NULL,
  created_by text        NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set when an admin retires a notice that has served its purpose. Existing
  -- acknowledgements are kept: they are a record of who saw it.
  retired_at timestamptz
);

CREATE TABLE IF NOT EXISTS notice_acks (
  notice_id      uuid        NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id        text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS notice_acks_user_idx ON notice_acks (user_id);
