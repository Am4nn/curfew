# The v5 canvas, in the repo

`project/` is every artboard of the v5 design canvas, and `project/canvas.json`
is its index. `gen/` is what writes them.

The canvas is published at https://claude.ai/artifact/V5Q54R7heSttj1aXT5PVqP and
that is where it is looked at. These files exist so it is not the only copy.
Item 27 of v3.2 is the reason: `.design/` was gitignored, thirteen artboards
existed only on a canvas because of it, nothing in the repo knew they were
there, and regenerating would have destroyed them silently.

## The three photographs

`public/landing/{food,gym,sleep}.webp` are uploaded to the canvas and referenced
by their `/_blob/<id>` urls, which are in `gen/chrome.py`. They are the generated
images, not a member's evidence, which is what makes them safe on a board a
stranger can see.

## Running it

```
python gen/chrome.py     # nothing on its own: the shared chrome
python gen/batch1.py     # writes into project/
python gen/layout.py     # rebuilds project/canvas.json, and CHECKS
```

`layout.py` declares which board sits in which row, and it refuses to write the
index when a board's three heights disagree: the root element's, the `$preview`
hint's, and the frame `h`. They have to be the same number. When they are not,
`overflow: hidden` clips the content and the frame paints the difference as
empty background, which reads as a design choice rather than a bug. That cost an
afternoon on `Main`.

`CURFEW_V5_PROJECT` points the scripts at a copy somewhere else, which is what a
publishing session uses.

## What is NOT here

`gen/` does not cover the seventeen boards drawn before it existed. Those were
written by hand and are edited by hand; the generator covers the twenty added on
2026-09-21 plus the shared nav and tab bars. Editing an older board means
editing its file in `project/`.
