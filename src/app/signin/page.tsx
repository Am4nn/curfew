"use client";

import { signIn } from "@/lib/auth-client";
import { QuorumMark } from "../mark";

export default function SignIn() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-7">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[26px]">
        <div className="flex items-center gap-3 text-[30px] font-semibold tracking-[0.2em]">
          <QuorumMark size={26} />
          CURFEW
        </div>
        <p className="max-w-[40ch] text-[14px] leading-relaxed text-muted">
          A group accountability contract for nightly sleep. Invite only.
        </p>
        <button
          onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}
          className="flex h-[50px] w-full items-center justify-center border border-fg bg-fg text-[15px] font-semibold text-bg"
        >
          Sign in with Google
        </button>
        <p className="text-[12px] text-muted">
          New accounts wait for an admin to approve before anything works.
        </p>
      </div>
    </main>
  );
}
