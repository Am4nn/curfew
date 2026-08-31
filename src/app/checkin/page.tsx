import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups } from "@/server/groups";
import { getCheckinState } from "@/server/checkin";
import { CheckinButton } from "../checkin-button";

// The check-in loop. Forced dark regardless of the theme choice: the night
// screen must not be pleasant to open at 23:00 (PRD G4). A user with no group
// cannot be scored, so they are sent to the dashboard to create or join one.
export default async function Checkin() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const groups = await listUserGroups(user.id);
  if (groups.length === 0) redirect("/");

  const state = await getCheckinState(user.id);

  return (
    <div data-theme="dark" className="min-h-screen bg-bg text-fg">
      <main className="mx-auto flex min-h-screen max-w-[560px] flex-col px-5 py-7">
        <header className="flex items-baseline justify-between">
          <Link href="/" className="text-[13px] font-semibold tracking-[0.14em]">
            CURFEW
          </Link>
          <span className="text-[12px] text-muted">{state.period}</span>
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
          <Link href="/ledger" className="text-[12px] text-muted underline">
            ledger
          </Link>
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
