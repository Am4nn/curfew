# EVIDENCE.md — Photo evidence

Evidence is the feature that separates v3 from a checkbox app. It is also the
one with real cost, real privacy weight and real limits. See `SCOPE.md`.

## Rules

- Evidence is configured **per activity and per window**: off, optional, or
  required (decision 6). Timely Sleep can require a photo on the wake window and
  none on the night window.
- Source is set per activity: **live capture only**, or **gallery allowed**
  (decision 6). Steps defaults to gallery because the number lives in a watch or
  another app. Everything else defaults to live.
- When evidence is required, the camera is part of the check-in. There is no path
  to a pass without a photo (decision 7).
- Evidence is **ephemeral**: auto-deleted 30 days after capture (decision 8).
- v3 ships images only. The model must leave room for other kinds later.

## Honest limits

Say this plainly in the UI and in the consent form. Live capture is friction and
a norm, not proof.

- On the web, `getUserMedia` is fragile inside an iOS PWA, and
  `input capture` still lets some platforms hand over a library photo.
- Anyone can point a live camera at a screen.
- Curfew therefore never claims a photo is verified. It records that a photo was
  taken in the app at a server timestamp, and shows it to the people the user
  chose to show it to.
- Enforcement of honesty is social, which is what objections are for in a later
  release.

## One check-in page

An activity that needs nothing at all is a single tap on Home. Everything else
opens the **same page**, whatever the evidence rule (decision 34):

- a photo slot at the top, marked optional or required,
- the activity's own fields under it (minutes, calories, steps),
- Discard and Send at the bottom.

Tapping the slot opens the camera. After the shutter a **confirm** screen offers
Retake or Use this photo, then returns to the page with the photo attached. An
attached photo carries a **red cross** to remove it.

**Optional** means Send works with or without a photo. **Required** means Send
stays disabled, with the reason stated, until a photo is attached (decision 35).

Nothing is recorded until Send. Send performs the check-in and the upload as one
action.

## The camera

Full-bleed live preview, one shutter button, one close control. Nothing else.
No filters, no flash menus unless a device needs one, no text beyond the
activity name and the window's closing time.

Notes:

- Discard cancels the check-in. Nothing is recorded (invariant 9: a check-in is
  an explicit press, and the press is Send).
- If the upload fails, the check-in must not silently pass. Retry in the
  foreground and tell the user if it did not land.
- Permission denied: state it plainly and offer the gallery only if the activity
  allows it. Otherwise the check-in cannot complete.
- The camera never opens on page load, only on an explicit press.

## Storage

- Photos go to **object storage** (Cloudflare R2 or S3), never through Postgres
  and never stored on the app server (decision 25).
- The database stores a row per evidence item: id, user, activity, period,
  window, server timestamp, storage key, byte size, mime type, and a delete-after
  date.
- Reads are signed URLs with a short expiry, issued only to the owner and to
  members of groups the user shares that activity's evidence with.
- Compression happens client side before upload: longest edge capped, JPEG
  quality tuned, target a few hundred KB. Exact numbers set during the storage
  maths.
- **Strip EXIF before upload.** Location data in a gym photo is a real leak.

## Retention

30 days is a placeholder chosen so evidence outlives the reputation window and
any future objection window. Finalise after estimating:

- photos per active user per day across their activities,
- average compressed size,
- expected active users,
- storage plus egress cost per month at 7, 30 and 90 days.

Deletion is a scheduled job, and it must delete the object and the row together.
A failed object delete must not leave the row saying the photo is gone.

Retention, and what it means, is shown to the user in the consent form and in
Settings (see `TRUST-SAFETY.md`).

## Future, not v3

- Evidence kinds beyond images.
- AI-derived nutrition from a food photo plus a description, opt-in, with the
  derived numbers tracked as their own optional targets.
- Objections against a specific evidence item.
