# RELEASE.md — shipping to production

The runbook. Not version specific: `.planning/v3.2/SCOPE.md` and its siblings
say what a release contains, this says how it goes out.

It lives in the repo rather than anywhere else for the same reason
`release-notes.json` does: it names scripts, migrations and workflows, and when
one of those changes this has to change in the same commit or it starts lying.

**Production ships on a version tag, never on a push.** `main` is a Preview
deployment served at `dev.curfew.amanarya.com`. Vercel's production branch is
`production` and nobody pushes it.

---

## The rule that decides the whole order

**A migration and the code that needs it cannot land at the same instant, so
decide which way round breaks nothing.**

There are two kinds and they go on opposite sides of the deploy:

| Kind | Example | When |
|---|---|---|
| **Additive** | a new table, a new nullable column, a new index, a data update | BEFORE the tag |
| **Hostile** | `DROP COLUMN`, `NOT NULL` on an existing column, a rename | AFTER the promote |

Additive migrations are invisible to the running version, so they can sit there
waiting. A hostile one removes something the running version still uses, so
applying it early breaks the live app for the length of the deploy.

This is not theoretical. In 3.2.0, migration `0026` drops
`activity_streaks.grace_spent`, and v3.1.1, the version live at the time, wrote
that column on every streak upsert. Running all four pending migrations before
the tag would have broken streak writes for everyone until the promote
finished. Splitting them breaks nothing at all.

**So read every pending migration before you run any of them** and sort them
into the two columns. `migrate.ts` takes `--until <name or prefix>` and stops
after that file, which is how the split is done:

```
# before the tag: everything up to and including the last additive one
bunx dotenv -e .env.production -- bun run scripts/migrate.ts --until 0025

# after the promote: the rest
bun run migrate:production
```

It prints how many it held back, so the count is on screen rather than in your
head. The `migrate:production` script chains `sync-activities` after the runner,
so pass `--until` to `migrate.ts` directly as above; arguments on the script
would land on the wrong command.

---

## Before you start

Everything here is read-only. None of it changes production.

```
git status                          # clean, and on the commit you intend to ship
gh run list --branch main --limit 3 # CI green on that exact SHA
bun run check:cors:production       # the live bucket accepts curfew.amanarya.com
bun audit                           # no new advisories
```

**CI green on the same SHA is the gate that actually protects production**, and
`deploy.yml` enforces it. A tag will not deploy otherwise.

Then look at what production actually is, because an environment file says
nothing about what a deployment reads:

```
bunx vercel env ls production       # dates, not values. A variable older than
                                    # the branch it names has never been updated.
```

And confirm the database is where you think it is. Connect with
`.env.production` and read `_migrations`; never print a connection string.

---

## The order

### 1. Additive migrations

```
bun run migrate:production
```

Applies the pending files and then `sync:activities`. If any pending migration
is **hostile** by the table above, do not run this: apply the additive ones and
hold the hostile ones for step 6.

`sync:activities` inserts new activity types **disabled**. If this release adds
a type, an admin enables it in the console after the deploy, and until then
nobody can track it.

### 2. Version

`package.json` carries `X.Y.Z-dev` while the version is being built. Take the
suffix off in the commit that gets tagged.

```
# package.json: "version": "3.2.0"
git commit -am "3.2.0"
```

`deploy.yml` compares the tag against `package.json` and fails if they differ.
The admin header shows that number, so they have to agree.

### 3. Tag

```
git tag v3.2.0
git push origin v3.2.0
```

That runs `.github/workflows/deploy.yml`: typecheck, tests, the version check,
deploy, promote.

**The build happens on Vercel**, because environment variables are marked
sensitive and never returned to `vercel pull`, so a local `vercel build` fails
on the first one it reads.

### 4. Promote

The workflow does it. **A production deployment is staged until promoted**, so
deploying alone leaves the live domains on the previous build. Watch the run
finish rather than assuming.

```
bunx vercel ls                      # what Vercel actually built
```

### 5. Check it is alive

```
bun run check:signin -- --http=https://curfew.amanarya.com
```

This is the one check CI cannot run: both CI jobs that serve the app set
LOCAL_MODE, where `previewEnabled()` makes the middleware stand aside, so the
sign-in gate is the one code path the whole suite never takes. Run it after
anything touches `src/middleware.ts` or `public/`.

Then open the app and sign in.

### 6. Hostile migrations

Now that the new code is serving, apply anything held back in step 1.

### 7. Data migrations that move people

Scripts that change what an existing member experiences. Always `--dry` first,
read what it says, then run it live.

```
bun run migrate:sleep:production -- --dry
bun run migrate:sleep:production
```

3.2.0's is `migrate:sleep`, which moves members onto the anchored confirm
window, dated tomorrow in each member's own zone because invariant 4 forbids a
config change landing on a period already running.

**Forgetting one of these is silent.** The app works, the release note has been
read, and nobody's settings have actually moved.

**A dry run on dev proves the script runs, not that it works.** Dev had no sleep
configs at all when 3.2.0 shipped, so `migrate:sleep` reported "0 members" there
and its real behaviour was first exercised against production, where two members
carried retired confirm pairs. When dev cannot rehearse a migration, say so and
read the dry run on production especially carefully.

### 8. Tell people, last

```
bun run publish:notice:production -- --version 3.2.0 --as <you@example.com> --dry
bun run publish:notice:production -- --version 3.2.0 --as <you@example.com>
```

**After step 7, never before.** The notice says the change has happened;
announcing before moving anybody says something that is not yet true.

