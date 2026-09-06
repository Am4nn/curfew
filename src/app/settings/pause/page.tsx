import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { currentPause, lengthOf, MINIMUM_DAYS, type Pause } from "@/server/pause";
import { userDay } from "@/server/config";
import { shortDay, dayAfter, daysBetween } from "@/lib/day-format";
import { BackLink } from "@/app/back-link";
import { ActionForm, InfoHint, SubmitButton } from "@/app/ui";
import { declarePauseAction, extendPauseAction, endPauseAction } from "./actions";

// Pause: telling Curfew you are away.
//
// It lives in Settings rather than on Home because it is rare, deliberate and
// global: one declaration covers every group and your own record. Decisions 133
// to 137.
//
// The cost is stated above the button, never below it. What a pause takes is
// the streak, and somebody who finds that out afterwards has been misled by a
// screen that had room to say so.

function Fact({ what, value, why }: { what: string; value: string; why?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-[11px]">
      <div className="flex flex-col gap-[2px]">
        <span className="text-[13px]">{what}</span>
        {why ? <span className="text-[10.5px] text-muted">{why}</span> : null}
      </div>
      <span className="text-right text-[13px] text-muted">{value}</span>
    </div>
  );
}

function Running({ pause, today }: { pause: Pause; today: string }) {
  const left = daysBetween(today, pause.endsOn);

  return (
    <>
      <div className="flex flex-col gap-2 border border-accent p-[14px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-accent">PAUSED</span>
          <span className="text-[12px] text-accent">
            {left} {left === 1 ? "day" : "days"} left
          </span>
        </div>
        <span className="text-[13px] leading-[1.55]">
          Back on {shortDay(dayAfter(pause.endsOn))}.
        </span>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          Nothing is scheduled and nothing counts, in any group.
        </span>
      </div>

      <div className="flex flex-col">
        <Fact what="Declared" value={shortDay(pause.declaredAt.toISOString().slice(0, 10))} />
        <Fact what="From" value={shortDay(pause.startsOn)} />
        <Fact
          what="To"
          value={shortDay(pause.endsOn)}
          why={pause.revisions > 0 ? `Changed ${pause.revisions} time${pause.revisions === 1 ? "" : "s"}` : undefined}
        />
        <Fact
          what="Streaks"
          value={`Ended ${shortDay(pause.startsOn)}`}
          why="When the day closed, not when you declared"
        />
      </div>

      <ActionForm action={extendPauseAction} className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">STAYING LONGER</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="to"
            required
            defaultValue={pause.endsOn}
            min={DateTime.fromISO(pause.endsOn).plus({ days: 1 }).toFormat("yyyy-MM-dd")}
            className="flex-1 border border-fg bg-transparent px-3 py-[9px] text-[14px]"
          />
          <SubmitButton
            pendingLabel="Saving"
            className="border border-rule px-3 py-[9px] text-[13px]"
          >
            Extend
          </SubmitButton>
        </div>
      </ActionForm>

      <ActionForm action={endPauseAction} className="flex flex-col gap-[9px]">
        <SubmitButton
          pendingLabel="Saving"
          className="self-start border border-rule px-3 py-[9px] text-[13px]"
        >
          Come back early
        </SubmitButton>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          From tomorrow. The days already passed stay paused, and the streak that
          ended does not come back.
        </span>
      </ActionForm>
    </>
  );
}

function Declared({ pause }: { pause: Pause }) {
  return (
    <>
      <div className="flex flex-col gap-2 border border-accent p-[14px]">
        <span className="text-[10px] tracking-[0.16em] text-accent">DECLARED</span>
        <span className="text-[13px] leading-[1.55]">
          Away {shortDay(pause.startsOn)} to {shortDay(pause.endsOn)}.
        </span>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          {lengthOf(pause)} days. Your groups can already see it.
        </span>
      </div>

      <ActionForm action={endPauseAction} className="flex flex-col gap-[9px]">
        <SubmitButton
          pendingLabel="Saving"
          className="self-start border border-rule px-3 py-[9px] text-[13px]"
        >
          Call it off
        </SubmitButton>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          It has not started, so nothing has happened yet and it goes entirely.
        </span>
      </ActionForm>
    </>
  );
}

