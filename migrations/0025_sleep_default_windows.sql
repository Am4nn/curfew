-- ===========================================================================
-- 0025  The app-wide default sleep config, brought forward to v3.2.
--
-- 0002 seeded one NULL-scoped row: night 22:00 to 22:45, wake 06:00 to 07:00,
-- and a confirm window as two clock times. v3.2 moves all three (item 17). The
-- night is 9:30 PM to 11:00 PM and the wake 5:30 AM to 7:00 AM, and the confirm
-- is not a clock time any more: it opens half an hour after the WAKE press and
-- stays open half an hour, so it is not in config at all.
--
-- This is an UPDATE, and it is the one config row where that is right. Every
-- other row in this table belongs to a person and is the truth about how their
-- periods were judged, which is why they are insert-only and future-dated
-- (invariants 4 and 5). A NULL-scoped row belongs to nobody and is judged
-- against by nothing: `listUserActivities` selects on `user_id = $1` and never
-- sees it, so scoring has never read it. Its only reader is
-- `resolveUserSleepConfigRow`, which fills in the personal settings screen for
-- somebody who has not set sleep up. A person already tracking sleep has their
-- own row and is moved by `bun run migrate:sleep`, which future-dates properly.
--
-- Also rewritten into the shape every real save uses, `{schedule, config}`.
-- 0002 wrote the module's half as the whole blob, which is the older of the two
-- shapes this column has carried and the reason `moduleConfigOf` has to detect
-- which one it is looking at.
-- ===========================================================================

UPDATE user_activity_config
SET config = '{
      "schedule": {
        "schedule": {"kind":"days","days":[1,2,3,4,5,6,7]},
        "dayBoundary": "noon",
        "grace": 2,
        "minGap": 0
      },
      "config": {
        "night_open":"21:30","night_close":"23:00",
        "wake_open":"05:30","wake_close":"07:00"
      }
    }'::jsonb
WHERE user_id IS NULL AND type_key = 'sleep';
