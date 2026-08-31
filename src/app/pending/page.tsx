import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { SignOut } from "../sign-out";

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
        : "This account is waiting for admin approval. There is nothing to do until it is approved.";

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-7">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[26px]">
        <div className="text-[30px] font-semibold tracking-[0.2em]">CURFEW</div>
        <p className="max-w-[40ch] text-[14px] text-muted">{message}</p>
        <p className="border-t border-rule pt-[14px] text-[12px] text-muted">
          Signed in as {user.email}
        </p>
        <div>
          <SignOut />
        </div>
      </div>
    </main>
  );
}
