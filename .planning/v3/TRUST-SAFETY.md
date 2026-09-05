# TRUST-SAFETY.md — Consent, policies, moderation, deletion

Most of this ships **after** v3, but it is written now so nothing is invented
under pressure later. The exception is the data controls in Settings, which are
part of v3 (decision: users can delete specific data, all their data, or their
account).

## Data controls (in v3)

Settings gains:

- **Delete a specific item.** One evidence photo, one check-in, one activity's
  history.
- **Delete all my data.** Everything derived and personal, subject to the ledger
  rule below.
- **Delete my account.**

The ledger rule (decision 17, invariant 3): `ledger_entries` is append-only and
outstanding money is retained. A deletion removes evidence, personal fields and
habit history, and leaves ledger rows in place, anonymised where possible. If a
user has outstanding money owed, say so plainly at the point of deletion rather
than silently keeping rows.

This creates a real tension with invariant 1, where `events` is the only source
of truth and everything rebuilds from it. Deleting events breaks rebuildability.
**Settled in Phase 8** (decisions 111 and 112):

- Evidence objects, personal fields and every derived row are deleted outright.
- Event rows are retained but stripped of identifying payload and detached from
  the user, so history stays rebuildable in aggregate without naming anyone.
- The user row itself is **scrubbed rather than removed**, because ledger rows
  point at it and a debt with no counterparty is not a debt. The name and email
  go, sessions and linked accounts go, and signing in becomes impossible.
- Exactly what is never deleted is stated in the policy and in the consent form.

## The consent form

The user accepts this at signup. It must be readable, not a wall. It states, in
plain words:

- what Curfew records: check-ins, timestamps, photos, streaks, reputation;
- **how long evidence lives** and that it is auto-deleted;
- **how reputation is calculated**, including the breadth ceiling and decay;
- **that a hidden global score exists** and what it does, namely set the starting
  score in a new group and nothing else;
- what a group can see, and that the user chooses it per activity;
- **what happens when they leave a group**: money due is retained, everything
  else stops being visible;
- what is never deleted, and why;
- where photos are stored and who can fetch them.

Everything a user consented to must also be visible later in Settings, not only
at signup.

## Content rules

Photos of people, in a group, means rules and a way to enforce them.

- No NSFW content. Grounds for a ban.
- No content that identifies or targets another person without consent.
- Guidance, not a rule: do not put personal data in a photo. No documents, no
  screens with addresses or account numbers, no house numbers.
- Reporting: any member can report an evidence item or a user. Reports go to
  admins.
- Bans: account level, with the ledger consequences spelled out.
- Because groups are invite-only, the exposure is bounded. That changes the day
  open signup lands, and content rules must be revisited before it does.

**Built in Phase 9.** The rules, the liability position and the admin's right to
remove and ban live in `src/server/policy.ts`, shown at the consent gate and
readable afterwards under Settings. Reporting is a control on each shared photo;
reports reach `/admin/reports`, which is the only place an admin ever sees an
image, and the fact they looked is recorded on the report. Removing a photo and
banning an account are separate acts. A ban deletes the account's photographs
and leaves its ledger rows owed and visible: getting banned is not a way to
settle.

## Security round

Two passes, written into the release checklist:

1. **Security review.** Auth, session handling, signed URL scope and expiry,
   `assertMember` coverage on every query, object storage bucket policy, EXIF
   stripping, rate limits on capture and check-in, and injection surfaces.
2. **Break our own app.** `bun run break-in` runs every one of these against a
   real database and exits non-zero if anything gives.

   The review found two real gaps and both are fixed: `getGroupLedgerRows` and
   `listGroupMembers` took a group id and trusted their caller to have checked
   membership. Invariant 10 says every group-scoped query goes through
   `assertMember`, and a helper that trusts its caller is the one that
   eventually gets called from somewhere that forgot.

### What the round covers

Twenty rounds of server calls, and then a sweep of a running server. They are
different questions: the direct rounds say the guard EXISTS, and only a request
says the route reaches it. A page that forgot `assertMember` passes every direct
round, because the direct rounds call the helper that has it.

Direct: check-in replay and two presses at once; back-dating a check-in;
reading another group's evidence, standings, ledger and balances; escalating to
owner; back-dating a fine; scrubbing reputation by un-sharing; uploading a
non-image or something enormous; an object key that tries to leave its own
prefix; claiming another member's photo; skipping a required photo; a
settlement that is zero, negative, fractional, with yourself, or into a group
you are not in; an overpayment that must turn the debt around rather than
vanish; two settlers racing for one fine; accepting an invite addressed to
somebody else, accepting one twice, and using a declined one; the last owner
walking out; reading a group after leaving it; every capability against a plain
member; moderation and the ban; deleting an account with money outstanding; and
the check-in ceiling.

Over HTTP: every route and every admin route, either signed out or as an
identity with no right to what it is asking for, asserting that no response
carries the group's name or its member's; the cron endpoint with no token and
with the wrong one; a GET at the check-in route; the two API routes with no
session; and the local evidence store unsigned, forged, expired and traversed.

The sweep carries a **positive control**: it first asks for a group the identity
IS in and asserts the name comes back. Every other check is "this string was not
in the response", and a string that is never in any response makes all of them
pass for the wrong reason.

Two things it cannot reach. **Server actions** are addressed by an id Next mints
at build time, so forging one tests Next rather than Curfew; each action's guard
is called directly instead. **The rate-limit ceiling** needs Upstash, and
`rateLimit` fails open by design when it is unreachable, so an environment
without it skips that round rather than reporting a pass it did not earn.

### Where it runs

It creates its own three people, its own admin and its own groups, and removes
all of them at the end. It borrows no account and touches nobody else's rows, so
the same round runs against a throwaway local database and against preview, and
it runs on **every push** in CI rather than when somebody remembers.

That was not true of the first version. It looked up a real account by a
hardcoded email and then scored it, wrote ledger rows against it, and deleted
its `activity_scores` and `reputation_daily` on the way out: a destructive test
pointed at a live person, which is also why it could only ever run against the
preview database.

RLS is still deferred (`../BACKLOG.md`), so query-layer membership enforcement is
the only wall. The security round must confirm it holds everywhere.

## Open source

The repo takes outside PRs. Ship alongside v3:

- a CONTRIBUTING guide,
- an "adding an activity type" walkthrough,
- a statement of what a contributor may and may not change, in particular that
  the invariants in `CLAUDE.md` are not up for negotiation in a PR.
