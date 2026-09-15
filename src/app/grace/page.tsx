import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { graceState, openOffers } from "@/server/restore";
import { ActivityIcon, DeadFlame } from "@/app/activity-icon";
import { RestoreButton } from "@/app/restore-sheet";
import { BackLink } from "@/app/back-link";

// The grace screen (items 19 and 20, mock V32Grace).
//
// What the pool is, what is open, and what has gone. It exists for one state
// Home cannot answer: an offer somebody cannot afford. Home shows no Restore on
// a row nobody can act on, because a disabled control is a thing to wonder
// about on the screen looked at most. Here the offer keeps its place in the
// list and loses its button, and says what it needs against what you have,
// which makes this the one screen that explains the row.
export default async function GracePage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [state, offers] = await Promise.all([graceState(user.id), openOffers(user.id)]);
  const resets = DateTime.fromISO(state.resets).toFormat("d LLLL");

  return (
    <main className="min-h-dvh pb-nav">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <BackLink fallback="/settings" className="text-[14px] text-muted" />
        <span className="text-[14px] font-semibold tracking-[0.14em]">GRACE</span>
      </header>

      <div className="flex flex-col gap-[22px] px-5 pb-6 pt-[18px]">
        <section className="flex flex-col gap-[9px]">
          <div className="flex items-baseline gap-[10px]">
            <span className="text-[38px] font-semibold leading-none tabular-nums">
              {state.left}
            </span>
            <span className="text-[15px] text-muted">of {state.pool} left</span>
          </div>
          {/* One segment a grace, filled for what is left. The same bar the day
              at the top of Home uses, which is what makes it read without a
              label. */}
          <div className="flex gap-[4px]">
            {Array.from({ length: state.pool }, (_, i) => (
              <div
                key={i}
                className={"h-[3px] flex-1 " + (i < state.left ? "bg-fg" : "bg-rule")}
              />
            ))}
          </div>
          <span className="text-[11.5px] leading-[1.55] text-muted">
            Two a month per activity. Resets {resets}.
          </span>
        </section>

        {offers.length > 0 ? (
          <section className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">OPEN</span>
            {offers.map((offer) => (
              <div
                key={offer.typeKey}
                className={
                  "flex flex-col gap-[11px] border border-rule p-[13px] " +
                  (offer.affordable ? "" : "opacity-[0.72]")
                }
              >
                <div className="flex items-center gap-[9px]">
                  <span className={offer.affordable ? "text-fg" : "text-muted"}>
                    <ActivityIcon name={offer.icon} size={16} />
                  </span>
                  <span
                    className={
                      "flex-1 text-[13px] " + (offer.affordable ? "" : "text-muted")
                    }
                  >
                    {offer.name}
                  </span>
                  <span className="text-[10.5px] text-muted">{offer.closes}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-[5px]">
                    <DeadFlame size={15} />
                    <span className="text-[15px] text-muted tabular-nums">
                      {offer.restoresTo}
                    </span>
                  </span>
                  <span className="flex-1 text-[11px] text-muted">
                    {offer.affordable
                      ? `${offer.cost} grace`
                      : `needs ${offer.cost}, you have ${state.left}`}
                  </span>
                  {offer.affordable ? (
                    <RestoreButton
                      variant="filled"
                      offer={{
                        typeKey: offer.typeKey,
                        name: offer.name,
                        icon: offer.icon,
                        cost: offer.cost,
                        restoresTo: offer.restoresTo,
                        left: state.left,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {state.spentOn.length > 0 ? (
          <section className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">SPENT</span>
            <div className="flex flex-col">
              {state.spentOn.map((s, i) => (
                <div
                  key={`${s.typeKey}-${s.day}-${i}`}
                  className="flex items-baseline gap-[10px] border-b border-rule py-[9px]"
                >
                  <span className="flex-1 text-[12.5px]">{s.name}</span>
                  <span className="text-[11px] text-muted">
                    {DateTime.fromISO(s.day).toFormat("d LLL")}
                  </span>
                  <span className="text-[12px] tabular-nums">{s.cost}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {offers.length === 0 && state.spentOn.length === 0 ? (
          <p className="text-[12.5px] leading-[1.6] text-muted">
            Nothing to restore. Grace is offered when a streak ends, and only
            until you next check in for that activity.
          </p>
        ) : null}

        <p className="text-[11.5px] leading-[1.55] text-muted">
          Grace holds a streak. Fines and standing are untouched.
        </p>
      </div>
    </main>
  );
}
