"use client";

import { useEffect, useState } from "react";
import { adoptDeviceTimezoneAction } from "@/app/settings/actions";
import { SubmitButton } from "@/app/ui";
import { deviceZone, sameClock } from "@/lib/zones";

// Where a dismissal is remembered. Per device and per pair of zones, because the
// mismatch is a fact about this device: keeping Kolkata on a laptop that is
// briefly in London says nothing about the phone, and landing somewhere new
// makes it a different question that deserves asking again.
const KEPT = "curfew.tz.kept";

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
  const [device, setDevice] = useState<string | null>(null);

  useEffect(() => {
    const found = deviceZone();
    // Same clock is the test, not the same name: browsers disagree about
    // Asia/Calcutta and Asia/Kolkata, and telling somebody they have moved
    // country because of a spelling would be worse than saying nothing.
    if (!found || sameClock(found, stored)) return;
    try {
      if (localStorage.getItem(KEPT) === `${stored}|${found}`) return;
    } catch {
      // Storage can be refused outright. Ask again rather than not at all.
    }
    setDevice(found);
  }, [stored]);

  if (!device) return null;

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
            setDevice(null);
          }}
          className="border border-rule px-3 py-[7px] text-[12.5px] text-muted"
        >
          Keep {stored}
        </button>
      </div>
    </div>
  );
}
