import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { isAdmin, listPendingApprovals } from "@/server/admin";
import { decideAction } from "./actions";
import { ActionForm, SubmitButton, ConfirmButton } from "../ui";

export default async function Admin() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  if (!(await isAdmin(user.id))) redirect("/");

  const pending = await listPendingApprovals();

  return (
    <main className="min-h-dvh px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">APPROVALS</h1>
          <Link href="/" className="text-[12px] text-muted underline">
            dashboard
          </Link>
        </header>

        {pending.length === 0 ? (
          <p className="text-[14px] text-muted">No accounts waiting.</p>
        ) : (
          pending.map((p) => (
            <div
              key={p.userId}
              className="flex items-center justify-between border-b border-rule py-3 text-[14px]"
            >
              <div>
                <div>{p.name}</div>
                <div className="text-[12px] text-muted">{p.email}</div>
              </div>
              <span className="flex items-center gap-2">
                <ActionForm action={decideAction}>
                  <input type="hidden" name="userId" value={p.userId} />
                  <input type="hidden" name="approve" value="true" />
                  <SubmitButton
                    pendingLabel="Approving"
                    className="border border-fg bg-fg px-3 py-[6px] text-[13px] text-bg"
                  >
                    Approve
                  </SubmitButton>
                </ActionForm>
                <ConfirmButton
                  action={decideAction}
                  fields={{ userId: p.userId, approve: "false" }}
                  label="Reject"
                  message={`Reject ${p.name}? They will not be able to use the app.`}
                  confirmLabel="Reject"
                />
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
