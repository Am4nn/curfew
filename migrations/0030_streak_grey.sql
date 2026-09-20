-- A weekly streak that came short goes GREY rather than to zero.
--
-- The number only ever goes up. It does not fall on the Sunday of a week that
-- missed its minimum, and it does not fall the moment the minimum becomes
-- impossible. It holds, marked, with a choice attached: spend grace and carry
-- on, or let the next session start a new run.
--
-- Grey starts as soon as the week cannot be reached, which is usually before
-- the week has ended. Sessions logged after that still add and still count
-- against what the week came short, because somebody who turns up on the
-- Saturday and Sunday of a dead three-a-week missed one day of it, not three.
--
-- Derivable from events like everything else here (invariant 1), and stored for
-- the same reason `current` and `best` are: every screen that draws a streak
-- would otherwise walk that type's whole history to find out what colour it is.
ALTER TABLE activity_streaks
    ADD COLUMN IF NOT EXISTS grey boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN activity_streaks.grey IS
    'The run is over on the arithmetic but still recoverable with grace. The number holds; it does not reset until the next session in a later week.';
