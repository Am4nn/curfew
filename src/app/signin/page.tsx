"use client";

import { signIn } from "@/lib/auth-client";

export default function SignIn() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-7">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[26px]">
        <div className="text-[30px] font-semibold tracking-[0.2em]">CURFEW</div>
        <p className="max-w-[34ch] text-[14px] text-muted">
          Three timed check-ins a night. Miss the window and the night does not
          count.
        </p>
        <button
          onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}
          className="flex w-full items-center justify-center gap-[11px] border border-rule bg-white px-5 py-[19px] text-[15px] text-[#1a1917]"
        >
          Continue with Google
        </button>
        <p className="border-t border-rule pt-[14px] text-[12px] text-muted">
          Invite only. New accounts wait for admin approval.
        </p>
      </div>
    </main>
  );
}
