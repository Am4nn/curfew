import Link from "next/link";
import { endPauseAction } from "@/app/settings/pause/actions";
import { ActionForm, SubmitButton } from "@/app/ui";

/**
 * Home, while a pause is running.
 *
 * It replaces the day board and nothing else. Money and standing do not stop
 * existing while somebody is travelling, so everything below this stays where
 * it was: a Home that dropped them would read as the account being suspended
 * rather than as a member being away.
 *
 * The streak line is the one that has to be exactly right. A pause ends every
 * streak, but it ends them when the first paused day CLOSES, like any missed
 * day, not the moment the pause was declared. So on day one this still says
 * they are running, because they are.
 */
export function PausedDay({
  backOn,
  daysLeft,
  endedOn,
  startsToday,
}: {
  backOn: string;
  daysLeft: number;
  /** The first paused day: the one whose close takes the streaks. */
  endedOn: string;
  startsToday: boolean;
}) {
  return (
    <>
      <section className="flex flex-col gap-[6px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">TODAY</span>
        <span className="text-[38px] font-semibold leading-none text-muted">Paused</span>
        <div className="mt-2 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[3px] flex-1 border-t border-dashed border-rule" />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-[5px] border border-accent p-[13px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="text-[12.5px] text-accent">Back on {backOn}.</span>
          <span className="flex-none text-[11px] text-accent">
            {daysLeft} {daysLeft === 1 ? "day" : "days"}
          </span>
        </div>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          Nothing is scheduled and nothing counts.
        </span>
      </div>

      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">
          WHILE YOU ARE AWAY
        </span>
        <div className="flex flex-col">
          {[
            startsToday
              ? ["Streaks", "Running until tonight", "They end when today closes, like any missed day"]
              : ["Streaks", "Ended", `When ${endedOn} closed`],
            ["Reputation", "Not marked down", "Settles after a week away"],
            ["Money", "Nothing owed", ""],
          ].map(([what, value, why]) => (
            <div
              key={what}
              className="flex items-baseline justify-between gap-3 border-b border-rule py-[11px]"
            >
              <div className="flex flex-col gap-[2px]">
                <span className="text-[12.5px]">{what}</span>
                {why ? <span className="text-[10.5px] text-muted">{why}</span> : null}
              </div>
              <span className="text-right text-[13px] text-muted">{value}</span>
            </div>
          ))}
        </div>

        {/* The two things you would want mid-trip, where you already are. The
            full screen is still in Settings for the dates and the history. */}
        <div className="flex items-center gap-2">
          {/* Extending needs a date, so it is a link to the screen that has
              one. Coming back early needs nothing, so it happens here. */}
          <Link
            href="/settings/pause"
            className="border border-rule px-3 py-[8px] text-[12.5px]"
          >
            Extend
          </Link>
          <ActionForm action={endPauseAction}>
            <SubmitButton
              pendingLabel="Saving"
              className="border border-rule px-3 py-[8px] text-[12.5px]"
            >
              Come back early
            </SubmitButton>
          </ActionForm>
        </div>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          Coming back early takes effect tomorrow.
        </span>
      </section>
    </>
  );
}
