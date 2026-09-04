import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can, getDriftReport } from "@/server/admin";
import { runRebuildAction } from "../actions";
import { ActionForm, SubmitButton } from "../../ui";
import { evidenceOps, humanBytes } from "@/server/ops";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function AdminOps({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const [canVerify, canRebuild] = await Promise.all([
    can(user.id, "ops.verify"),
    can(user.id, "ops.score"),
  ]);
  if (!canVerify && !canRebuild) redirect("/admin");

  const sp = await searchParams;
  const to = sp.to || isoDate(new Date());
  const from = sp.from || isoDate(new Date(Date.now() - 30 * 864e5));

  const [ev, driftReport] = await Promise.all([
    evidenceOps(),
    canVerify ? getDriftReport({ from, to }) : Promise.resolve({ rows: [], total: 0 }),
  ]);

  return (
    <>
      <section className="mb-8 flex flex-col gap-[10px]">
        <h2 className="text-[13px] font-semibold tracking-[0.1em]">RECOMPUTE</h2>
        <form method="get" id="recompute-range" className="flex flex-col gap-[7px]">
          <span className="text-[11px] tracking-[0.06em] text-muted">Range</span>
          <div className="flex items-center gap-[9px]">
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="flex-1 border border-rule bg-transparent px-3 py-[10px] text-[14px]"
            />
            <span className="text-[11px] text-muted">to</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="flex-1 border border-rule bg-transparent px-3 py-[10px] text-[14px]"
            />
          </div>
        </form>
        <div className="flex gap-[10px]">
          {canVerify ? (
            <button
              type="submit"
              form="recompute-range"
              className="h-11 border border-rule px-4 text-[14px]"
            >
              Verify
            </button>
          ) : null}
          {canRebuild ? (
            <ActionForm action={runRebuildAction}>
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <SubmitButton pendingLabel="Rebuilding" className="h-11 border border-rule px-4 text-[14px]">
                Rebuild
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
        <p className="text-[11.5px] leading-[1.55] text-muted">
          Verify recomputes and reports what differs. Rebuild writes the result.
        </p>
      </section>

      <section className="mb-8 flex flex-col gap-[10px]">
        <h2 className="text-[13px] font-semibold tracking-[0.1em]">EVIDENCE</h2>
        <div className="flex flex-col">
          <OpsRow label="Stored" value={`${humanBytes(ev.bytes)} across ${ev.stored} photos`} />
          <OpsRow label="Retention" value={`deleted after ${ev.retentionDays} days`} />
          <OpsRow
            label="Last sweep"
            value={ev.lastSweep ? `${ev.lastSweep.deleted} deleted` : "nothing swept yet"}
            right={ev.lastSweep ? ev.lastSweep.at.toISOString().slice(0, 10) : ""}
          />
          <OpsRow
            label="Orphaned objects"
            value={ev.orphaned === 0 ? "none" : `${ev.orphaned} uploads with no check-in`}
            right={ev.orphaned === 0 ? "ok" : "review"}
          />
        </div>
      </section>

      {canVerify ? (
        <section className="flex flex-col gap-[10px]">
          <h2 className="text-[13px] font-semibold tracking-[0.1em]">DRIFT, LAST RUN</h2>
          {driftReport.rows.length === 0 ? (
            <p className="text-[14px] text-muted">
              No drift. Stored rows match a fresh recompute for {shortDate(from)} to {shortDate(to)}.
            </p>
          ) : (
            <div className="flex flex-col">
              {driftReport.rows.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-[10px] border-b border-rule py-[11px]"
                >
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-[13px]">
                      {shortDate(d.date)} · {d.userName} · {d.typeName}
                    </span>
                    <span className="text-[10.5px] text-muted">{d.detail}</span>
                  </div>
                  <span className="flex-none text-[11.5px] text-muted">review</span>
                </div>
              ))}
              {driftReport.total > driftReport.rows.length ? (
                <p className="pt-2 text-[11.5px] text-muted">
                  {driftReport.total - driftReport.rows.length} more not shown.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <div className="mt-8 border-l-2 border-penalty bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
        Rebuild rewrites derived tables only. Events and ledger entries are never touched.
      </div>
    </>
  );
}

function OpsRow({ label, value, right }: { label: string; value: string; right?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-rule py-[11px]">
      <span className="flex-1 text-[13px]">{label}</span>
      <span className="text-[11.5px] text-muted">{value}</span>
      {right ? <span className="text-[11px] text-muted">{right}</span> : null}
    </div>
  );
}
