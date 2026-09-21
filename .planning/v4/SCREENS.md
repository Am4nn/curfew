# SCREENS.md — the v4 review gate

Every board on the v5 canvas, its route, and a box only a person may tick.

The canvas is https://claude.ai/artifact/V5Q54R7heSttj1aXT5PVqP and the sources
are in `.design/v5/project/`. **This file is generated from `canvas.json`** by
`.design/v5/gen/screens.py`, so a board cannot be missing from the gate: add a
board, re-run, get a row. The v3 file was written by hand, which is how thirteen
artboards came to exist only on a canvas with nothing in the repo knowing.

**The ticks are not generated.** They are a person's word, and re-running
preserves every one already set.

## The gate

A phase in `PLAN.md` is not done until, for every board it touched:

1. The route exists and renders in preview mode with seeded data.
2. It has been opened **side by side with the board** and compared: layout,
   spacing, copy, empty state, and the states in the Notes column.
3. The box is ticked, in the same commit as the screen.

**A phase cannot close with an unticked row it touched.** v3's file was never
ticked once, which is the whole reason this one says so.

**No screenshot tooling.** A reference capture is a capture of what was built,
so it locks in drift rather than preventing it. A person comparing to the board
catches what a diff never would.

**If the screen and the board disagree, that is drift.** Fix the code, or amend
the board and this row deliberately, and say which in the commit.

## Phase 0 — reference, nothing to build

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Mark` | `none, a reference sheet` | Construction, sizes, the lava, where it sits, and the four nevers. | [ ] |
| `Ren` | `none, a motion spec` | Six moods. Motion lives in the face; the body only breathes. | [ ] |

## Phase 1 — the five new types

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Activities` | `/activities` | Global score, the list, each with its streak. The gear is gone: Settings is reached from Home. | [ ] |
| `Catalog` | `/activities/add` | Simple ones as ONE entry over five, each with its category, then write-your-own marked NO CATEGORY. | [ ] |
| `Configure` | `/activities/[key]` | Sleep. The anchored confirm window, evidence required, the effective-from note. | [ ] |
| `Capture` | `/checkin/[key]` | Aim, review, done. Live camera only. The real meal photograph. | [ ] |
| `Declare` | `/checkin/[key]` | It held or I slipped, the streak at stake, the correction window. | [ ] |

## Phase 2 — the grouped row

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Main` | `/` | Seven tracked, the hero, the grouped Simple ones row open and closed, Monk row, at risk, the feed. Ren deferring to a nudge in ONE line. | [ ] |
| `Stamp` | `/` | The stamp LANDS: falls, hits, the page flinches, the square ring leaves on the impact frame. | [ ] |

## Phase 3 — Monk mode

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Stats` | `/stats` | Perfect days, three figures, the heatmap, per-activity bars. Ren speaks once. | [ ] |
| `Ranks` | `/ranks` | Your standing, the six bands, IMMACULATE with the only glow in the app. | [ ] |
| `Monk` | `/monk` | The percentage, no flame and no closes-at. Today, the week, a dash for 0 of 0. Ren reads the number. | [ ] |
| `MonkSetup` | `/monk/setup` | Compulsory, four kinds covered, the stricter bar for Water, Screen and Sleep, effective-dated. | [ ] |
| `MonkLocked` | `/monk` | Two of four kinds missing, with Add on each. Monk mode does not appear at all. | [ ] |
| `Restore` | `/` | After a miss. Grace offered, and what it costs. | [ ] |
| `Away` | `/settings/pause` | Four a month, what an away day does and the one thing it does not. | [ ] |

## Phase 4 — nudges, and the group

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Groups` | `/groups` | Invite banner, group list with rank and number. | [ ] |
| `Group` | `/group/[id]` | Tracks, members, your standing, the week, the shared feed. | [ ] |
| `GroupStats` | `/group/[id]/stats` | The week day by day, who carried it, what the group finds hard. Counted across the group, never per person. | [ ] |
| `Evidence` | `/group/[id]/evidence` | Today and yesterday, load older. Nothing from before you joined. | [ ] |
| `Standing` | `/group/[id]/standing` | Rank, money, the ceiling, movements. | [ ] |
| `Ledger` | `/group/[id]/ledger` | Every entry including a correction row. Append-only, said out loud. | [ ] |
| `GroupSettings` | `/group/[id]/settings` | Share toggles with the camera switch, Monk mode as a row, who runs it, the rules, leave. | [ ] |
| `Nudge` | `/group/[id]` | Four set messages, no typing, and the sent state. | [ ] |
| `Nudged` | `/` | One card, not an inbox. No reply button. Ren defers in one line. | [ ] |
| `Sharing` | `/settings/sharing` | Every group, every activity, the camera switch, Monk mode. | [ ] |
| `Notifs` | `/settings/notifications` | The switch, quiet hours, per activity, and what one sounds like. | [ ] |

## Phase 5 — the coach against a stub

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Coach` | `/coach` | Ren, three tiers of type, the photo insight, the chips, Ask Ren. One line per surface. | [ ] |
| `Admin` | `/admin/ops` | SCHEDULER first with four jobs, failures, the coach and the bill, evidence, drift, controls. | [ ] |

## Phase 6 — the model

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Switches` | `/settings/coach` | Ren off and nudges off, each showing its consequence. | [ ] |
| `CoachDown` | `/coach` | The night that failed, with the guarded retry. The ask box off, and `budget` flips the reason. | [ ] |
| `Memory` | `/settings/memory` | The paragraph as editable text, Edit and Clear, and the four notes about what it is. | [ ] |

## Phase 7 — the gate and the surface

| Board | Route | What it has to show | Done |
|---|---|---|---|
| `Splash` | `none, the app shell` | The mark alive, the word landing a letter at a time, one line. No spinner. | [ ] |
| `Signin` | `/signin` | Three generated photographs, the lockup, three numbered lines, invite-only. No member evidence anywhere on it. | [ ] |
| `Welcome` | `/welcome` | Three steps, unskippable. Step 1 carries "I do not want a coach" and the whole tutorial branches on it. | [ ] |
| `Notice` | `blocking overlay, any route` | Got it only, no dismiss, no version number. | [ ] |
| `Invite` | `/invite/[token]` | Share toggles, and an untracked type offering setup rather than a dead switch. | [ ] |
| `Settings` | `/settings` | Profile and settings on one page. Seven groups, checked row for row against the real screen. Admin only for an admin. | [ ] |
| `Photos` | `/settings/photos` | Newest first, read-only, and the 90 day retention said plainly. | [ ] |
| `Data` | `/settings/data` | What is held, the three deletes, and money is never deleted. | [ ] |
| `Consent` | `blocking overlay, any route` | All twenty sections. The accept button disabled until the end, with the progress rule. `returning` flips the two framings. | [ ] |

## Three boards have no route, and that is on purpose

`Mark` and `Ren` are reference sheets: the mark's construction and the mood set.
`Splash` is the app shell rather than a route. They are in the gate anyway,
because a reference sheet that drifts from the app is worse than none.

## What this replaces

`.planning/v3/SCREENS-retired.md`, retired on 2026-09-21 and kept as the record of what
v3 built. It is keyed to the `.design/` artboards, which are the old design, and
two of its rows were never ticked on purpose: Configure and Check-in, whose
three known differences it lists.
