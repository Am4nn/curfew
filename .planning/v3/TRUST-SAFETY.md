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
The resolution, to be confirmed at implementation:

- Evidence objects and personal fields are deleted outright.
- Event rows are retained but stripped of identifying payload and detached from
  the user, so history stays rebuildable in aggregate without naming anyone.
- Exactly what is never deleted is stated in the policy and in the consent form.

## The consent form (after v3)

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

## Content rules (after v3)

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

## Security round (after v3)

Two passes, written into the release checklist:

1. **Security review.** Auth, session handling, signed URL scope and expiry,
   `assertMember` coverage on every query, object storage bucket policy, EXIF
   stripping, rate limits on capture and check-in, and injection surfaces.
2. **Break our own app.** Deliberately attempt: check-in replay, back-dating a
   check-in, fetching another group's evidence URL, escalating to owner,
   scrubbing reputation by un-sharing, uploading a non-image, uploading something
   enormous, and deleting an account with money outstanding. Fix what falls over.

RLS is still deferred (`../BACKLOG.md`), so query-layer membership enforcement is
the only wall. The security round must confirm it holds everywhere.

## Open source

The repo takes outside PRs. Ship alongside v3:

- a CONTRIBUTING guide,
- an "adding an activity type" walkthrough,
- a statement of what a contributor may and may not change, in particular that
  the invariants in `CLAUDE.md` are not up for negotiation in a PR.
