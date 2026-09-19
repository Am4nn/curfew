"use client";

// How many screens deep into Curfew this document is.
//
// `window.history.length` cannot answer it and was what `BackLink` used to ask.
// That number counts every entry in the TAB, including whatever the person was
// reading before they opened the app, and it never goes down. So it read "you
// can go back" from the very first navigation onwards, and `router.back()` on
// the first screen took them out of Curfew entirely, to a search results page
// that had nothing to do with anything.
//
// The only thing that distinguishes an in-app push from everything else is that
// the App Router made it, so this watches `pushState` and `replaceState` and
// stamps a depth onto the entry. A push is a step down and carries depth + 1; a
// replace stays where it is, which is what makes a TAB change free. `popstate`
// reads the depth back off the entry being returned to, so going back and
// forward stays in step, and a reload keeps its depth because the stamp is on
// the entry rather than in memory.
//
// The state object is spread rather than replaced: the App Router keeps its own
// tree in there and reads it on every navigation.

const KEY = "__curfewDepth";

let depth = 0;
let installed = false;
const listeners = new Set<() => void>();

const announce = () => {
  for (const fn of listeners) fn();
};

const depthOf = (state: unknown): number => {
  const n = (state as Record<string, unknown> | null)?.[KEY];
  return typeof n === "number" && n >= 0 ? n : 0;
};

/**
 * Start watching. Safe to call repeatedly: the first call wins.
 *
 * Called from a component mounted once in the root layout, rather than at
 * module scope, so nothing is patched during a server render or in a test that
 * only imports the type.
 */
export function watchNavDepth(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // An entry that already carries a depth: a reload, or a return to a document
  // restored from the back-forward cache.
  depth = depthOf(window.history.state);

  // Bound rather than destructured: these are methods on History and calling
  // one with the wrong receiver throws an Illegal invocation.
  const pushState = window.history.pushState.bind(window.history);
  const replaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = (
    state: unknown,
    ...rest: [string, (string | URL | null)?]
  ) => {
    depth += 1;
    pushState({ ...(state as object), [KEY]: depth }, ...rest);
    announce();
  };

  window.history.replaceState = (
    state: unknown,
    ...rest: [string, (string | URL | null)?]
  ) => {
    // Lateral, not deeper. A tab bar replaces, so four tabs are one entry and
    // Back leaves the group rather than walking the tabs backwards.
    replaceState({ ...(state as object), [KEY]: depth }, ...rest);
  };

  window.addEventListener("popstate", (event) => {
    depth = depthOf(event.state);
    announce();
  });
}

export function subscribeNavDepth(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Is there a Curfew screen behind this one? */
export const canGoBack = (): boolean => depth > 0;
