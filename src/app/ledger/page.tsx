import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  getUserGroups,
  listGroupMembers,
  getGroupLedgerRows,
  type LedgerRow,
} from "@/server/ledger";
import { formatMoney, minorUnitExponent } from "@/domain";
import { SettleForm } from "./settle-form";

export default async function Ledger() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const groups = await getUserGroups(user.id);

  return (
    <main className="min-h-screen px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">LEDGER</h1>
          <Link href="/" className="text-[12px] text-muted underline">
            check-in
          </Link>
        </header>

        {groups.length === 0 ? (
          <p className="text-[14px] text-muted">No groups yet.</p>
        ) : (
          groups.map((g) => (
            <GroupLedger key={g.groupId} groupId={g.groupId} name={g.name} userId={user.id} />
          ))
        )}
      </div>
    </main>
  );
}

async function GroupLedger({
  groupId,
  name,
  userId,
}: {
  groupId: string;
  name: string;
  userId: string;
}) {
  const members = await listGroupMembers(groupId);
  const rows = await getGroupLedgerRows(groupId);
  const nameById = new Map(members.map((m) => [m.userId, m.name]));

  // Pairwise net between the current user and each other member, per currency.
  // Positive means the user owes that member.
  const net = new Map<string, number>(); // "otherId|CUR" -> amount user owes
  for (const r of rows) {
    if (r.fromUserId === userId) {
      const k = `${r.toUserId}|${r.currency}`;
      net.set(k, (net.get(k) ?? 0) + r.amount);
    } else if (r.toUserId === userId) {
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
    <section className="mb-8">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.1em]">{name}</h2>

      {owed.length === 0 ? (
        <div className="border-2 border-fg p-[18px]">
          <div className="text-[13px] text-muted">Balance</div>
          <div className="mt-1 text-[18px]">Settled.</div>
          {hasFines ? (
            <div className="mt-1 text-[12px] text-muted">
              Fines were recorded. See the feed.
            </div>
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
    </section>
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
          <div
            className={
              "tabular-nums " + (r.kind === "settlement" ? "text-pass" : "text-penalty")
            }
          >
            {formatMoney(r.amount, r.currency)}
          </div>
        </div>
      ))}
    </div>
  );
}
