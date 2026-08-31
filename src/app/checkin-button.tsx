"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The only thing that records a check-in. An explicit press, POSTed, never a
// GET and never on load.
export function CheckinButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reason?: string };
      if (body.reason === "duplicate") setError("Already checked in.");
      else if (body.reason === "closed") setError("The window just closed.");
      else setError("That did not go through.");
      router.refresh();
    } catch {
      setError("Network failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={submit}
        disabled={pending}
        className="block w-full bg-fg px-5 py-[34px] text-[19px] font-medium uppercase tracking-[0.04em] text-bg disabled:opacity-60"
      >
        {pending ? "Recording" : label}
      </button>
      {error ? <p className="mt-3 text-[13px] text-penalty">{error}</p> : null}
    </div>
  );
}
