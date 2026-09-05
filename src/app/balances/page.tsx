import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getUserDebts, type Debt } from "@/server/ledger";
import { formatMoney, minorUnitExponent } from "@/domain";
import { SettleForm } from "../settle-form";

// Who you owe and who owes you, across every group, with a per-debt settle. The
// dashboard balance tiles land here. Debts are per person, per group, because a
// settlement posts to one group's ledger.
export default async function Balances() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const { owe, owed } = await getUserDebts(user.id);

  // Net totals for the summary line, per currency (usually one).
  const oweByCur = sumByCurrency(owe);
  const owedByCur = sumByCurrency(owed);
  const settledEverywhere = owe.length === 0 && owed.length === 0;

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto max-w-[560px]">
        <header className="-mx-5 mb-6 border-b border-rule px-5 pb-[10px]">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[13px] text-muted">‹</span>
            <h1 className="text-[15px] font-semibold tracking-[0.14em]">BALANCES</h1>
          </Link>
        </header>

        {settledEverywhere ? (
          <p className="text-[14px] text-muted">You are settled in every group.</p>
        ) : (
          <>
            <p className="mb-6 text-[14px] leading-relaxed">
              Across your groups you owe{" "}
              <span className="text-penalty">{joinAmounts(oweByCur)}</span> and are owed{" "}
              <span className="text-pass">{joinAmounts(owedByCur)}</span>.
            </p>

            {owe.length > 0 ? (
              <section className="mb-8">
                <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">YOU OWE</div>
                {owe.map((d) => {
                  const exp = minorUnitExponent(d.currency);
                  const major = (d.amount / 10 ** exp).toFixed(exp);
                  return (
                    <div key={d.otherId + d.groupId + d.currency} className="mb-3 border border-rule p-[14px]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-[3px]">
                          <span className="text-[15px]">{d.otherName}</span>
                          <span className="text-[12px] text-muted">{d.groupName}</span>
                        </div>
                        <span className="text-[17px] tabular-nums text-penalty">
                          {formatMoney(d.amount, d.currency)}
                        </span>
                      </div>
                      <SettleForm
                        groupId={d.groupId}
                        toUserId={d.otherId}
                        toName={d.otherName}
                        currency={d.currency}
                        defaultMajor={major}
                      />
                    </div>
                  );
                })}
              </section>
            ) : null}

            {owed.length > 0 ? (
              <section>
                <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">OWED TO YOU</div>
                {owed.map((d) => (
                  <div
                    key={d.otherId + d.groupId + d.currency}
                    className="mb-3 flex items-center justify-between gap-3 border border-rule p-[14px]"
                  >
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-[15px]">{d.otherName}</span>
                      <span className="text-[12px] text-muted">{d.groupName}</span>
                    </div>
                    <span className="text-[17px] tabular-nums text-pass">
                      {formatMoney(d.amount, d.currency)}
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  They settle from their own screen. Curfew never moves money, it only keeps the record.
                </p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function sumByCurrency(debts: Debt[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of debts) m.set(d.currency, (m.get(d.currency) ?? 0) + d.amount);
  return m;
}

function joinAmounts(byCur: Map<string, number>): string {
  if (byCur.size === 0) return formatMoney(0, "INR");
  return [...byCur.entries()].map(([cur, amt]) => formatMoney(amt, cur)).join(" + ");
}
