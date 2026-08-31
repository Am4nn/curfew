import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserInspector } from "@/server/admin";
import { formatMoney } from "@/domain";
import { ActionForm, SubmitButton, ConfirmButton } from "../../../ui";
import { decideAction, setAdminAction } from "../../actions";

export default async function UserInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getUserInspector(id);
  if (!data) notFound();
  const { profile, recentCheckins, recentScores, recentOutcomes, balances } = data;

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{profile.name}</h2>
          <div className="text-[12px] text-muted">{profile.email}</div>
        </div>
        <Link href="/admin/users" className="text-[12px] text-muted underline">all users</Link>
      </div>

      <section className="mb-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px]">
            status:{" "}
            <span className={profile.status === "approved" ? "text-pass" : profile.status === "rejected" ? "text-penalty" : "text-muted"}>
              {profile.status}
            </span>
          </span>
          <span className="text-[13px]">admin: {profile.isAdmin ? "yes" : "no"}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {profile.status === "pending" ? (
            <>
              <ActionForm action={decideAction}>
                <input type="hidden" name="userId" value={profile.userId} />
                <input type="hidden" name="approve" value="true" />
                <SubmitButton pendingLabel="Approving" className="border border-fg bg-fg px-3 py-[6px] text-[13px] text-bg">
                  Approve
                </SubmitButton>
              </ActionForm>
              <ConfirmButton action={decideAction} fields={{ userId: profile.userId, approve: "false" }} label="Reject" message={`Reject ${profile.name}?`} confirmLabel="Reject" />
            </>
          ) : null}
          {profile.isAdmin ? (
            <ConfirmButton action={setAdminAction} fields={{ userId: profile.userId, makeAdmin: "false" }} label="Remove admin" message={`Remove admin access from ${profile.name}?`} confirmLabel="Remove admin" />
          ) : (
            <ActionForm action={setAdminAction}>
              <input type="hidden" name="userId" value={profile.userId} />
              <input type="hidden" name="makeAdmin" value="true" />
              <SubmitButton pendingLabel="Saving" className="border border-fg px-3 py-[6px] text-[13px]">
                Make admin
              </SubmitButton>
            </ActionForm>
          )}
        </div>
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
              <span>{o.periodStart} · {o.groupName}</span>
              <span className="tabular-nums text-muted">
                streak {o.streakAfter}{o.graceUsed ? " · grace" : ""}{o.fineAmount > 0 ? ` · ${formatMoney(o.fineAmount, o.currency)}` : ""}
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
