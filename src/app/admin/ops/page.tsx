import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can, getDriftReport } from "@/server/admin";
import { runRebuildAction } from "../actions";
import { Recompute } from "./recompute";
import { evidenceOps, humanBytes, schedulerHealth } from "@/server/ops";
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

  const [ev, scheduler, driftReport] = await Promise.all([
    evidenceOps(),
    schedulerHealth(),
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
        {/* First, because a job that did not run explains every other number
            below it. Drift is what a wrong answer looks like; this is whether
            anybody was asked the question. */}
        <h2 className="text-[13px] font-semibold tracking-[0.1em]">SCHEDULER</h2>
        <div className="flex flex-col">
          {scheduler.jobs.map((j) => (
            <OpsRow
              key={j.path}
              label={j.label}
              value={
                j.ranAt === null
                  ? "never run"
                  : `last ran ${ago(j.ranAt)}, expected every ${every(j.staleAfterMinutes)}`
              }
              right={j.ranAt === null ? "" : j.stale ? "late" : "ok"}
            />
          ))}
        </div>
        {scheduler.failures.length === 0 ? (
          <p className="text-[11.5px] text-muted">
            No job has failed its retries in the last 7 days.
          </p>
        ) : (
          <div className="flex flex-col">
            {scheduler.failures.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-[10px] border-b border-rule py-[11px]"
              >
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-[13px]">
                    {[shortDate(f.at.toISOString()), f.path, f.status ? `HTTP ${f.status}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="truncate text-[10.5px] text-muted">
                    {f.response ?? "gave up after every retry, no response body"}
                  </span>
                </div>
                <span className="flex-none text-[11.5px] text-muted">failed</span>
              </div>
            ))}
          </div>
        )}
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

/**
 * How long ago, against the REAL clock and not the app's.
 *
 * Every other date on this page goes through `now()` so the preview clock moves
 * it (invariant 8). This one must not. The question here is whether a machine
 * somewhere else called us recently, and scrubbing the preview clock a month
 * forward would answer it by reporting the scheduler as a month dead. The
 * staleness flag in `schedulerHealth()` uses `Date.now()` for the same reason,
 * and the two have to agree or the page says "ok" beside "40 days ago".
 */
function ago(at: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The cadence a job is held to, said the way the row above it reads. */
function every(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours < 24 ? `${hours} hr` : `${Math.round(hours / 24)} days`;
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
