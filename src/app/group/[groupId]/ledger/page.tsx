import { redirect, notFound } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { listGroupMembers, getGroupLedgerRows, type LedgerRow } from "@/server/ledger";
import { formatMoney, minorUnitExponent } from "@/domain";
import { SettleForm } from "../../../ledger/settle-form";

export default async function GroupLedgerTab({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  try {
    await assertMember(groupId, user.id);
  } catch {
    notFound();
  }

  const [members, rows] = await Promise.all([
    listGroupMembers(groupId),
    getGroupLedgerRows(groupId),
  ]);
  const nameById = new Map(members.map((m) => [m.userId, m.name]));

  // Pairwise net between the viewer and each other member, per currency.
  // Positive means the viewer owes that member.
  const net = new Map<string, number>();
  for (const r of rows) {
    if (r.fromUserId === user.id) {
      const k = `${r.toUserId}|${r.currency}`;
      net.set(k, (net.get(k) ?? 0) + r.amount);
    } else if (r.toUserId === user.id) {
      const k = `${r.fromUserId}|${r.currency}`;
      net.set(k, (net.get(k) ?? 0) - r.amount);
    }
  }
  const positions = [...net.entries()]
    .map(([k, amount]) => {
      const [other, currency] = k.split("|");
      return { other, name: nameById.get(other) ?? other, currency, amount };
    })
    .filter((p) => p.amount !== 0);

  return (
    <>
      <section className="mb-8">
        <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">WHO OWES WHOM</div>
        {positions.length === 0 ? (
          <p className="text-[13px] text-muted">Settled.</p>
        ) : (
          positions.map((p) => {
            const exp = minorUnitExponent(p.currency);
            const major = (p.amount / 10 ** exp).toFixed(exp);
            const youOwe = p.amount > 0;
            return (
              <div key={p.other + p.currency} className="mb-3 border border-rule p-3">
                <div className="text-[14px]">
                  {youOwe ? (
                    <>
                      You owe <span className="text-penalty">{p.name}</span>{" "}
                      {formatMoney(p.amount, p.currency)}
                    </>
                  ) : (
                    <>
                      <span className="text-pass">{p.name}</span> owes you{" "}
                      {formatMoney(-p.amount, p.currency)}
                    </>
                  )}
                </div>
                {youOwe ? (
                  <SettleForm
                    groupId={groupId}
                    toUserId={p.other}
                    toName={p.name}
                    currency={p.currency}
                    defaultMajor={major}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section>
        <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">HISTORY</div>
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <Entry key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Entry({ row: r }: { row: LedgerRow }) {
  const title = r.kind === "fine" ? "Fine" : r.kind === "settlement" ? "Settlement" : "Adjustment";
  const sub =
    r.kind === "settlement" ? `${r.toName} → ${r.fromName}` : `${r.fromName} → ${r.toName}`;
  const date = r.periodStart ?? r.createdAt.toISOString().slice(0, 10);
  return (
    <div className="flex items-baseline justify-between gap-3 border border-rule px-3 py-[11px]">
      <div className="flex flex-col gap-[2px]">
        <span className="text-[13px]">
          {title} · {sub}
        </span>
        <span className="text-[12px] text-muted">{date}</span>
      </div>
      <span className={"text-[14px] tabular-nums " + (r.kind === "settlement" ? "text-pass" : "text-penalty")}>
        {formatMoney(r.amount, r.currency)}
      </span>
    </div>
  );
}
