"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOut({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
          router.push("/signin");
        } catch {
          setBusy(false);
        }
      }}
      className={
        (className ??
          "border border-fg bg-transparent px-[15px] py-[15px] text-[14px] text-fg") +
        " active:opacity-70 disabled:opacity-40"
      }
    >
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