Publishing is final. There is no dismiss, only "Got it", and an ack cannot be
taken back, which is what `--dry` is really for. Publishing twice does nothing:
the note carries `key = release:<version>` behind a partial unique index.

The notes are written in `release-notes.json` in the same commit as the change
they describe, so they go through review with the code. **The bar is not "this
changed"**: the overlay blocks the whole app, so an entry nobody needed to read
teaches people to dismiss the next one unread. The test is whether somebody has
to do something differently tomorrow.

### 9. The schedule

**Only when `JOBS` in `scripts/schedule-jobs.ts` changed in this release.** The
schedules live in QStash, not in the deployment, so a tag does not move them and
nothing tells you they are stale.

```
bun run schedule:production -- --dry     # read it
bun run schedule:production
```

**When the FAILURE CALLBACK changed, that is not enough.** QStash does not report
either callback field back, on the list endpoint or on a single schedule, so the
script cannot see that a live schedule is missing one and will happily report
"all scheduled". Recreating them is the only way:

```
bun run schedule:production -- --rewrite
```

Run it once against each environment whose schedules predate 3.4.7, and again
after any change to `/api/cron/failed` or the headers that point at it. The Ops
page proves it landed: SCHEDULER shows a row per job, and `check:cron` asserts
the header is still declared in the source.

It prints every declared job, what QStash currently holds for it, and anything
pointing at this origin that no job declares. Unchanged cadences say "all
scheduled" and it does nothing. It replaces rather than adds, so running it
twice is safe and running it never is the failure.

There is no Vercel cron any more: `vercel.json` has no `crons` key, and
`check:cron` fails if one reappears. Scoring is hourly because a single daily
firing in UTC cannot serve members in more than one timezone, which cost a
Berlin member a day of lag on every day they used the app.

`bun run schedule` is the same thing against dev, which now gets a real scoring
tick for the first time. Preview used to be scored only by hand.

### 10. Scoring

Check the next morning, in the admin console: Overview for the last run, Ops for
a live drift report. **Read Ops twice, hours apart.** A drift report taken just
after a job has run is the one reading that cannot show a scheduling gap, and
that is exactly how the Berlin bug hid: clean at 07:30 UTC, two rows by 10:00,
every single day.

`bun run score` is a scoring pass by hand, against dev. It writes fines, which
are append-only ledger rows, so it is a deliberate act rather than housekeeping.

---

## If it goes wrong

**Instant Rollback in the Vercel dashboard** puts the previous build back. It is
the fastest thing available and it is the reason the promote step exists.

What rollback does NOT undo:

- **Migrations.** The schema stays where you put it. This is why hostile ones go
  last: rolling the code back onto a schema that still has the column is fine,
  rolling back onto one missing it is not.
- **A published notice.** Retire it in the database; there is no unsend.
- **Ledger entries.** Append-only by invariant 3. Corrections are compensating
  rows.
- **Anything a data migration moved.** It wrote config rows, and config is
  insert-only. Write another row.

---

## The four things that have actually cost time

Each of these was a real incident, and none of them looked like a failure.

**An environment file says nothing about what a deployment reads.** `.env.*` is
read by the commands in this repo and by nothing else. Vercel holds its own copy
per environment. The two disagreed silently for days and `dev.curfew.amanarya.com`
read and wrote the database production was about to become. The values are
encrypted and never returned, so the dates from `vercel env ls` are all you get
and all you need: a variable older than the branch it names has never been
updated. `--force` is not enough to change one, either. It overwrites the value
and keeps the created date, which is the only evidence anybody gets. Remove and
re-add, then check the date moved.

**R2's CORS allowlist is a fourth environment and nothing in this repo can see
it.** The browser PUTs the photo straight to R2, so every origin the app is
served from has to be named in the bucket's policy in the Cloudflare dashboard.
A missing origin fails the preflight and the browser reports a bare network
error, indistinguishable from bad credentials or a dead bucket. Each environment
has its own bucket and they are deliberately not interchangeable. Per-commit
`*.vercel.app` URLs are on neither list, so uploads never work from those.
`bun run check:cors` says.

**A deployment that never happens looks exactly like nothing happening.** Both
deployments come from GitHub Actions rather than Vercel's GitHub App, because
when that installation is suspended or waiting on a permissions approval the
push events simply stop arriving: every setting still reads correctly, the repo
is still linked, and there is no error anywhere, because Vercel never learned
there was anything to build. It cost an hour once and happened again on the
v3.0.0 release commit, which got no Preview at all. `vercel.json` sets
`deploymentEnabled: false` for both branches. `bunx vercel ls` tells you what
Vercel actually built, and github.com/settings/installations is where an
approval would sit.

**There are no transactions.** The Neon HTTP driver refuses them, so every write
in this codebase is ordered so that a crash under-writes visibly rather than
double-writing silently, and `verify` is what finds the under-write. A release
that half-applies is a state somebody has to read and repair, not something that
rolls itself back.

---

## Checklist

```
[ ] working tree clean, on the commit to ship
[ ] CI green on that SHA
[ ] check:cors:production
[ ] bun audit
[ ] pending migrations read and sorted: additive vs hostile
[ ] additive migrations applied to production
[ ] version suffix removed, committed
[ ] tag pushed, deploy run green
[ ] promoted, and vercel ls agrees
[ ] check:signin against the live domain
[ ] signed in and looked at it
[ ] hostile migrations applied
[ ] data migrations: --dry read, then run
[ ] release notice: --dry read, then published
[ ] schedule:production, if JOBS changed: --dry read, then run
[ ] schedule:production -- --rewrite, if the failure callback changed
[ ] next morning: admin Overview last run, Ops drift report, read twice hours apart
```
