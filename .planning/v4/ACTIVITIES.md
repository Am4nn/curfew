# The activities, as the modules declare them
**Generated. Do not edit.** `bun run doc:activities` rewrites it from
`src/domain/`, so it cannot drift from what the app actually does.

Every column here is a field on `ActivityType`. If a row looks wrong, the
module is wrong.

## What the columns mean

- **Carries** is 1.49: the one number this activity shows, on every surface.
  `consistency` for something you DO, where a consecutive count is an
  artifact. `streak` for an abstinence, where it is the achievement.
  **A `consistency` type shows no streak anywhere**, including to a group.
- **Press** is `checkin.kind`, which is what the button opens.
- **Cue** is C6: when you do it, which is also when Curfew asks and what
  the consistency measure reads a press against. `from the window` means
  the module declares none and the engine works backwards.
- **Fined** is how often a failed period can cost money. It is the
  activity's PERIOD, not a setting: a group sets the amount, and the
  module decides what a period is. Gym is the only weekly one.

## The eighteen

| Activity | Carries | Kind | How often | Fined | Press | Photo | Cue |
|---|---|---|---|---|---|---|---|
| **Cold shower** `coldshower` | consistency | body | Daily | a day | declare | none | 07:30 |
| **Food** `food` | consistency | food | Daily | a day | camera | required, live | 09:00, 13:30, 20:00 |
| **Gym** `gym` | consistency | body | Any 3 a week | a week | camera | required, live | 07:00 |
| **Office** `office` | consistency | mind | Weekdays | a day | tap | optional, live | from the window |
| **Reading** `reading` | consistency | mind | Daily | a day | number | optional, live | 21:00 |
| **Sleep** `sleep` | consistency | sleep | Daily | a day | camera | required, live on confirm | from the window |
| **Steps** `steps` | consistency | body | Daily | a day | number | optional, gallery | from the window |
| **Study** `study` | consistency | mind | Daily | a day | number | required, live | 19:00 |
| **Morning sunlight** `sunlight` | consistency | body | Daily | a day | declare | none | 08:00 |
| **Supplements** `supplements` | consistency | body | Daily | a day | camera | required, live | 09:30, 20:30 |
| **Water** `water` | consistency | body | Daily | a day | counter | none | 11:00, 15:00, 19:00 |
| **No alcohol** `alcoholfree` | streak | food | Daily | a day | declare | none | from the window |
| **No junk food** `junkfree` | streak | food | Daily | a day | declare | none | from the window |
| **Nightfast** `nightfast` | streak | food | Daily | a day | declare | none | from the window |
| **Screen** `screen` | streak | mind | Daily | a day | number | optional, gallery | from the window |
| **No social media** `socialfree` | streak | mind | Daily | a day | declare | none | from the window |
| **Sugar-free** `sugarfree` | streak | food | Daily | a day | declare | none | from the window |
| **Your own** `condition` | either, see C7 | none | Daily | a day | declare | none | from the window |

## The rule each one enforces

From `summary(config)` at the module's own defaults, which is the sentence
the configure screen puts above the controls.

- **Cold shower**: a cold shower, confirmed between 7:00 AM and 11:00 AM
- **Food**: 3 meals, a miss under 2, under 2,000 calories
- **Gym**: a session at the gym
- **Office**: in the office between 10:00 AM and 2:00 PM
- **Reading**: 30 minutes of reading
- **Sleep**: in bed between 9:30 PM and 11:00 PM, up between 5:30 AM and 7:00 AM, then a photograph 30 minutes after you say you are up
- **Steps**: 8,000 steps or more
- **Study**: 60 minutes of study
- **Morning sunlight**: sunlight before the hour you set, confirmed between 10:00 AM and 12:00 PM
- **Supplements**: 1 dose
- **Water**: 8 glasses of water
- **No alcohol**: no alcohol, confirmed between 8:00 PM and 11:59 PM
- **No junk food**: no junk food, confirmed between 8:00 PM and 11:59 PM
- **Nightfast**: nothing after 8:00 PM, confirmed between 6:00 AM and 11:00 AM
- **Screen**: 2 hours of screen time or less
- **No social media**: no social media after the time you set, confirmed between 8:00 PM and 11:59 PM
- **Sugar-free**: no sugar, confirmed between 8:00 PM and 11:59 PM
- **Your own**: the condition you set, confirmed between 8:00 PM and 11:59 PM

## What is the same for all of them

- **A fine is one failed period**, and `fineFor` reads consecutive failed
  periods. It never reads a streak, which is why 1.49 changes no money.
- **A group sets the amount**, per group, and can set it to nothing.
- **Settling and away days apply to every type**, because both move
  reputation and fines and neither touches a counter (1.44, 1.50).
- **Repair and grey apply only where a streak is carried** (1.50). Both are
  properties OF a streak, so they need no rule naming types.
- **Nothing outside a module knows what a type means** (invariant 6). Every
  column above is read through the registry, never by a `switch` on a key.
