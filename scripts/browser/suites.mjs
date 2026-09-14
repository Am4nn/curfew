// The suites, in the order they must run.
//
// Its own file so that something other than the runner can read the list.
// `check:shards` imports it to prove CI's matrix names every one of them, and
// it cannot import run.mjs to find out: that file opens a browser and runs the
// whole suite on import.
//
// ORDER IS LOAD-BEARING inside one process. `pause` scrubs the preview clock
// days into the future, and every read on a scrubbed page closes periods, so
// the three suites that answer for today have to go first. run.mjs walks this
// array and skips what was not asked for, so naming suites on the command line
// selects them and can never reorder them.
import { screens } from "./screens.mjs";
import { balances } from "./balances.mjs";
import { admin } from "./admin.mjs";
import { counter } from "./counter.mjs";
import { owners } from "./owners.mjs";
import { pause } from "./pause.mjs";
import { declare } from "./declare.mjs";
import { configure } from "./configure.mjs";

/** @type {[string, (ctx: Record<string, any>) => Promise<void>][]} */
export const SUITES = [
  ["screens", screens],
  ["balances", balances],
  ["admin", admin],
  // Before pause, which leaves the clock scrubbed several days out and every
  // counter finished. This one needs a day with nothing on it.
  ["counter", counter],
  // Before pause, for the same reason as counter: it answers today.
  ["declare", declare],
  ["configure", configure],
  // Before pause, which scrubs the clock and declares a trip.
  ["owners", owners],
  ["pause", pause],
];

export const SUITE_NAMES = SUITES.map(([name]) => name);
