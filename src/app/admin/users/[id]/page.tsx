import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getUserInspector, can } from "@/server/admin";
import { formatMoney } from "@/domain";
import { ROLES } from "@/lib/capabilities";
import { ActionForm, SubmitButton, ConfirmButton } from "../../../ui";
import { decideAction, setRoleAction, disableUserAction, restoreUserAction } from "../../actions";

export default async function UserInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getSessionUser();
  const [data, canApprove, canSetRole, canDisable] = await Promise.all([
    getUserInspector(id),
    me ? can(me.id, "users.approve") : Promise.resolve(false),
    me ? can(me.id, "users.set_role") : Promise.resolve(false),
    me ? can(me.id, "users.disable") : Promise.resolve(false),
  ]);
  if (!data) notFound();
  const { profile, recentCheckins, recentScores, recentOutcomes, balances } = data;

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{profile.name}</h2>
          <div className="text-[12px] text-muted">{profile.email}</div>
        </div>
        <Link href="/admin/users" className="text-[12px] text-muted">‹ all users</Link>
      </div>

      <section className="mb-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px]">
            status:{" "}
            <span className={profile.status === "approved" ? "text-pass" : profile.status === "rejected" ? "text-penalty" : "text-muted"}>
              {profile.status}
            </span>
          </span>
          <span className="text-[13px]">role: {profile.role}</span>
          {profile.disabled ? <span className="text-[13px] text-penalty">removed</span> : null}
        </div>

        {canApprove && profile.status === "pending" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ActionForm action={decideAction}>
              <input type="hidden" name="userId" value={profile.userId} />
              <input type="hidden" name="approve" value="true" />
              <SubmitButton pendingLabel="Approving" className="border border-fg bg-fg px-3 py-[6px] text-[13px] text-bg">
                Approve
              </SubmitButton>
            </ActionForm>
            <ConfirmButton action={decideAction} fields={{ userId: profile.userId, approve: "false" }} label="Reject" message={`Reject ${profile.name}?`} confirmLabel="Reject" />
          </div>
        ) : null}

        {canSetRole ? (
          <ActionForm action={setRoleAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="userId" value={profile.userId} />
            <label className="text-[13px] text-muted">Role</label>
            <span className="relative inline-block">
              <select
                name="role"
                defaultValue={profile.role}
                className="appearance-none border border-fg bg-bg py-[7px] pl-2 pr-8 text-[14px] text-fg"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">
                ▾
              </span>
            </span>
            <SubmitButton pendingLabel="Saving" className="border border-fg bg-fg px-3 py-[6px] text-[13px] text-bg">
              Save role
            </SubmitButton>
          </ActionForm>
        ) : null}

        {canDisable && me?.id === profile.userId ? (
          <p className="mt-4 text-[12px] text-muted">This is you.</p>
        ) : null}

        {canDisable && me?.id !== profile.userId ? (
          <div className="mt-4">
            {profile.disabled ? (
              <ActionForm action={restoreUserAction}>
                <input type="hidden" name="userId" value={profile.userId} />
                <SubmitButton pendingLabel="Restoring" className="border border-fg px-3 py-[6px] text-[13px]">
                  Restore user
                </SubmitButton>
              </ActionForm>
            ) : (
              <ConfirmButton
                action={disableUserAction}
                fields={{ userId: profile.userId }}
                label="Remove user"
                message={`Remove ${profile.name}? They lose access and stop being scored. Their balances and debts stay and still need settling. You can restore them later.`}
                confirmLabel="Remove"
              />
            )}
          </div>
        ) : null}
      </section>

      <Panel title="BALANCES">
        {balances.length === 0 ? (
          <Empty>No balances.</Empty>
        ) : (
          balances.map((b) => (
            <Row key={b.groupId + b.currency}>
              <span className="text-muted">{b.groupId.slice(0, 8)}</span>
              <span className={b.netOwed > 0 ? "text-penalty" : b.netOwed < 0 ? "text-pass" : "text-muted"}>
                {b.netOwed > 0 ? `owes ${formatMoney(b.netOwed, b.currency)}` : b.netOwed < 0 ? `owed ${formatMoney(-b.netOwed, b.currency)}` : "settled"}
              </span>
            </Row>
          ))
        )}
      </Panel>

      <Panel title="RECENT OUTCOMES">
        {recentOutcomes.length === 0 ? (
          <Empty>None yet.</Empty>
        ) : (
          recentOutcomes.map((o, i) => (
            <Row key={i}>
              <span>
                {o.periodStart} · {o.groupName} · {o.typeKey}
              </span>
              <span className="tabular-nums text-muted">
                {o.passed ? "passed" : "missed"}
                {o.graceUsed ? " · grace" : ""}
                {o.fineAmount > 0 ? ` · ${formatMoney(o.fineAmount, o.currency)}` : ""}
              </span>
            </Row>
          ))
        )}
      </Panel>

      <Panel title="RECENT SCORES">
        {recentScores.length === 0 ? (
          <Empty>None yet.</Empty>
        ) : (
          recentScores.map((s, i) => (
            <Row key={i}>
              <span>{s.periodStart}</span>
              <span className={s.passed ? "text-pass" : "text-penalty"}>
                {s.passed ? "passed" : "failed"} · {JSON.stringify(s.detail)}
              </span>
            </Row>
          ))
        )}
      </Panel>

      <Panel title="RECENT CHECK-INS">
        {recentCheckins.length === 0 ? (
          <Empty>None yet.</Empty>
        ) : (
          recentCheckins.map((c, i) => (
            <Row key={i}>
              <span>{c.step}</span>
              <span className="tabular-nums text-muted">{new Date(c.at).toISOString().slice(0, 16).replace("T", " ")}</span>
            </Row>
          ))
        )}
      </Panel>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="mb-2 text-[12px] font-semibold tracking-[0.1em] text-muted">{title}</h3>
      {children}
    </section>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2 text-[13px]">{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-muted">{children}</p>;
}
