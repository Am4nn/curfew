"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { putAwayCondition } from "./actions";

// Putting away a condition somebody wrote (1.19).
//
// NOT a delete, and the copy says so: a check-in against it is an event and
// events do not go away (invariant 1). What this does is stop it being offered
// and free nothing: the label cannot be written again, because two runs of
// "No doomscroll" a year apart would be impossible to tell apart in a ledger.
export function RetireCondition({ typeKey, label }: { typeKey: string; label: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`Put away ${label}`}
        className="flex-none px-2 py-[13px] text-2xs tracking-caps text-muted"
      >
        PUT AWAY
      </button>
    );
  }

  return (
    <span className="flex flex-none items-center gap-2 py-[13px]">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await putAwayCondition(typeKey);
            setAsking(false);
            router.refresh();
          })
        }
        className="border border-rule px-2 py-1 text-2xs text-penalty disabled:opacity-40"
      >
        {pending ? "Saving" : "Sure"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(false)}
        className="px-1 text-2xs text-muted disabled:opacity-40"
      >
        No
      </button>
    </span>
  );
}