function Declare({ today }: { today: string }) {
  const tomorrow = DateTime.fromISO(today, { zone: "utc" }).plus({ days: 1 });
  const from = tomorrow.toFormat("yyyy-MM-dd");
  const to = tomorrow.plus({ days: MINIMUM_DAYS - 1 }).toFormat("yyyy-MM-dd");

  return (
    <>
      <p className="text-[13px] leading-[1.6]">
        Tell Curfew you are away. The days are not counted, in any group or on
        your own record.
      </p>

      <ActionForm action={declarePauseAction} className="flex flex-col gap-[14px]">
        <div className="flex gap-[11px]">
          <label className="flex flex-1 flex-col gap-[6px]">
            <span className="text-[10px] tracking-[0.14em] text-muted">FROM</span>
            <input
              type="date"
              name="from"
              required
              defaultValue={from}
              min={from}
              className="border border-fg bg-transparent px-3 py-[9px] text-[14px]"
            />
          </label>
          <label className="flex flex-1 flex-col gap-[6px]">
            <span className="text-[10px] tracking-[0.14em] text-muted">TO</span>
            {/* No `min` here. It could only be computed from the start date
                as it stands on the server, so the moment somebody picks a
                later one it would be wrong, and a wrong `min` blocks a valid
                submission with no message at all. The length rule is the
                server's, where it can say what it wants. */}
            <input
              type="date"
              name="to"
              required
              defaultValue={to}
              min={from}
              className="border border-fg bg-transparent px-3 py-[9px] text-[14px]"
            />
          </label>
        </div>
        <span className="-mt-2 text-[11.5px] text-muted">
          Starts tomorrow at the earliest. {MINIMUM_DAYS} days minimum.
        </span>

        <div className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">WHAT IT COSTS</span>
          <div className="flex flex-col gap-[5px] border border-penalty p-[13px]">
            <span className="text-[13px] text-penalty">Every streak ends at 0.</span>
            <span className="text-[11.5px] leading-[1.55] text-muted">
              A streak is consecutive days. A pause is a gap, and grace does not
              cover one. They end when the first paused day closes, the same as
              any day you miss, not the moment you declare.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">WHAT IT SAVES</span>
          <div className="flex flex-col">
            <Fact what="Reputation" value="Not marked down" why="The days are not misses" />
            <Fact what="Money" value="Nothing owed" why="Nothing scheduled, nothing to fine" />
            <Fact what="After 7 days away" value="Settles" why="The same as any quiet week" />
          </div>
        </div>

        <SubmitButton
          pendingLabel="Declaring"
          className="h-12 w-full border border-fg bg-fg text-[14px] font-semibold text-bg"
        >
          Declare
        </SubmitButton>
      </ActionForm>

      <span className="text-[11.5px] leading-[1.55] text-muted">
        Your groups see the dates. Nothing about a pause is per group.
      </span>
    </>
  );
}

export default async function PauseSettings() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [held, today] = await Promise.all([currentPause(user.id), userDay(user.id)]);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-5">
        <header className="-mx-5 mb-1 flex items-center justify-between border-b border-rule px-5 pb-[10px]">
          <h1 className="flex items-center text-[15px] font-semibold tracking-[0.14em]">
            PAUSE
            <InfoHint label="How a pause works">
              A day you have declared away is a day with nothing scheduled. It is
              not a miss, so it cannot be fined and it does not mark your score
              down. It ends your streaks, which is the price, and after a week
              away your score settles the way any quiet week makes it settle.
            </InfoHint>
          </h1>
          <BackLink fallback="/settings" className="text-[12px] text-muted" />
        </header>

        {held === null ? (
          <Declare today={today} />
        ) : held.running ? (
          <Running pause={held.pause} today={today} />
        ) : (
          <Declared pause={held.pause} />
        )}
      </div>
    </main>
  );
}
