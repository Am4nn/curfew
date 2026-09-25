import { getSessionUser } from "@/lib/session";
import { getOverview, getLastRun, listPendingApprovals, can } from "@/server/admin";
import { humanBytes } from "@/server/ops";
import { ActionForm, SubmitButton, ConfirmButton } from "../ui";
import { decideAction } from "./actions";

export default async function AdminOverview() {
  const user = await getSessionUser();
  const canApprove = user ? await can(user.id, "users.approve") : false;
  const [o, lastRun, pending] = await Promise.all([
    getOverview(),
    getLastRun(),
    listPendingApprovals(),
  ]);

  return (
    <>
      <section className="mb-8 grid grid-cols-3 gap-2.5">
        <Stat value={o.usersTotal} label="Users" />
        <Stat value={o.groupsTotal} label="Groups" />
        <Stat value={o.pendingInvites} label="Pending invites" tone="penalty" />
        <Stat value={o.activitiesTracked} label="Activities tracked" />
        <Stat value={humanBytes(o.evidenceBytes)} label="Evidence stored" />
        <Stat
          value={o.checkinsScoredPct === null ? "—" : `${o.checkinsScoredPct}%`}
          label="Check-ins scored"
        />
      </section>

      <section className="mb-8 flex flex-col gap-2.5">
        <h2 className="text-micro tracking-label text-muted">LAST NIGHT&rsquo;S RUN</h2>
        <div className="flex flex-col">
          <RunRow
            label="Scheduler"
            detail={schedulerDetail(lastRun.scheduler)}
            status={lastRun.scheduler.ok ? "ok" : "review"}
          />
          <RunRow
            label="Scoring"
            detail={`${lastRun.scoring.periodsClosed.toLocaleString()} periods closed`}
            status="ok"
          />
          <RunRow
            label="Reputation"
            detail={`${lastRun.reputation.usersRecomputed.toLocaleString()} users recomputed`}
            status="ok"
          />
          <RunRow
            label="Retention sweep"
            detail={`${lastRun.retentionSweep.photosDeleted.toLocaleString()} photos deleted`}
            status="ok"
          />
          <RunRow
            label="Drift check"
            detail={
              lastRun.driftCheck.periodsDiffer === 0
                ? "0 rows differ from stored"
                : `${lastRun.driftCheck.periodsDiffer} row(s) differ from stored`
            }
            status={lastRun.driftCheck.ok ? "ok" : "review"}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-micro tracking-label text-muted">
          PENDING APPROVALS &middot; {pending.length}
        </h2>
        {pending.length === 0 ? (
          <p className="text-base text-muted">No accounts waiting.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pending.map((p) => (
              <div key={p.userId} className="flex flex-col gap-[11px] border border-rule p-[13px]">
                <div className="flex flex-col gap-[3px]">
                  <span className="text-sm">{p.email}</span>
                  <span className="text-micro text-muted">
                    {p.invite
                      ? `invited by ${p.invite.invitedByName} · ${p.invite.groupName} · ${formatShortDate(p.requestedAt)}`
                      : formatShortDate(p.requestedAt)}
                  </span>
                </div>
                {canApprove ? (
                  <span className="flex gap-[9px]">
                    <ActionForm action={decideAction}>
                      <input type="hidden" name="userId" value={p.userId} />
                      <input type="hidden" name="approve" value="true" />
                      <SubmitButton pendingLabel="Approving" className="border border-fg bg-fg px-3.5 py-1.5 text-xs font-semibold text-bg">
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
                  <span className="text-xs text-muted">read-only</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Stat({
  value,
  label,
  tone,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "penalty";
}) {
  return (
    <div className="flex flex-col gap-[5px] border border-rule p-3">
      <span className={"text-lg font-semibold leading-none " + (tone === "penalty" ? "text-penalty" : "text-fg")}>
        {value}
      </span>
      <span className="text-micro uppercase leading-snug tracking-wider text-muted">{label}</span>
    </div>
  );
}

function RunRow({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: "ok" | "review";
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-rule py-[11px]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-sm">{label}</span>
        <span className="text-micro text-muted">{detail}</span>
      </div>
      <span className="flex-none text-2xs text-muted">{status}</span>
    </div>
  );
}

/** The scheduler row's sentence, which has to say WHICH of the two went wrong. */
function schedulerDetail(s: { late: number; failures: number; ok: boolean }): string {
  if (s.ok) return "all jobs running, none failed";
  const parts: string[] = [];
  if (s.late > 0) parts.push(`${s.late} job(s) overdue`);
  if (s.failures > 0) parts.push(`${s.failures} failed in 7 days`);
  return parts.join(", ");
}
