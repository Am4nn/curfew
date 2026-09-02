-- v3. Whether a user tracks a type, as distinct from how they have it set up.
--
-- The split matters. A user's SETTINGS (schedule, windows, targets, grace) are
-- scoring config: insert-only with a future effective_from, so a change never
-- rewrites a period in progress (invariant 4). They already live in
-- user_activity_config.
--
-- Whether the activity is ON is operational, and must take effect at once.
-- ACTIVITIES.md says stopping an activity "stops producing periods that day",
-- and decision 59 says nothing turned off may create a retroactive miss. If
-- switching off were future-dated, the day you quit would still be scored and
-- would score as a miss, which is precisely the retroactive miss decision 59
-- forbids. So this table carries effective_at timestamptz, like app_settings,
-- and invariant 4 continues to govern the settings rather than the switch.
--
-- Append-only either way: a change is a new row, so "were they tracking this
-- last Tuesday" stays answerable and verify does not report old periods as
-- drift.
CREATE TABLE IF NOT EXISTS user_activities (
  id           bigserial PRIMARY KEY,
  user_id      text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_key     text        NOT NULL,
  enabled      boolean     NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activities_scope_effective_idx
  ON user_activities (user_id, type_key, effective_at DESC, id DESC);

-- Answering "how many people track Sleep" for admin Controls, without scanning
-- the whole table per type.
CREATE INDEX IF NOT EXISTS user_activities_type_idx
  ON user_activities (type_key, effective_at DESC, id DESC);
