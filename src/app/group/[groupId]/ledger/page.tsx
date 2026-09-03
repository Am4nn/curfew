import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { getGroupLedgerRows } from "@/server/ledger";
import { groupHeader, groupBalances } from "@/server/group-view";
import { formatMoney, minorUnitExponent, getActivityType } from "@/domain";
import { SettleForm } from "../../../ledger/settle-form";

// Every fine, settlement and correction ever recorded here. Entries are never
// edited or removed (invariant 3); a correction is a new row.
export default async function GroupLedger({
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

  const [header, rows, balances] = await Promise.all([
    groupHeader(groupId, user.id),
    getGroupLedgerRows(groupId),
    groupBalances(groupId, user.id),
  ]);
  if (!header) redirect("/groups");
  // A group with money off has no ledger at all.
  if (!header.moneyOn) redirect(`/group/${groupId}`);

  const currency = balances[0]?.currency ?? "INR";
  const owe = balances.filter((b) => b.netOwed > 0).reduce((s, b) => s + b.netOwed, 0);
  const owed = balances.filter((b) => b.netOwed < 0).reduce((s, b) => s - b.netOwed, 0);

  const describe = (r: (typeof rows)[number]) => {
    if (r.kind === "settlement") {
      return `${r.toUserId === user.id ? "You" : r.toName} settled with ${r.fromUserId === user.id ? "you" : r.fromName}`;
    }
    if (r.kind === "adjustment") return r.note ?? "Correction";
    const who = r.fromUserId === user.id ? "You" : r.fromName;
    const type = r.typeKey ? getActivityType(r.typeKey).name.toLowerCase() : "an activity";
    return `${who} missed ${type}`;
  };

  const direction = (r: (typeof rows)[number]) =>
    `${r.fromUserId === user.id ? "You" : r.fromName} to ${r.toUserId === user.id ? "you" : r.toName}`;

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px] pt-5">
        <Link href={`/group/${groupId}/standing`} className="flex items-center gap-[9px]">
          <span className="text-[14px] text-muted">&lsaquo;</span>
          <span className="text-[14px] font-semibold tracking-[0.14em]">LEDGER</span>
        </Link>
        <span className="text-[11px] text-muted">{header.name}</span>
      </header>

      <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
        <div className="flex gap-[10px]">
          <div className="flex flex-1 flex-col gap-1 border border-rule p-3">
            <span className="text-[10px] text-muted">YOU OWE</span>
            <span className="text-[19px] tabular-nums text-penalty">
              {formatMoney(owe, currency)}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-1 border border-rule p-3">
            <span className="text-[10px] text-muted">OWED TO YOU</span>
            <span className="text-[19px] tabular-nums text-pass">
              {formatMoney(owed, currency)}
            </span>
          </div>
        </div>

        {balances
          .filter((b) => b.netOwed > 0)
          .map((b) => (
            <SettleForm
              key={b.userId}
              groupId={groupId}
              toUserId={b.userId}
              toName={b.name}
              currency={b.currency}
              defaultMajor={String(b.netOwed / 10 ** minorUnitExponent(b.currency))}
            />
          ))}

        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">EVERY ENTRY</span>
          {rows.length === 0 ? (
            <p className="text-[12px] text-muted">Nothing recorded yet.</p>
          ) : (
            <div className="border border-rule">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-[10px] border-b border-rule px-[13px] py-3"
                >
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-[12.5px]">{describe(r)}</span>
                    <span className="text-[10px] text-muted">
                      {DateTime.fromJSDate(r.createdAt).toFormat("d LLL")} &middot;{" "}
                      {direction(r)}
                    </span>
                  </div>
                  <span
                    className={
                      "flex-none text-[13px] tabular-nums " +
                      (r.kind !== "fine"
                        ? "text-muted"
                        : r.fromUserId === user.id
                          ? "text-penalty"
                          : "text-pass")
                    }
                  >
                    {formatMoney(r.amount, r.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="border-l-[3px] border-l-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
          Entries are never edited or removed. A correction is a new row.
        </div>
      </div>
    </main>
  );
}
