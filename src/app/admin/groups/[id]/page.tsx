import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupInspector } from "@/server/admin";
import { formatMoney } from "@/domain";

export default async function GroupInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getGroupInspector(id);
  if (!data) notFound();

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{data.name}</h2>
        <Link href="/admin/groups" className="text-[12px] text-muted underline">all groups</Link>
      </div>

      <Panel title="MEMBERS">
        {data.members.map((m) => (
          <Row key={m.userId}>
            <Link href={`/admin/users/${m.userId}`} className="underline">
              {m.name} <span className="text-[11px] text-muted">{m.role}</span>
            </Link>
            <span className="text-[11px] tabular-nums text-muted">
              joined {m.joinedAt}{m.leftAt ? ` · left ${m.leftAt}` : ""}
            </span>
          </Row>
        ))}
      </Panel>

      <Panel title="RULES TIMELINE">
        {data.rulesTimeline.length === 0 ? (
          <Empty>Using the default rules (no group-specific changes).</Empty>
        ) : (
          data.rulesTimeline.map((r, i) => (
            <Row key={i}>
              <span>from {r.effectiveFrom}</span>
              <span className="tabular-nums text-muted">
                {formatMoney(r.fineAmount, r.currency)} · {r.fineMode} · grace {r.gracePerMonth}
              </span>
            </Row>
          ))
        )}
      </Panel>

      <Panel title="LEDGER">
        {data.ledger.length === 0 ? (
          <Empty>No entries.</Empty>
        ) : (
          data.ledger.map((l) => (
            <Row key={l.id}>
              <span>
                {l.kind === "settlement" ? `${l.toName} → ${l.fromName}` : `${l.fromName} → ${l.toName}`}
                <span className="ml-2 text-[11px] text-muted">
                  {l.kind}{l.periodStart ? ` · ${l.periodStart}` : ` · ${new Date(l.createdAt).toISOString().slice(0, 10)}`}
                </span>
              </span>
              <span className={"tabular-nums " + (l.kind === "settlement" ? "text-pass" : "text-penalty")}>
                {formatMoney(l.amount, l.currency)}
              </span>
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
