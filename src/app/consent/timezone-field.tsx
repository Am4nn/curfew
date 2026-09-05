"use client";

import { useEffect, useState } from "react";
import { TimezoneSelect } from "@/app/settings/timezone-select";
import { deviceZone } from "@/lib/zones";

/**
 * The zone, on the consent gate, before anything is scored.
 *
 * Every deadline in Curfew is read in the zone on file. A new account has none,
 * so it resolves to the app default and a member who has never opened Settings
 * is judged on a midnight that is not theirs. The gate is the one screen every
 * new member passes through, and it ends in a single explicit press, so the zone
 * is settled there rather than left to be discovered.
 *
 * Read from the device, shown as a fact, changeable in place. The server writes
 * it only when the account has no zone of its own, and validates it.
 */
export function TimezoneField({
  zones,
  fallback,
}: {
  zones: string[];
  fallback: string;
}) {
  const [zone, setZone] = useState(fallback);
  const [editing, setEditing] = useState(false);

  // After hydration, because the server has no way to know. Until it runs, the
  // field carries the app default, which is what would have been used anyway.
  useEffect(() => {
    const found = deviceZone();
    if (found) setZone(found);
  }, []);

  return (
    <section className="flex flex-col gap-[10px] border border-rule p-[13px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">YOUR DAY</span>

      {editing ? (
        <TimezoneSelect zones={zones} defaultValue={zone} onChange={setZone} />
      ) : (
        <div className="flex items-baseline justify-between gap-[10px]">
          <input type="hidden" name="timezone" value={zone} />
          <span className="text-[13px]">{zone}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-none text-[11px] text-accent"
          >
            change
          </button>
        </div>
      )}

      <span className="text-[11.5px] leading-[1.55] text-muted">
        Every window and deadline is read here. Change it any time in Settings.
      </span>
    </section>
  );
}
