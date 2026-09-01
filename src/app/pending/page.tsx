import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { SignOut } from "../sign-out";
import { QuorumMark } from "../mark";

export default async function Pending() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const status = await getApprovalStatus(user.id);
  if (status === "approved") redirect("/");

  const message =
    status === "disabled"
      ? "This account has been removed. Any balance you have still stands."
      : status === "rejected"
        ? "This account was not approved. Nothing here is available to you."
        : "Your account is waiting for an admin to approve it. You will get an email when the decision is made.";

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-7">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[22px]">
        <div className="flex items-center gap-3 text-[30px] font-semibold tracking-[0.2em]">
          <QuorumMark size={26} />
          CURFEW
        </div>
        <div className="border-l-[3px] border-accent bg-surface px-4 py-[14px] text-[14px] leading-relaxed">
          {message}
        </div>
        <p className="text-[12px] text-muted">Signed in as {user.email}</p>
        <SignOut className="h-[44px] self-start border border-rule bg-transparent px-[18px] text-[14px] text-muted" />
      </div>
    </main>
  );
}
