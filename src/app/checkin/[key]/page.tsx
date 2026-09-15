import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { registeredKeys } from "@/domain";
import { getCheckinState } from "@/server/checkin";
import { standingFor } from "@/server/standing";
import { CheckinForm } from "./checkin-form";
import { BackLink } from "@/app/back-link";

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
        <div className="flex items-center gap-[9px]">
          <BackLink fallback={`/activities/${key}`} className="text-[14px] text-muted" />
          <span className="text-[14px] font-semibold tracking-[0.14em]">CHECK IN</span>
        </div>
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
  // A window can be open and still take nothing: gym's runs all week and counts
  // one session a day. Saying "No window is open" about that is simply untrue,
  // so the module's own line answers it instead, and the engine never writes a
  // sentence about why (invariant 6).
  // `!s.open` rather than `!s.counts`: a step that happens once a period is
  // spent by having happened, and the engine knows that without the module
  // saying so. Office arrived at 9 AM read "No window is open" for the rest of
  // the day, which is untrue: the window is open and the arrival is recorded.
  const spent = state.steps.find((s) => s.inWindow && !s.open) ?? null;
  // A step whose window has not started because it is anchored to a press that
  // has not happened. It answers the question better than anything else on
  // this screen can: half past six, wake recorded, confirm at seven, and
  // without this the screen says the wake is already in and stops there.
  //
  // Only once the press it hangs off has actually landed. Before that the wait
  // is not what is happening, it is just a window later in the night, and at
  // three in the morning "Opens 30 minutes after you press Wake" would be an
  // answer to a question nobody asked.
  const waiting =
    state.steps.find(
      (s) =>
        s.waitingOn &&
        (state.steps.find((o) => o.key === s.waitingOn!.step)?.count ?? 0) > 0,
    ) ?? null;
  return (
    <div className="flex flex-1 flex-col gap-[18px] px-5 pb-6 pt-[18px]">
      <span className="text-[16px] leading-[1.5]">
        {!state.scheduled
          ? `${state.name} is not scheduled today.`
          : spent?.waitingUntil
            ? `${spent.label} counts again from ${spent.waitingUntil}.`
            : waiting
              ? waiting.waitingOn!.message
              : spent
                ? (spent.hint ?? `${spent.label} is already recorded for today.`)
                : "No window is open."}
      </span>
      {state.scheduled && !spent && !waiting && next ? (
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
