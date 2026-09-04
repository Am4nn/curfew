"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The one-tap check-in on Home. An explicit press, POSTed, never a GET and
// never on load. The default styling is the full-height night button; callers
// (the Home hero) can pass a className for the compact variant.
//
// Each press carries its own idempotency key, so a retry after a flaky network
// records nothing while a second deliberate press records a second check-in.
const DEFAULT_CLASS =
  "block w-full bg-fg px-5 py-[34px] text-[19px] font-medium uppercase tracking-[0.04em] text-bg disabled:opacity-60";

function newIdem(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function CheckinButton({
  label,
  typeKey,
  step,
  className = DEFAULT_CLASS,
}: {
  label: string;
  typeKey: string;
  step: string;
  className?: string;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  // router.refresh() is a transition, so this stays true until the new server
  // render actually arrives. Without it the button un-busied the instant the
  // POST resolved while the row behind it still read "not done", which looked
  // like a press that had done nothing.
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pending = sending || refreshing;

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ typeKey, step, idem: newIdem(), evidence: {} }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "That did not go through.");
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network failed. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        aria-busy={pending || undefined}
        className={className + " active:opacity-70"}
      >
        {pending ? "Recording" : label}
      </button>
      {error ? <p className="mt-3 text-[13px] text-penalty">{error}</p> : null}
    </div>
  );
}
