import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { registeredKeys } from "@/domain";
import { getCheckinState } from "@/server/checkin";
import { standingFor } from "@/server/standing";
import { CheckinForm } from "./checkin-form";

// Bare chrome, no tab bar: a single act with a way back, not a place to browse
// from. A GET, so it records nothing (invariant 9); the only writer is the
// action behind the buttons.
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  if (!registeredKeys().includes(key)) notFound();

  const state = await getCheckinState(user.id, key);
  // Not tracked, so there is nothing to check in against. The configure screen
  // is where that starts.
  if (!state) redirect(`/activities/${key}`);

  // The open one. Where several overlap, the module's own order wins.
  const step = state.steps.find((s) => s.open) ?? null;
  const standing = await standingFor(user.id, key);

  const occurrence =
    step && step.repeats && step.count > 0
      ? ` · ${step.label.toLowerCase()} ${step.count + 1}`
      : "";

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px] pt-5">
        <Link href={`/activities/${key}`} className="flex items-center gap-[9px]">
          <span className="text-[14px] text-muted">&lsaquo;</span>
          <span className="text-[14px] font-semibold tracking-[0.14em]">CHECK IN</span>
        </Link>
        <span className="text-[11px] text-muted">
          {state.name}
          {occurrence} &middot; {state.nowLabel}
        </span>
      </header>

      {step ? (
        <CheckinForm state={state} step={step} streak={standing?.streak ?? 0} />
      ) : (
        <Closed state={state} />
      )}
    </main>
  );
}

// No mock covers this: every check-in board is drawn with a window open.
function Closed({
  state,
}: {
  state: NonNullable<Awaited<ReturnType<typeof getCheckinState>>>;
}) {
  const next = state.steps[0];
  return (
    <div className="flex flex-1 flex-col gap-[18px] px-5 pb-6 pt-[18px]">
      <span className="text-[16px] leading-[1.5]">
        {state.scheduled
          ? "No window is open."
          : `${state.name} is not scheduled today.`}
      </span>
      {state.scheduled && next ? (
        <span className="text-[11.5px] leading-[1.55] text-muted">
          {next.label} runs {next.opensLabel} to {next.closesLabel}. Nothing recorded
          outside it counts.
        </span>
      ) : null}
      <div className="flex-1" />
      <Link
        href={`/activities/${state.typeKey}`}
        className="flex h-[46px] items-center justify-center border border-rule text-[13.5px] text-fg"
      >
        Back to {state.name}
      </Link>
    </div>
  );
}
