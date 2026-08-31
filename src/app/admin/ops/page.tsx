import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can } from "@/server/admin";
import { ActionForm, SubmitButton } from "../../ui";
import { runScoringAction, runVerifyAction } from "../actions";

export default async function AdminOps() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const [canScore, canVerify] = await Promise.all([
    can(user.id, "ops.score"),
    can(user.id, "ops.verify"),
  ]);
  if (!canScore && !canVerify) redirect("/admin");

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
    </>
  );
}
