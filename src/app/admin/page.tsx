import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getOverview, listPendingApprovals, can } from "@/server/admin";
import { formatMoney } from "@/domain";
import { ActionForm, SubmitButton, ConfirmButton } from "../ui";
import { decideAction } from "./actions";

export default async function AdminOverview() {
  const user = await getSessionUser();
  const canApprove = user ? await can(user.id, "users.approve") : false;
  const [o, pending] = await Promise.all([getOverview(), listPendingApprovals()]);

  return (
    <>
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Users" value={`${o.usersApproved}/${o.usersTotal}`} sub={`${o.usersPending} pending · ${o.admins} admin`} />
        <Stat label="Groups" value={o.groups} sub={`${o.activeMemberships} memberships`} />
        <Stat label="Check-ins 7d" value={o.checkins7d} sub={`${o.events} events total`} />
        <Stat label="Total fined" value={formatMoney(o.totalFined, "INR")} />
        <Stat label="Outstanding" value={formatMoney(o.outstanding, "INR")} />
        <Stat
          label="Last scored"
          value={o.lastScoredAt ? o.lastScoredAt.toISOString().slice(0, 16).replace("T", " ") : "never"}
          sub="UTC"
        />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold tracking-[0.1em]">PENDING APPROVALS</h2>
          <Link href="/admin/users" className="text-[12px] text-muted underline">all users</Link>
        </div>
        {pending.length === 0 ? (
          <p className="text-[14px] text-muted">No accounts waiting.</p>
        ) : (
          pending.map((p) => (
            <div key={p.userId} className="flex items-center justify-between gap-3 border-b border-rule py-3 text-[14px]">
              <div>
                <div>{p.name}</div>
                <div className="text-[12px] text-muted">{p.email}</div>
              </div>
              {canApprove ? (
                <span className="flex items-center gap-2">
                  <ActionForm action={decideAction}>
                    <input type="hidden" name="userId" value={p.userId} />
                    <input type="hidden" name="approve" value="true" />
                    <SubmitButton pendingLabel="Approving" className="border border-fg bg-fg px-3 py-[6px] text-[13px] text-bg">
                      Approve
                    </SubmitButton>
                  </ActionForm>
                  <ConfirmButton
                    action={decideAction}
                    fields={{ userId: p.userId, approve: "false" }}
                    label="Reject"
                    message={`Reject ${p.name}?`}
                    confirmLabel="Reject"
                  />
                </span>
              ) : (
                <span className="text-[12px] text-muted">read-only</span>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="border border-rule p-3">
      <div className="text-[11px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}
