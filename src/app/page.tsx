import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { ensureUserSetup } from "@/server/setup";
import { getCheckinState } from "@/server/checkin";
import { CheckinButton } from "./checkin-button";
import { SignOut } from "./sign-out";

// The check-in loop. This is the whole app for a v1 user; the richer dashboard
// arrives with money (Phase 4) and groups (Phase 5). Forced dark regardless of
// the theme choice: the night screen must not be pleasant to open at 23:00
// (PRD G4).
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const status = await getApprovalStatus(user.id);
  if (status !== "approved") redirect("/pending");

  await ensureUserSetup(user.id);
  const state = await getCheckinState(user.id);

  return (
    <div data-theme="dark" className="min-h-screen bg-bg text-fg">
      <main className="mx-auto flex min-h-screen max-w-[560px] flex-col px-5 py-7">
        <header className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold tracking-[0.14em]">CURFEW</span>
          <span className="flex items-baseline gap-3 text-[12px] text-muted">
            <Link href="/ledger" className="underline">
              ledger
            </Link>
            {state.period}
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center gap-[26px]">
          <Action state={state} />
        </section>

        <footer className="flex items-center justify-between border-t border-rule pt-4">
          <p className="text-[12px] tabular-nums text-muted">
            {state.steps.map((s, i) => (
              <span key={s.key}>
                {i > 0 ? "  ·  " : ""}
                {s.label} {s.at ?? "—"}
              </span>
            ))}
          </p>
          <SignOut />
        </footer>
      </main>
    </div>
  );
}

function Action({ state }: { state: Awaited<ReturnType<typeof getCheckinState>> }) {
  const { action } = state;

  if (action.kind === "open") {
    return (
      <>
        <p className="text-[14px] text-muted">
          Window closes <b className="font-medium text-fg">{action.closesLabel}</b>.
          Miss it and last night does not count.
        </p>
        <CheckinButton label={`${action.label} check-in`} />
      </>
    );
  }

  if (action.kind === "waiting") {
    return (
      <>
        <div className="border border-rule p-[22px]">
          <div className="text-[13px] text-muted">{action.label} check-in</div>
          <div className="mt-1 text-[26px] font-semibold tabular-nums">
            {action.recordedLabel}
          </div>
        </div>
        {action.next ? (
          <p className="text-[13px] text-muted">
            next: {action.next.label}, {action.next.opensLabel}
            {"–"}
            {action.next.closesLabel}
          </p>
        ) : null}
      </>
    );
  }

  // idle
  return (
    <>
      <p className="text-[15px]">No window open.</p>
      {action.next ? (
        <p className="text-[13px] text-muted">
          next: {action.next.label}, {action.next.opensLabel}
          {"–"}
          {action.next.closesLabel}
        </p>
      ) : (
        <p className="text-[13px] text-muted">Nothing more tonight.</p>
      )}
    </>
  );
}
