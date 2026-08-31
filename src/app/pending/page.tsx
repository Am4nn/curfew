import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { SignOut } from "../sign-out";

export default async function Pending() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const status = await getApprovalStatus(user.id);
  if (status === "approved") redirect("/");

  const rejected = status === "rejected";

  return (
    <main className="min-h-screen px-5 pb-20 pt-7">
      <div className="mx-auto flex min-h-[calc(100vh-104px)] max-w-[560px] flex-col justify-center gap-[26px]">
        <div className="text-[30px] font-semibold tracking-[0.2em]">CURFEW</div>
        <p className="max-w-[40ch] text-[14px] text-muted">
          {rejected
            ? "This account was not approved. Nothing here is available to you."
            : "This account is waiting for admin approval. There is nothing to do until it is approved."}
        </p>
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
