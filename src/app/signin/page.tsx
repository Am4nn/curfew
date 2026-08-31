"use client";

import { signIn } from "@/lib/auth-client";

export default function SignIn() {
  return (
    <main className="min-h-screen px-5 pb-20 pt-7">
      <div className="mx-auto flex min-h-[calc(100vh-104px)] max-w-[560px] flex-col justify-center gap-[26px]">
        <div className="text-[30px] font-semibold tracking-[0.2em]">CURFEW</div>
        <p className="max-w-[34ch] text-[14px] text-dim">
          Three timed check-ins a night. Miss the window and the night does not
          count.
        </p>
        <button
          onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}
          className="flex w-full items-center justify-center gap-[11px] border border-ink bg-white px-5 py-[19px] text-[15px] text-ink"
        >
          Continue with Google
        </button>
        <p className="border-t border-rule pt-[14px] text-[12px] text-dim">
          Invite only. New accounts wait for admin approval.
        </p>
      </div>
    </main>
  );
}
