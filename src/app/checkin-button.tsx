"use client";

import { useState } from "react";
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ typeKey, step, idem: newIdem(), evidence: {} }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "That did not go through.");
      router.refresh();
    } catch {
      setError("Network failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button onClick={submit} disabled={pending} className={className}>
        {pending ? "Recording" : label}
      </button>
      {error ? <p className="mt-3 text-[13px] text-penalty">{error}</p> : null}
    </div>
  );
}
