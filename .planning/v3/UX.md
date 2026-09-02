# UX.md — Navigation and visual language

The objective: a rich habit tracker whose interface is easy and dumb enough that
a user wastes zero time in it. Everything below serves that.

## Navigation

Five bottom tabs (decision 21).

| Tab | Route | Holds |
|---|---|---|
| Home | `/` | Today at a glance: what is due, what is done, one-tap check-ins |
| Activities | `/activities` | The catalog, your activities, and all their configuration |
| Groups | `/groups` | Your groups, invites, the group hub |
| Stats | `/stats` | Charts and history across your activities |
| Settings | `/settings` | Appearance, personal, data controls, sign out |

Admin stays a header link for admins only, never a tab. The tab bar hides on
`/signin`, `/pending` and `/admin/*`, as it does today.

## Home

Home leads with **today's completion**, not one big streak number (decision:
per-activity streaks make a single headline number dishonest).

- Headline: "Today: 3 of 5 done", with the count carrying the emphasis.
- Then a row per activity due today: icon, name, its window or status, and an
  inline check-in action.
- Check-in is one tap. When the activity requires evidence, that tap opens the
  camera (`EVIDENCE.md`).
- Every row carries its own streak: the app's flame icon plus the day count.
- A row for an activity not scheduled today stays visible, greyed, at the bottom
  of the list. Decided during the mock review.
- Balances and groups summaries stay, below the activity list, as in v2.5.
- Empty states: a brand new user has no activities and no groups, and Home's job
  is to send them to Activities.

Home never records a check-in on load (invariant 9).

## Activities

The manager, and the place a new user starts.

- Your enabled activities, each with its configuration summary and its streak.
- A catalog of types to add, each with an icon, a one-word name, a line saying
  what it is, and a plus to add it.
- The top of the page carries your global score, shown to you and to nobody else.
- Per activity: period, schedule, frequency, windows, pass test, grace, evidence
  rules, and a disable or delete control.
- Config changes are effective-dated and land at the next period start
  (`ACTIVITIES.md`). The editor shows the going-forward configuration, not
  yesterday's.

## Groups

A list, then a hub per group. The hub has **four tabs, the same four in every
group**: Overview, Evidence, Standing, Settings. The set never changes shape
between a money group and a reputation-only one.

- **Overview**: what the group tracks, the member list (name, streaks, score,
  rank label), and one row linking to your own standing. No rank rings, no
  reputation dials. The number and the label already carry it.
- **Evidence**: today and yesterday only, then a load-older control. It is a
  recent log, never an archive.
- **Standing**: your number, rank, ceiling, and what moved it. When the group
  tracks money, the money owed sits here too, with a link to the full ledger.
  When it does not, one line says so.
- **Settings**: what you share (per activity, with a separate photos toggle),
  and for owners, the accepted activity types and the fines. One tab, because
  accepted types and fines are the same job. Leave group at the bottom.

The group header is one line: back and the group name. No chips, no counts, no
second colour. The member count belongs in Overview, where the members are.
Nothing competes with the tab row underneath it.

## Visual language

The app is minimal and monochrome and stays that way. Color is an accent, used to
focus attention, never decoration.

- IBM Plex Mono throughout. Zero border radius. No pill buttons.
- Dark by default, light theme via `data-theme`.
- **Activity icons.** Every type gets its own icon so it is recognisable without
  reading the name. One consistent set: 24px viewBox, 1.6px stroke,
  `currentColor`, geometric, no emoji, no generic clip-art line icons. Specified
  during the mocks.
- **Rank icons and colors** are specified in `RANKS.md`.
- **Minimal color.** The streak flame gradient and the rank colors are the palette
  additions. Everything else stays on the existing tokens.
- **Minimal animation.** A flame flicker, a rank icon resolving when the rank
  changes, a check-in confirming. Short, once, never looping decoration.
- **Badges.** A single 5px round dot in the penalty colour on the icon corner,
  the one deliberate curve in an app of squares, so it reads as a status light.
  No counts. The Groups tab marks pending invites, the Admin header link marks
  pending admin work. Nothing else badges.
- The house rule holds: color is never the only carrier of meaning. Shape and
  label carry it too.
- Avoid the drift list in `CLAUDE.md`: no purple gradients, no glassmorphism, no
  rounded shadowed cards, no centred gradient hero text, no emoji as section
  markers.

## Voice

Curfew is a clerk. It states facts and consequences.

- "Window closes 07:45. Miss it and today does not count." is the register.
- "Great job on your streak!" is not.
- Ranks state a record, they do not congratulate.
- No em-dashes anywhere, in UI copy or anywhere else.
