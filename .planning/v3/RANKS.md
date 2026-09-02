# RANKS.md — Ranks

A rank is a label on the reputation number (`REPUTATION.md`), per user per
group. Five bands plus one title inside the top band. The arc is trusting
yourself more as the record grows: DOUBT to INTENT to PRACTICE to DISCIPLINE to
UNBROKEN to IMMACULATE.

## Bands

Rank 1 is the highest. Bands are deliberately uneven: the early ones are narrow
so early progress is visible, the top ones are wide so they take real time.

| Rank | Name | Range | Meaning |
|---|---|---|---|
| 5 | DOUBT | 0-99 | Your record does not back you |
| 4 | INTENT | 100-349 | **Start here.** You have said what you will do |
| 3 | PRACTICE | 350-599 | You are doing it, most of the time |
| 2 | DISCIPLINE | 600-849 | It holds when it is inconvenient |
| 1 | UNBROKEN | 850-1000 | The record has no meaningful gaps |
| — | IMMACULATE | 950-1000 | A title inside UNBROKEN, not a sixth band |

Everyone starts at 200, which is rank 4, so rank 5 is somewhere you fall to, not
somewhere you begin. That is the intended sting: dropping to DOUBT means all you
have left is the intention.

IMMACULATE is a title, not a band. A member at 960 is UNBROKEN and IMMACULATE.
Displays that have room show the title; compact rows show the band.

## Colors

Every value except gold already exists in the app's palette, so ranks add one new
color.

| Rank | Token | Value | Source |
|---|---|---|---|
| DOUBT | `--rank-doubt` | `#8a4f49` | `--penalty`, desaturated |
| INTENT | `--rank-intent` | `#8c8c8c` | `--muted` |
| PRACTICE | `--rank-practice` | `#7fa8ff` | `--accent` |
| DISCIPLINE | `--rank-discipline` | `#6ba17f` | `--pass` |
| UNBROKEN | `--rank-unbroken` | `#ff7a2f` | mid stop of the streak flame gradient |
| IMMACULATE | `--rank-immaculate` | `#f2f2f2` with a `--gold` hairline | `--fg` plus `#ffd23f`, the gradient's gold stop |

New tokens: the six above plus `--gold: #ffd23f`.

The ladder reads red, gray, blue, green, orange, white. Each is distinguishable
from its neighbours in both themes. Check contrast on the light theme before
shipping; `--rank-intent` on light needs a darker variant.

## Icon

**Rings are rejected, and so is the pure geometric ladder.** The icons are the
Lucide / Phosphor idiom, MIT-safe for an open-source repo (decision 42).

| Rank | Icon |
|---|---|
| DOUBT | Shield, slashed |
| INTENT | Sprout |
| PRACTICE | Target |
| DISCIPLINE | Shield, ticked |
| UNBROKEN | Summit |
| IMMACULATE | Crown |

The two shields are a deliberate pair: the promise broken and the promise kept.
The shape carries the rank on its own, so colour is never the only signal, and
every icon survives at 14px in a member row.

## Colour

**Palette A** (decision 41): built from tokens already in the app. Penalty
desaturated, muted, accent, pass, the flame mid stop, gold. Only gold is new.

## Glow

`CLAUDE.md` bans glow effects. One deliberate exception: **IMMACULATE only**, a
soft gold halo. It is the only glow in the app, which is what makes it mean
something. Every other rank uses solid color. Amend the `CLAUDE.md` drift list
to record the exception when the icon set is chosen.

## Copy

Clerk voice. The rank states a fact about the record.

- "DISCIPLINE. 640 in Weekend Club." is the register.
- "You reached DISCIPLINE, great work!" is not.
- 1000 is never presented as a goal. If the UI mentions it: "1000 is approached,
  not reached."

## Where ranks appear

- The group member list: name, number, rank label, rank icon.
- Your own group header: your number and rank.
- Nowhere on Home. Home is personal and group-independent.
- Never for the hidden global score.
