"use client";

import { useState } from "react";
import { useClientValue } from "@/app/use-client-value";
import { Toggle, useServerAction } from "@/app/ui";
import { clearBadge, disable, enable, state, type PushState } from "@/app/push";
import { setRemindersAction, sendTestAction } from "./actions";

interface Activity {
  typeKey: string;
  name: string;
  chosen: string[];
  suggested: string[];
}

export function NotificationsForm({
  vapidPublicKey,
  devices,
  activities,
}: {
  vapidPublicKey: string;
  devices: number;
  activities: Activity[];
}) {
  // The permission as it stands on load: a browser fact the server cannot know,
  // settled before the page is interactive, which is exactly what
  // useClientValue is for. Reading it in an effect and calling setState renders
  // the wrong switch first and then corrects it, and the React Compiler cannot
  // memoise past that cascade.
  const initial = useClientValue(state, "unsupported");
  // And the permission as the PRESS changes it. Two variables rather than a
  // re-read, because useClientValue's snapshot must return the same value for
  // the life of the page or React loops on it, and this one changes the moment
  // somebody answers the prompt.
  const [changed, setChanged] = useState<PushState | null>(null);
  const current = changed ?? initial;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const on = current === "granted" && devices > 0;

  async function flip() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      if (on) {
        await disable();
        setChanged("default");
        clearBadge();
        setNote("Off. This device will not be reminded.");
      } else {
        // Straight from the click, with no await before it: iOS refuses a
        // permission prompt that is not raised from a user gesture, and an
        // await that yields first is enough to lose the gesture.
        const next = await enable(vapidPublicKey);
        setChanged(next);
        if (next === "granted") setNote("On. Try Send a test.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
      // The row above counts devices from the server, so the screen has to go
      // back for it. Nothing else on this page depends on the round trip.
      location.reload();
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-7">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-3 border-b border-rule py-[13px]">
          <span className="flex-1 text-[13.5px]">
            Reminders on this device
            <span className="mt-[3px] block text-[11px] text-muted">
              {explain(current, devices)}
            </span>
          </span>
          <Toggle
            on={on}
            pending={busy}
            disabled={busy || current === "unsupported" || current === "uninstalled"}
            onClick={() => void flip()}
            label="Reminders on this device"
          />
        </div>
        {on ? <TestButton /> : null}
        {error ? <p className="text-[11.5px] text-penalty">{error}</p> : null}
        {note ? <p className="text-[11.5px] text-pass">{note}</p> : null}
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.16em] text-muted">WHEN</span>
        <p className="text-[11.5px] leading-[1.6] text-muted">
          Leave an activity blank and Curfew picks the times: before the window
          closes, or the hours the activity itself suggests.
        </p>
        <div className="flex flex-col">
          {activities.map((activity) => (
            <ActivityTimes key={activity.typeKey} activity={activity} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TestButton() {
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        disabled={sending}
        aria-busy={sending || undefined}
        onClick={() => {
          setSending(true);
          setResult(null);
          void sendTestAction()
            .then((r) => setResult(r.error ?? r.note ?? "Sent."))
            .finally(() => setSending(false));
        }}
        className="border border-fg px-3 py-[7px] text-[12px] active:opacity-70 disabled:opacity-40"
      >
        {sending ? "Sending" : "Send a test"}
      </button>
      {result ? <span className="text-[11.5px] text-muted">{result}</span> : null}
    </div>
  );
}

/**
 * One activity's times.
 *
 * Saved on blur rather than behind a Save button. There is one field, its value
 * is a list of times, and a button per activity would be twelve buttons on a
 * screen whose whole job is a switch.
 */
function ActivityTimes({ activity }: { activity: Activity }) {
  const { run, pending, error } = useServerAction();
  const [value, setValue] = useState(activity.chosen.join(", "));

  const placeholder =
    activity.suggested.length > 0
      ? activity.suggested.join(", ")
      : "before the window closes";

  return (
    <div className="flex items-center gap-3 border-b border-rule py-[11px]">
      <span className="w-[92px] flex-none text-[13px]">{activity.name}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const times = value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (times.join(",") === activity.chosen.join(",")) return;
          run(() => setRemindersAction(activity.typeKey, times));
        }}
        placeholder={placeholder}
        inputMode="numeric"
        aria-label={`${activity.name} reminder times`}
        aria-busy={pending || undefined}
        className="w-full border border-rule bg-transparent px-2 py-[6px] text-[12px] placeholder:text-muted"
      />
      {error ? <span className="text-[11px] text-penalty">{error}</span> : null}
    </div>
  );
}

/** What the line under the switch says, which is the only place the platform
 *  differences ever surface to a person. */
function explain(current: PushState, devices: number): string {
  switch (current) {
    case "unsupported":
      return "This browser cannot receive notifications.";
    case "uninstalled":
      return "Add Curfew to your home screen first. iOS only allows notifications for an installed app.";
    case "denied":
      return "Blocked in your browser settings. Curfew cannot ask again from here.";
    case "granted":
      return devices > 0
        ? "This device will be reminded."
        : "Allowed, but this device is not registered. Turn it on.";
    default:
      return "Off.";
  }
}
