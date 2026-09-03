# Contributing

Curfew is a personal habit tracker with evidence. Read `CLAUDE.md` first: it
carries the invariants, the conventions and the voice, and breaking an invariant
is a bug even when the tests pass.

## Getting it running

```
bun install
bun run local          # docker Postgres, mock data, no sign-in
bun run test           # domain core, no database
bun run typecheck
```

Three environment files, all gitignored, all carrying the same keys in the same
order. `.env.example` is the key list. A key missing from one does not fall back
to a default: it leaks in from `.env.local`, which Next loads on every
non-production run, so add a key to one and add it to all three.

| File | Database | Used by |
|---|---|---|
| `.env.local` | docker Postgres, `LOCAL_MODE=1` | `bun run local`, `local:*` |
| `.env.preview` | the shared preview project | `bun run dev`, `migrate`, `verify` |
| `.env.production` | the live project | `migrate:production` |

## Adding an activity type

This is the walkthrough, and it is deliberately short. **Adding a type never
edits the engine.** If you find yourself changing anything outside your own
file, the interface got something wrong; say so rather than working around it.

An activity type is one file, no React, under `src/domain/<key>/index.ts`.

### 1. Write the module

```ts
export const pushupsActivity: ActivityType<PushupsConfig, PushupsEvidence> = {
  key: "pushups",
  name: "Pushups",
  description: "A set count, every day you say",
  icon: "gym",
  defaults: { schedule: EVERY_DAY, dayBoundary: "midnight", grace: 2,
              config: { target: 50 } },
  configSchema, evidenceSchema,
  evidence: { level: "optional", source: "live", detail: "Live camera." },
  checkin: { kind: "number" },
  chart: "numeric",
  fields(config) { ... },   // what the configure screen draws
  steps(config) { ... },    // what can be checked in, and when
  windows(config, periodStart, timezone) { ... },
  evaluate(input) { ... },  // did the period pass
};
```

What each piece decides:

- **`fields`** is what the configure screen draws. `configSchema` says what is
  *valid*; this says what it *looks like*. Four control kinds exist and adding a
  fifth is an engine change, so try to want one of them.
- **`steps`** is what the check-in screen offers, its own words, and any numbers
  it asks for. `repeats: true` means the day can take several.
- **`windows`** resolves those steps to absolute instants for one period. Use
  `oneWindow` unless your type genuinely has several.
- **`evaluate`** returns `{ passed, detail }`. `detail` is yours; nothing
  outside your module ever reads it.
- **`hint`** is optional, and it is the line under the fields on the check-in
  screen. Only your module can write "1180 so far today. The limit is 2000."
- **`chart`** names which of four charts the stats screen draws. Not a new one.

### 2. Register it

```ts
// src/domain/index.ts
register(pushupsActivity);
```

### 3. Sync and enable it

```
bun run sync:activities
```

That inserts a row in `activity_types`, **disabled**. A type is only offered
once an admin enables it under Controls, which is what stops a half-finished
type reaching anyone. CI runs `sync:activities --check` and fails if a
registered module has no row.

### 4. Test it

Add cases to `src/domain/catalog.test.ts`, and if your type says anything on a
screen, to `configure.test.ts` or `checkin.test.ts`, which assert the words
verbatim against the mocks.

The one thing that will fail: `src/domain/no-db-imports.test.ts`. Domain code
never imports the database. If your type needs a fact that is not in its config
or its check-ins, that is a design problem worth raising.

## The rules that are not style

`CLAUDE.md` has the full list. The four that catch people out:

- **`events` is the only source of truth.** Everything else is rebuildable, and
  `bun run verify` proves it. If you need a fact that is not derivable from
  events, say so rather than adding mutable state.
- **Scoring reads only `checkin.*` events.** Never sessions, never `last_seen`.
  If ambient telemetry could affect a fine, the app rewards not opening it.
- **Resolve config as it stood on the period being scored**, never as it stands
  now. This applies to `/verify` too, or it reports all history as drift after
  any config change.
- **Nothing outside a module knows what a type means.** No `switch` on a type
  key outside the registry.

## Before you open a PR

```
bun run typecheck
bun run test
bun run build
bun run verify        # no drift against the preview database
bun run break-in      # the security round; exits non-zero if anything gives
```

If you touched a screen, open it beside its artboard in `.design/` and tick its
row in `.planning/v3/SCREENS.md` in the same commit. If the screen and the mock
disagree, that is drift: fix the code, or amend the mock and the row
deliberately. A screenshot test would only lock in whatever was built, which is
why the gate is a person.

## Voice

Applies to commits, comments and every string that ships. No em-dashes. No
emoji. Curfew is a clerk, not a coach: it states facts and consequences.
"Window closes 7:45 AM. Miss it and today does not count." is the register.
