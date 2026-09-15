// A short buzz when something is recorded (item 25).
//
// Android Chrome has `navigator.vibrate` and honours it. iOS has nothing:
// WebKit exposes no vibration API at all, and the known trick, a hidden
// `<input type="checkbox" switch>` whose toggle fires the system haptic engine,
// is an exploit Apple is reported to have closed in iOS 26.5. Injecting a
// hidden checkbox into the DOM on every press to reach a side effect Apple did
// not intend is the kind of thing that breaks silently, in a way no check here
// would ever catch, so it is not shipped and half the devices get nothing.
//
// Feature-detected rather than sniffed: what matters is whether this browser
// has the API, not what it claims to be.
//
// It is a confirmation and not an event. Nothing depends on it, nothing waits
// for it, and a browser that refuses (a page without a user gesture, a device
// with vibration off) costs nothing.

/** One short buzz: a press that landed. */
export function tapped(): void {
  buzz(12);
}

/** Two, for a day that has just been completed. */
export function finished(): void {
  buzz([14, 60, 22]);
}

function buzz(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // A browser that has the method and refuses the call. Nothing depends on
    // it, so there is nothing to report and nothing to retry.
  }
}
