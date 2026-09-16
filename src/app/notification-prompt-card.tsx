"use client";

import { useState } from "react";
import { useClientValue } from "./use-client-value";
import { enable, state } from "./push";

// The ask, as a card rather than a modal.
//
// It is dismissible on purpose, and that is not softness. A permission prompt
// raised twice and refused twice is refused FOREVER on that device: there is no
// way back except the browser's own settings, which nobody visits. So the worst
// outcome here is not somebody ignoring the card, it is somebody being asked at
// a bad moment and pressing No to make it go away. The card absorbs that press;
// the system prompt cannot.
//
// Which is also why the system prompt is only ever raised from the Enable
// button. iOS refuses a prompt that is not raised from a user gesture, and
// Chrome counts a dismissed prompt against the origin.

const KEY = "curfew.notify.asked";
/** Two refusals and Curfew stops asking. Settings is still there. */
const GIVE_UP_AFTER = 2;
const ASK_AGAIN_AFTER_DAYS = 4;

interface Asked {
  count: number;
  /** Epoch ms of the last dismissal. */
  at: number;
}

function read(): Asked {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { count: 0, at: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { count: 0, at: 0 };
    const { count, at } = parsed as Partial<Asked>;
    return { count: typeof count === "number" ? count : 0, at: typeof at === "number" ? at : 0 };
  } catch {
    // Storage refused, or somebody put something else under the key. Asking one
    // more time than we meant to is a smaller failure than never asking.
    return { count: 0, at: 0 };
  }
}

function write(next: Asked): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and blocked site data. The card comes back next launch,
    // which is the behaviour without storage and is survivable.
  }
}

/**
 * Should this device be asked, decided ONCE and remembered.
 *
 * Two reasons it is a memoised boolean and not a computation in the component.
 *
 * `useClientValue` is `useSyncExternalStore`, which calls the snapshot on every
 * render and compares with `Object.is`. Returning the parsed object would have
 * returned a NEW object each time and re-rendered forever. A boolean compares.
 *
 * And the answer depends on `Date.now()`, which is impure and would make the
 * snapshot unstable for the same reason. `react-hooks/purity` catches the call
 * in a component body, which is how this was found. Deciding once, on the first
 * client call, is the only version that is stable for as long as the page
 * lives, which is what the snapshot contract actually requires.
 *
 * The cache also survives client-side navigation, so moving between screens
 * does not re-ask a question already answered this session.
 */
let decided: boolean | null = null;

function shouldAsk(): boolean {
  if (decided !== null) return decided;

  // Only a device that has never been asked. "granted" is already handled and
  // PushRefresh re-registers it silently; "denied" cannot be undone from here;
  // "uninstalled" and "unsupported" would raise a prompt that leads nowhere.
  if (state() !== "default") {
    decided = false;
    return decided;
  }
  const asked = read();
  decided =
    asked.count < GIVE_UP_AFTER &&
    Date.now() - asked.at >= ASK_AGAIN_AFTER_DAYS * 86_400_000;
  return decided;
}

export function NotificationPromptCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  // A settled fact by the time the page is interactive, and one that must not
  // change while it lives. Read in an effect instead, this would render the
  // card and then hide it again on every single launch.
  const ask = useClientValue(shouldAsk, false);

  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!ask || gone) return null;

  function dismiss() {
    write({ count: read().count + 1, at: Date.now() });
    setGone(true);
  }

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    try {
      // Straight from the press, with nothing awaited first.
      const next = await enable(vapidPublicKey);
      if (next === "granted") {
        // Never ask again on this device, whatever happens later.
        write({ count: GIVE_UP_AFTER, at: Date.now() });
        setGone(true);
        // The settings row counts devices server-side, and Home may now have a
        // badge to clear. Cheaper than threading a refresh through three
        // components for something that happens once per device, ever.
        location.reload();
        return;
      }
      // They said no to the SYSTEM prompt, which is final on this device. There
      // is nothing left to ask, so stop.
      write({ count: GIVE_UP_AFTER, at: Date.now() });
      setGone(true);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-40 px-5"
      style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-[420px] flex-col gap-3 border border-fg bg-bg p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13.5px] font-semibold">
            Want a nudge before a window closes?
          </span>
          <span className="text-[12px] leading-[1.6] text-muted">
            Curfew can remind you while there is still time, and tell you who
            else in your group has already logged today. Four a day at most.
          </span>
        </div>

        {failed ? (
          <span className="text-[11.5px] text-penalty">
            That did not work. Settings, Notifications has the switch.
          </span>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void turnOn()}
            className="border border-fg bg-fg px-3 py-[8px] text-[13px] text-bg active:opacity-70 disabled:opacity-40"
          >
            {busy ? "Turning on" : "Turn on"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-2 py-[8px] text-[12px] text-muted active:opacity-70"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
