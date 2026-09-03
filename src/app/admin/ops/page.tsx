import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can } from "@/server/admin";
import { ActionForm, SubmitButton } from "../../ui";
import { runScoringAction, runVerifyAction } from "../actions";
import { evidenceOps, humanBytes } from "@/server/ops";

export default async function AdminOps() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const [canScore, canVerify] = await Promise.all([
    can(user.id, "ops.score"),
    can(user.id, "ops.verify"),
  ]);
  if (!canScore && !canVerify) redirect("/admin");

  const ev = await evidenceOps();

  return (
    <>
      {canScore ? (
        <section className="mb-8">
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">RUN SCORING</h2>
          <p className="mb-3 text-[13px] text-muted">
            Scores every user up to the last closed night. Idempotent. Leave the date blank
            for a normal run, or set one to force a recompute from that date.
          </p>
          <ActionForm action={runScoringAction} className="flex flex-wrap items-center gap-2">
            <input name="from" type="date" className="border border-fg bg-transparent px-2 py-[7px] text-[14px]" />
            <SubmitButton pendingLabel="Scoring" className="border border-fg bg-fg px-4 py-[8px] text-[14px] text-bg">
              Run scoring
            </SubmitButton>
          </ActionForm>
        </section>
      ) : null}

      {canVerify ? (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">RUN VERIFY</h2>
          <p className="mb-3 text-[13px] text-muted">
            Recomputes all history from events and diffs it against the stored scores and
            outcomes. Any drift is a bug worth chasing.
          </p>
          <ActionForm action={runVerifyAction}>
            <SubmitButton pendingLabel="Verifying" className="border border-fg bg-fg px-4 py-[8px] text-[14px] text-bg">
              Run verify
            </SubmitButton>
          </ActionForm>
        </section>
      ) : null}

      <section className="mt-8 flex flex-col gap-[10px]">
        <h2 className="text-[13px] font-semibold tracking-[0.1em]">EVIDENCE</h2>
        <div className="flex flex-col">
          <OpsRow label="Stored" value={`${humanBytes(ev.bytes)} across ${ev.stored} photos`} />
          <OpsRow label="Retention" value={`deleted after ${ev.retentionDays} days`} />
          <OpsRow
            label="Last sweep"
            value={
              ev.lastSweep
                ? `${ev.lastSweep.deleted} deleted in the last day`
                : "nothing swept yet"
            }
            right={ev.lastSweep ? ev.lastSweep.at.toISOString().slice(0, 10) : ""}
          />
          <OpsRow
            label="Waiting to be swept"
            value={ev.orphaned === 0 ? "none" : `${ev.orphaned} uploads with no check-in`}
            right={ev.orphaned === 0 ? "ok" : ""}
          />
        </div>
        <p className="text-[11.5px] leading-[1.55] text-muted">
          Counted, never read. The console knows how many photos exist and never
          what any of them shows.
        </p>
      </section>
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
