import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { SignOut } from "./sign-out";

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const status = await getApprovalStatus(user.id);
  if (status !== "approved") redirect("/pending");

  return (
    <main className="min-h-screen px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">CURFEW</h1>
          <span className="text-[13px] text-muted">{user.email}</span>
        </header>

        <p className="text-[14px] text-muted">
          No groups yet. Nothing tracked, nothing owed.
        </p>

        <div className="mt-8">
          <SignOut />
        </div>
      </div>
    </main>
  );
}
