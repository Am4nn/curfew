# Turning Curfew into an Android and iOS app

Research for ROADMAP theme 4. Written 2026-09-16.

**Nothing here is decided.** This answers one question that was asked out loud:
the site already works on a phone, so is there a cheap way to get it into the
two stores. The answer is yes for Android and no for iOS, and the reason is in
Curfew's own architecture rather than in the tooling.

---

## The finding, in one paragraph

Packaging is a weekend. An app Apple will accept, that can read HealthKit, is
not. Every cheap wrapper assumes the web app is a folder of static files. Curfew
is not: 36 pages, 123 components under `src/app`, 55 of them `"use client"`, 17
`"use server"` action files, and only 5 API routes, four of which are auth, cron
and evidence plumbing. Every screen reads the database in a server component and
every button posts a server action. There is no static version of Curfew and
there cannot be one without removing most of the front end.

## What the two stores accept in 2026

**Google Play still supports a PWA directly.** A Trusted Web Activity, packaged
with Bubblewrap or PWABuilder, verified against `curfew.amanarya.com` with a
Digital Asset Links file, is a real Play listing built from the site as it
stands. Close to zero code.

**Apple has gone the other way.** Guideline 4.2 rejects a wrapped website
near-automatically unless the app does something the website cannot: push,
offline, biometrics, camera or health integration. That list is theme 4's
feature list, which is the one piece of luck here. The features that make the
app worth having are the same features that buy it past review. They have to be
real native calls, not their web equivalents.

**Play has a calendar cost that is not code.** A personal developer account now
needs 12 real testers using the app for 14 days before it can go to production.
That clock should start long before anything is ready.

## The shortcut, and why Ionic says not to take it

Capacitor's `server.url` makes the WebView load `https://curfew.amanarya.com`
directly. Two things Curfew-specific work by accident and are worth knowing:

- **Better Auth keeps working.** The WebView's origin is genuinely that https
  origin, so session cookies behave exactly as they do in Safari.
- **R2 uploads keep working.** The browser origin is the production origin,
  which is already on the bucket's CORS allowlist. The camera and the presigned
  PUT need no change at all.

Ionic's own position is that `server.url` is a live-reload feature and not a
deployment strategy: no offline, nothing at all when the server is down, plugin
injection breaks when a service worker sits in front of the page, and it is a
known cause of store rejection.

It is the right way to try the idea in an evening. It is not the way to ship.

## The seam that already exists

`src/server/` is 10,160 lines, and the React layer calls into it rather than
touching the database itself. An HTTP API over those functions is the missing
piece, and it is the most mechanical part of the whole job: the functions exist,
they already call `assertMember`, and what is left is transport. That is the
part current AI tooling genuinely accelerates, and the part a person still has
to review line by line, because every one of those endpoints is a new place
invariant 10 can be forgotten.

**That API is needed on every path below**, so it is worth building whichever
one wins. It also forces the auth question to be answered once: session cookie
or bearer token.

## The four paths

**1. PWA, plus a TWA on Play.** Manifest, service worker, icons (`make:icons`
already generates them). Ships to Play. On iOS it stays a home-screen web app:
push works on 16.4 and later, but only after Add to Home Screen, and not in the
EU. No HealthKit, ever. No App Store listing. Days.

**2. Capacitor at the live URL.** A native shell, real push, real haptics, real
camera, health plugins available. Ships to Play easily. On iOS it is a bet on
whether the native features read as native. Weeks, and it carries `server.url`'s
problems permanently.

**3. Capacitor done properly.** Requires Curfew to become a client-rendered app
against an API. Server components and server actions go. This is the rewrite
theme 3 is already contemplating, so if that redesign happens, this is the
moment to do both at once. Months.

**4. Expo with DOM components.** A native shell with native navigation, and the
`"use dom"` directive drops existing React web components into a WebView one at
a time, so the migration is per screen rather than all at once. It only takes
client components, so the 55 `"use client"` files are what moves and the server
components are not. Months, but incremental, and the only path that ends in a
genuinely native app without a single big-bang rewrite.

## What this suggests, as it looks today

1. **Build the API over `src/server/` first.** Useful on every path, mechanical
   enough that tooling helps, and it settles the auth question once.
2. **Ship path 1 to Play.** It costs almost nothing and it answers the only
   question that matters, which is whether anybody installs it. Start the
   12-testers clock at the same time.
3. **Leave iOS until theme 3 has decided whether the front end is being
   rewritten.** If it is, path 4. If it is not, path 2 with enough native
   features to survive review.

## Four things that will bite, specific to this codebase

- **Health data and invariant 9.** A check-in is an explicit press, never
  recorded on page load, because an app that records ambient activity rewards
  not opening it. A step count read from HealthKit is ambient by definition.
  This is a product decision, not an integration detail, and the ROADMAP already
  flags it.
- **R2 CORS becomes a fifth environment.** The moment the app serves its own
  assets instead of loading the live URL, the browser origin becomes
  `capacitor://localhost` or `https://localhost`, which is on neither bucket's
  allowlist. `check:cors` will not catch it, because nothing in this repo knows
  that origin exists. The failure is a bare network error in the browser,
  indistinguishable from bad credentials, which has already cost an evening once.
- **Better Auth in a WKWebView.** Fine while the WebView loads the https origin.
  As soon as assets are local, iOS cookie handling across schemes is the
  well-documented failure and `WKAppBoundDomains` in `Info.plist` is the
  workaround. Plan for bearer tokens instead of discovering this late.
- **Google Fit shuts down at the end of 2026.** Health Connect is the Android
  health store now, so any plugin has to be a Health Connect plugin rather than
  a Fit one. Capawesome's is paid and sits behind their Insiders registry;
  `mley/capacitor-health` is the free community one covering both HealthKit and
  Health Connect.

## What AI tooling does and does not remove

It writes the endpoints, the Capacitor config and the plugin glue faster than a
person can. It does not decide whether a HealthKit step count may pass a day, or
what a push notification is allowed to say, or whether the clerk speaks first.
Those are theme 3 and theme 4's real content, and they are the same size they
were before.

## Sources

- Capacitor 8: https://ionic.io/blog/announcing-capacitor-8
- Capacitor 8.5: https://ionic.io/blog/capacitor-8-5-released
- `server.url` in production: https://github.com/ionic-team/capacitor/discussions/4080
- Updating a Capacitor app remotely: https://capawesome.io/blog/the-right-way-to-update-your-capacitor-app-remotely/
- Next.js with Capacitor: https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/
- Guideline 4.2 and webview wrappers: https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Why wrapping a web app no longer works: https://publishd.app/blog/why-wrapping-a-web-app-doesnt-work
- PWA limits on iOS in 2026: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- Adding a PWA to Google Play: https://developers.google.com/codelabs/pwa-in-play
- Publishing a PWA to both stores in 2026: https://www.mobiloud.com/blog/publishing-pwa-app-store/
- Why TWA builds get rejected: https://12-testers-for-14-days.github.io/guides/twa-app-rejected-switch-to-webview/
- Expo DOM components: https://docs.expo.dev/guides/dom-components/
- Converting a website with Expo DOM components: https://expo.dev/blog/the-magic-of-expo-dom-components
- Capawesome Health plugin: https://capawesome.io/docs/sdks/capacitor/health/
- mley/capacitor-health: https://github.com/mley/capacitor-health
- Capacitor cookies on iOS: https://capacitorjs.com/docs/apis/cookies
