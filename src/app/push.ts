// Turning notifications on, from the browser's side (item 28).
//
// Unlike haptics, this one is not decoration and a failure has to be reported:
// somebody pressing a switch labelled Notifications is owed an answer about
// whether they will get any.
//
// What each platform needs, because the differences decide the shape below:
//
// iOS grants Web Push only to a web app INSTALLED to the home screen, from
// 16.4, and not at all in the EU. A tab in Safari cannot subscribe however many
// times it is asked, so `state()` reports `uninstalled` rather than pretending
// the press failed. Curfew is already installed by the people who use it, which
// is the only reason this feature is reachable without a native app.
//
// Android Chrome subscribes from a tab or an installed app, either way.
//
// Two rules that are not obvious and both cost a debugging session if missed:
//
//  - The permission prompt MUST be raised from a user gesture. Called from an
//    effect, or after an await that yields to the event loop on iOS, it is
//    refused with no prompt and no error. Everything here runs inside a click
//    handler for that reason.
//  - `Notification.permission` is a settled fact at load and a changed one
//    after the prompt. The settled half goes through `useClientValue`; the
//    changed half is the return value of `enable()`, held in useState by
//    whoever called it. It must never be re-read in an effect.

/** What the switch should be showing. */
export type PushState =
  | "unsupported" // no service worker or no Push API at all
  | "uninstalled" // iOS Safari in a tab: possible, but only once installed
  | "denied" // the person said no, and only they can undo it
  | "granted" // allowed, though a subscription may still be missing
  | "default"; // never asked

/**
 * What this browser can do right now, read without asking for anything.
 *
 * Safe on the server, where it answers `unsupported`, so it can be the fallback
 * passed to `useClientValue`.
 */
export function state(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window) || typeof Notification === "undefined") {
    // iOS below 16.4, or a tab on iOS where the API is hidden until install.
    return standalone() ? "unsupported" : "uninstalled";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  // An iOS tab can have the API and still refuse to subscribe. Saying so up
  // front is better than a prompt that leads nowhere.
  return standalone() || !isApple() ? "default" : "uninstalled";
}

/**
 * Ask, subscribe, and tell the server. Call it from a click and nowhere else.
 *
 * Returns the state to show afterwards, so the caller sets it from the press
 * rather than reading the permission back in an effect.
 */
export async function enable(publicKey: string): Promise<PushState> {
  const before = state();
  if (before === "unsupported" || before === "uninstalled" || before === "denied") {
    return before;
  }

  // Must be first, and must not be preceded by an await, or iOS drops it.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "default";

  const registration = await navigator.serviceWorker.register("/sw.js");
  // `register` resolves before the worker can receive anything. Subscribing
  // against a registration that is not ready yet succeeds and then drops the
  // first push, which reads exactly like the server never sent one.
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    // Required by Chrome, and the reason Curfew has no silent pushes: every
    // push must produce a visible notification or the origin loses permission.
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey),
  });

  await post({ action: "subscribe", subscription: subscription.toJSON() });
  return "granted";
}

/** Turn them off: drop the browser's subscription, then forget the device. */
export async function disable(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  // Server first. If unsubscribing locally succeeded and the POST then failed,
  // the row would outlive the device and we would push into nothing forever.
  await post({ action: "unsubscribe", endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/**
 * Re-register the current device if it already has permission.
 *
 * iOS expires a push subscription without telling anybody, and the first sign
 * is notifications quietly stopping. So this runs on load for somebody who has
 * already said yes, and the endpoint is the primary key, so re-sending an
 * unchanged one costs an upsert that changes nothing.
 */
export async function refresh(publicKey: string): Promise<void> {
  if (state() !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      }));
    await post({ action: "subscribe", subscription: subscription.toJSON() });
  } catch {
    // Nothing to tell anybody. They have already granted permission and the
    // switch already reads on; a failed refresh means the next reminder may not
    // arrive, and the next launch tries again.
  }
}

/** Clear the number on the icon. The day is done, or they just opened the app. */
export function clearBadge(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.clearAppBadge !== "function") return;
  try {
    void navigator.clearAppBadge();
  } catch {
    // Unsupported, or refused outside an installed app. It is a decoration.
  }
}

// ---------------------------------------------------------------------------

async function post(body: unknown): Promise<void> {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Could not save this device.");
}

/** Is this the installed app rather than a tab? */
function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS's own flag, which predates the standard media query and is still the
    // only reliable answer in an installed web app on older versions.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  // The one place a UA test is the right tool: what is being asked is not "does
  // this browser have an API" but "is this the platform that hides the API
  // until install", which no feature test can answer.
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * The VAPID key, base64url, as the bytes `subscribe` wants.
 *
 * `applicationServerKey` takes a Uint8Array and the key travels as base64url,
 * which `atob` does not read: it wants the padded, non-URL alphabet.
 */
// The explicit `ArrayBuffer` is not decoration. `subscribe` wants a
// BufferSource backed by a real ArrayBuffer, and a bare `new Uint8Array(n)` is
// typed as possibly backed by a SharedArrayBuffer, which it will not accept.
function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
