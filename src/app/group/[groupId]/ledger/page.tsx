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

  const owed = [...net.entries()]
    .map(([k, amount]) => {
      const [other, currency] = k.split("|");
      return { other, currency, amount };
    })
    .filter((b) => b.amount !== 0);

  const hasFines = rows.some((r) => r.kind === "fine");

  return (
    <>
      {owed.length === 0 ? (
        <div className="mb-6 border-2 border-fg p-[18px]">
          <div className="text-[13px] text-muted">Balance</div>
          <div className="mt-1 text-[18px]">Settled.</div>
          {hasFines ? (
            <div className="mt-1 text-[12px] text-muted">Fines were recorded. See the feed.</div>
          ) : null}
        </div>
      ) : (
        owed.map((b) => {
          const other = nameById.get(b.other) ?? b.other;
          const exp = minorUnitExponent(b.currency);
          if (b.amount > 0) {
            const major = (b.amount / 10 ** exp).toFixed(exp);
            return (
              <div key={b.other + b.currency} className="mb-3 border-2 border-fg p-[18px]">
                <div className="text-[13px] text-muted">You owe {other}</div>
                <div className="mt-1 text-[32px] font-semibold tabular-nums text-penalty">
                  {formatMoney(b.amount, b.currency)}
                </div>
                <SettleForm
                  groupId={groupId}
                  toUserId={b.other}
                  toName={other}
                  currency={b.currency}
                  defaultMajor={major}
                />
              </div>
            );
          }
          return (
            <div key={b.other + b.currency} className="mb-3 border-2 border-fg p-[18px]">
              <div className="text-[13px] text-muted">{other} owes you</div>
              <div className="mt-1 text-[32px] font-semibold tabular-nums text-pass">
                {formatMoney(-b.amount, b.currency)}
              </div>
            </div>
          );
        })
      )}

      <Feed rows={rows} />
    </>
  );
}

function Feed({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-[13px] text-muted">Nothing yet.</p>;
  }
  return (
    <div className="mt-6 border-t border-rule">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-baseline justify-between gap-3 border-b border-rule py-[11px] text-[14px]"
        >
          <div>
            <div>
              {r.kind === "fine"
                ? `Fine: ${r.fromName} → ${r.toName}`
                : r.kind === "settlement"
                  ? `Settled: ${r.toName} → ${r.fromName}`
                  : `Adjustment: ${r.fromName} → ${r.toName}`}
            </div>
            <div className="text-[12px] text-muted">
              {r.periodStart ?? r.createdAt.toISOString().slice(0, 10)}
            </div>
          </div>
          <div className={"tabular-nums " + (r.kind === "settlement" ? "text-pass" : "text-penalty")}>
            {formatMoney(r.amount, r.currency)}
          </div>
        </div>
      ))}
    </div>
  );
}
