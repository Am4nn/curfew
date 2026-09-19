# The Docket

The visual system the mocks are drawn in. It replaces Ember, which contradicted
them and is now retired.

The canvas is at https://claude.ai/artifact/U6x8pi4khQX5qxBSGEiHyi

## What went wrong first, because it explains every rule below

The first three passes produced a grey rounded card, a grey rounded card, iOS
system pink, a flame on every row, green ticks, gradient avatar discs and inset
rounded photographs. That is the default dark-mode habit tracker, and a tester
would be right to call it generic.

It got there by discarding what Curfew already had. The built app is IBM Plex
Mono throughout, zero border radius, hairline rules, true black and a clerk's
voice. That is a real identity. Swapping it for iOS defaults is not a redesign,
it is erasure, and it is the reason the mocks looked like everything else.

So the brief stands, iOS-first and BeReal-like, but it is carried out in
Curfew's own face rather than Apple's.

## Two faces, two jobs

**The system stack is people talking.** Activity names, sentences, member
names, screen titles. `-apple-system, BlinkMacSystemFont, 'SF Pro Text'`.

**The monospace is the record.** Every number, every time, every code, every
label. `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace`, which on an
iPhone resolves to SF Mono, so the app stays native instead of shipping a
webfont. It is also tabular by construction, which is why a column of times
down the right of Home lines up exactly.

The split is not decoration. It is the same distinction the codebase already
makes between what a module says to a person and what the ledger records.

| Role | Face | Size | Weight | Tracking |
|---|---|---|---|---|
| Screen title | system | 30 | 700 | -0.015em |
| Figure | mono | 40 to 62 | 500 | -0.04em |
| Section label | mono caps | 10.5 | 600 | 0.16em |
| Row name | system | 16.5 | 500 | 0 |
| Row detail | system | 13.5 | 400 | 0 |
| Data, times, counts | mono | 12.5 to 13 | 500 to 600 | 0.02 to 0.08em |
| Micro label | mono caps | 9 to 11 | 600 to 700 | 0.1 to 0.16em |

## Zero radius

Nothing structural is rounded. Not a row, not a button, not a field, not a
section, not a photograph.

Three things are round, and each has a physical reason:

- **A face.** Avatars are circles because faces are.
- **A lens.** The camera shutter is a circle because it is a lens.
- Nothing else.

Buttons are rectangles. The primary one is a solid accent block with black
monospace capitals on it; the secondary is a hairline box.

## No cards

Sections are made of **hairlines and space**. A filled grey rectangle around a
group of rows is the single strongest tell of a generated interface, and it is
banned.

- Section rule: 1px `rgba(255,255,255,0.22)`, full width inside the 20px margin.
- Row separator: 0.5px `rgba(255,255,255,0.11)`, and the first row in a list has
  none, so a list opens and closes on a heavier rule.
- A list always closes on a section rule. A list that just stops reads as
  unfinished.

## One accent, and it means one thing

`#ff4d17`. It says **this is still open**. Nothing else may wear it.

That rule does real work. It is why:

- A done row has no accent anywhere, only the time it was logged.
- A run that is going fine is plain white, not orange. A run is not a task.
- Money is monochrome. Green for owed and red for owing is what every finance
  screen does, and it is wrong here because Curfew never moves a rupee. The
  words carry the direction.

**Done is quiet.** That is the whole difference between a clerk and a coach, and
it is the reason there are no green ticks and no flames on this canvas.

Colour is never the only thing carrying a meaning, so a missed box is struck
through as well as dimmed, and a rank has its name printed beside its swatch.

### The exceptions, both earned

- **The five rank bands** carry their real colours from `src/domain/ranks.ts`:
  `#8a4f49`, `#8e8e93`, `#7fa8ff`, `#6ba17f`, `#ff7a2f`. The band name is always
  printed next to the colour.
- **IMMACULATE** carries a gold halo, `#ffd23f`. It is the only glow in the
  entire app, which is the entire reason it means anything. Nothing else may
  glow, ever.

## The punch card

Seven boxes across the top of Home, one per tracked activity, each with a
three-letter code: `WAT REA FOO SUP SLE NGT GYM`.

- **Done**: dim fill, dim code.
- **Open**: transparent, accent border, accent code.
- **Missed**: dim fill, code struck through in `#ff3b30`.

It is the app's one piece of iconography, it says *which* rather than *how
many*, and it reappears at half size as the week table on a group screen and at
full size under the stamp when a day closes. Three screens, one object.

It also replaces the six stacked flames, which were the most generic thing on
the old canvas.

## Photographs

Full bleed, edge to edge, zero radius, caption underneath. An inset rounded
photograph is Instagram; a full-bleed one is BeReal, and it is the single
biggest signal that this is an app rather than a web page.

Stand-ins are built the way a photograph is lit rather than as one soft
gradient: one source, one mass where the subject sits, a fall-off top and
bottom, and a vignette. A single blurred gradient reads as a smear.

## Icons

Almost none. The activity icons are gone from every list, because a state mark
plus a name is more useful than a line icon plus a name, and because generic
stroke icons as row markers are on the project's own list of things to avoid.

What remains is geometric and hard-edged: the tab bar, a chevron, a camera, a
plus. Tab icons are **filled when active and hairline when not**, which is what
iOS actually does.

## Layout

- 390 wide, 20px side margins.
- Section heading and its right-hand counter share a baseline.
- A list row is name and value on the first line, detail and run on the second.
- Every frame on the canvas is measured to its content and set to exactly that
  height, so nothing clips and nothing has dead ground under the tab bar. The
  measuring harness lives in the session scratchpad and renders each artboard
  with a stand-in for the canvas runtime.

## Retired

**Ember is retired.** It called for monospace numerals, which survives here, but
also gradients and a plum-black ground, which contradict the mocks. It was drawn
before the brief settled on iOS-first and BeReal. This file replaces it.
