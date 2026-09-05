"use client";

import { useState } from "react";
import { adoptDeviceTimezoneAction } from "@/app/settings/actions";
import { SubmitButton } from "@/app/ui";
import { deviceZone, sameClock } from "@/lib/zones";
import { useClientValue } from "@/app/use-client-value";

// Where a dismissal is remembered. Per device and per pair of zones, because the
// mismatch is a fact about this device: keeping Kolkata on a laptop that is
// briefly in London says nothing about the phone, and landing somewhere new
// makes it a different question that deserves asking again.
const KEPT = "curfew.tz.kept";

function keptPair(): string | null {
  try {
    return localStorage.getItem(KEPT);
  } catch {
    // Storage can be refused outright. Ask rather than not ask.
    return null;
  }
}

/**
 * The device says one thing and Curfew is judging another.
 *
 * Every window, every deadline and every day boundary is read in the zone on
 * file. When the device disagrees, the member is being scored on a midnight that
 * is not theirs, and nothing on any screen would say so.
 *
 * Shown wherever the two differ rather than once at signup, because the case
 * this exists for is somebody moving, and a prompt at signup can never catch
 * that. It clears itself the moment they agree, either way.
 */
export function TimezoneMismatch({ stored }: { stored: string }) {
  // Both of these are the browser's to answer and neither changes while the
  // page lives, so they are read straight rather than through an effect.
  const device = useClientValue(deviceZone, null);
  const dismissed = useClientValue(keptPair, null);
  const [kept, setKept] = useState(false);

  // Same clock is the test, not the same name: browsers disagree about
  // Asia/Calcutta and Asia/Kolkata, and telling somebody they have moved
  // country because of a spelling would be worse than saying nothing.
  if (kept || !device || sameClock(device, stored)) return null;
  if (dismissed === `${stored}|${device}`) return null;

  return (
    <div className="flex flex-col gap-[9px] border border-accent p-[13px]">
      <span className="text-[12.5px] text-accent">This device is in {device}.</span>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        Curfew reads your windows and deadlines in {stored}.
      </span>
      <div className="flex items-center gap-2">
        <form action={adoptDeviceTimezoneAction}>
          <input type="hidden" name="timezone" value={device} />
          <SubmitButton
            pendingLabel="Saving"
            className="border border-fg bg-fg px-3 py-[7px] text-[12.5px] text-bg"
          >
            Switch from tomorrow
          </SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEPT, `${stored}|${device}`);
            } catch {
              // Nothing to do. It asks again next time, which is the safe way
              // for this to fail.
            }
            setKept(true);
          }}
          className="border border-rule px-3 py-[7px] text-[12.5px] text-muted"
        >
          Keep {stored}
        </button>
      </div>
    </div>
  );
}
