import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can, getDriftReport } from "@/server/admin";
import { runRebuildAction } from "../actions";
import { Recompute } from "./recompute";
import { evidenceOps, humanBytes } from "@/server/ops";
import { now } from "@/lib/clock";
import { userDay } from "@/server/config";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// A drift row does not always have a date: a streak is a running total over
// every day an activity has ever had. Printing one anyway is where the
// "Invalid Date" on this page came from.
function driftDate(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : shortDate(iso);
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
  // The app's clock, not the machine's, so the preview clock moves this range
  // the same way it moves every other screen (invariant 8). And the admin's own
  // day rather than a UTC date: east of Greenwich those differ for the first
  // hours of every morning, and a window ending yesterday cannot see today.
  const instant = await now();
  const to = sp.to || (await userDay(user.id));
  const from = sp.from || isoDate(new Date(instant.getTime() - 30 * 864e5));

  const [ev, driftReport] = await Promise.all([
    evidenceOps(),
    canVerify ? getDriftReport({ from, to }) : Promise.resolve({ rows: [], total: 0 }),
  ]);

  return (
    <>
      {/* Keyed on the range the server rendered, so arriving at a different one
          (the back button, an edited URL) resets the boxes to it rather than
          leaving what was typed against a report of something else. */}
      <Recompute
        key={`${from}|${to}`}
        from={from}
        to={to}
        canVerify={canVerify}
        canRebuild={canRebuild}
        rebuild={runRebuildAction}
      />

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
                      {[driftDate(d.date), d.userName, d.typeName]
                        .filter(Boolean)
                        .join(" · ")}
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
