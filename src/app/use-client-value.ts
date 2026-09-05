"use client";

import { useSyncExternalStore } from "react";

// Nothing here subscribes: these values are settled by the time the page is
// interactive and do not change again while it lives.
const never = () => () => {
  // no teardown, because nothing was ever subscribed to
};

/**
 * A value only the browser can answer, read without an effect.
 *
 * The server has no `window`, no history, no cookies of the document kind and
 * no timezone of its own. Reading one in an effect and calling setState renders
 * the wrong thing first and then corrects it, which is a cascade the React
 * Compiler cannot memoise past and `react-hooks/set-state-in-effect` is there
 * to catch.
 *
 * `useSyncExternalStore` is the API for exactly this shape: `server` is what
 * renders on the server and through hydration, then `client` takes over in one
 * pass with no intermediate state.
 *
 * `client` must return the same value on every call for as long as the page
 * lives. React calls it on each render and compares, so a snapshot that keeps
 * changing (anything built from `new Date()`, say) is an infinite loop.
 */
export function useClientValue<T>(client: () => T, server: T): T {
  return useSyncExternalStore(never, client, () => server);
}
