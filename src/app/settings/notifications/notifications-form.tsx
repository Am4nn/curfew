"use client";

import { useState } from "react";
import { useClientValue } from "@/app/use-client-value";
import { Toggle, useServerAction } from "@/app/ui";
import { clearBadge, disable, enable, state, type PushState } from "@/app/push";
import { setQuietHoursAction, setRemindersAction, sendTestAction } from "./actions";

interface Activity {
  typeKey: string;
  name: string;
  chosen: string[];
  suggested: string[];
}

interface Quiet {
  from: string;
  to: string;
  custom: boolean;
}

export function NotificationsForm({
  vapidPublicKey,
  devices,
  activities,
  quiet,
}: {
  vapidPublicKey: string;
  devices: number;
  activities: Activity[];
  quiet: Quiet;
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
          <span className="flex-1 text-sm">
            Reminders on this device
            <span className="mt-[3px] block text-2xs text-muted">
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
        {error ? <p className="text-2xs text-penalty">{error}</p> : null}
        {note ? <p className="text-2xs text-pass">{note}</p> : null}
      </section>

      <QuietHours quiet={quiet} />

      <section className="flex flex-col gap-2">
        <span className="text-micro tracking-label text-muted">WHEN</span>
        <p className="text-2xs leading-relaxed text-muted">
          Leave an activity blank and Curfew picks the times: before the window
          closes, or the hours the activity itself suggests. A time you set here
          is honoured even inside the default quiet hours, because you set it.
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

/**
 * The hours nothing arrives in.
 *
 * A Save button rather than the save-on-blur the times below use, and the
 * difference is deliberate: getting an activity's cue wrong costs a reminder at
 * an odd hour, getting this wrong costs somebody their sleep. A save this one
 * has to confirm is a save they know happened.
 *
 * `<input type="time">` renders 12 or 24 hour according to the device, so this
 * is one of the three places in the app where a time may not read as "9:30 PM".
 * That is the platform's control and the same trade the configure screens
 * already made.
 */
function QuietHours({ quiet }: { quiet: Quiet }) {
  const [from, setFrom] = useState(quiet.from);
  const [to, setTo] = useState(quiet.to);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = from !== quiet.from || to !== quiet.to;

  return (
    <section className="flex flex-col gap-2">
      <span className="text-micro tracking-label text-muted">QUIET HOURS</span>
      <p className="text-2xs leading-relaxed text-muted">
        Nothing arrives between these times, including a window about to close.
        Curfew would rather miss a reminder than wake you with one.
      </p>
      <div className="flex items-center gap-3 border-b border-rule py-[11px]">
        <span className="w-[92px] flex-none text-sm">From</span>
        <input
          type="time"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Quiet hours start"
          className="border border-rule bg-transparent px-2 py-1.5 text-xs"
        />
        <span className="text-sm">until</span>
        <input
          type="time"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Quiet hours end"
          className="border border-rule bg-transparent px-2 py-1.5 text-xs"
        />
      </div>
      {dirty ? (
        <div>
          <button
            type="button"
            disabled={saving}
            aria-busy={saving || undefined}
            onClick={() => {
              setSaving(true);
              setResult(null);
              const data = new FormData();
              data.set("quietFrom", from);
              data.set("quietTo", to);
              void setQuietHoursAction({}, data)
                .then((r) =>
                  setResult({ ok: !r.error, text: r.error ?? r.note ?? "Saved." }),
                )
                .finally(() => setSaving(false));
            }}
            className="border border-fg px-3 py-[7px] text-xs active:opacity-70 disabled:opacity-40"
          >
            {saving ? "Saving" : "Save quiet hours"}
          </button>
        </div>
      ) : null}
      {result ? (
        <p className={`text-2xs ${result.ok ? "text-pass" : "text-penalty"}`}>
          {result.text}
        </p>
      ) : null}
    </section>
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
        className="border border-fg px-3 py-[7px] text-xs active:opacity-70 disabled:opacity-40"
      >
        {sending ? "Sending" : "Send a test"}
      </button>
      {result ? <span className="text-2xs text-muted">{result}</span> : null}
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
      <span className="w-[92px] flex-none text-sm">{activity.name}</span>
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
        className="w-full border border-rule bg-transparent px-2 py-1.5 text-xs placeholder:text-muted"
      />
      {error ? <span className="text-2xs text-penalty">{error}</span> : null}
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
