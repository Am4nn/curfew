"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/signin");
      }}
      className="border border-fg bg-transparent px-[15px] py-[15px] text-[14px] text-fg"
    >
      Sign out
    </button>
  );
}
