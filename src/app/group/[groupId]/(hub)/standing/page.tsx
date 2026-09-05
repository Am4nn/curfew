import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { rankFor, nextRank, formatMoney, isImmaculate, daysToImmaculate } from "@/domain";
import { groupHeader, standingIn, groupBalances } from "@/server/group-view";
import { RankIcon, RANK_TEXT, RANK_BG, rankText } from "../../../../rank-icon";
import { CleanBar } from "@/app/clean-bar";

const REASON: Record<string, string> = {
  clean: "All shared activities done",
  incomplete: "Missed a shared activity",
  drift: "Settling to a lower ceiling",
  idle: "Nothing scheduled for a week",
  neutral: "Nothing due",
};

export default async function StandingTab({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [header, standing] = await Promise.all([
    groupHeader(groupId, user.id),
    standingIn(groupId, user.id),
  ]);
  if (!header) redirect("/groups");

  const { grace, cleanDays } = standing;
  const rank = rankFor(standing.score);
  const next = nextRank(standing.score);
  const held = isImmaculate(standing.score, cleanDays);
  const colour = rankText(standing.score, cleanDays);
  const fill = RANK_BG[rank.key];
  const owed = header.moneyOn ? await groupBalances(groupId, user.id) : [];

  const pct = Math.min(100, (standing.score / 1000) * 100);
  const ceilingPct = Math.min(100, (standing.ceiling / 1000) * 100);

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
      {/* In grace this comes first, because it is the answer to every question
          the rest of the screen raises. */}
      {grace ? (
        <div className="flex flex-col gap-2 border border-accent p-[14px]">
          <div className="flex items-baseline justify-between gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-accent">GRACE PERIOD</span>
            <span className="text-[12px] text-accent">
              {grace.hoursLeft} {grace.hoursLeft === 1 ? "hour" : "hours"} left
            </span>
          </div>
          <span className="text-[13px] leading-[1.55]">
            {header.name} starts counting you at midnight.
          </span>
          <span className="text-[11.5px] leading-[1.55] text-muted">
            Nothing today can move your score here or cost you money. The group
            can see you are in grace.
          </span>
        </div>
      ) : null}

      <div className={"flex items-center gap-[15px]" + (grace ? " opacity-55" : "")}>
        <span className={"flex flex-none " + colour}>
          <RankIcon score={standing.score} cleanDays={cleanDays} size={42} />
        </span>
        <div className="flex flex-col gap-[5px]">
          <span className={"text-[32px] font-semibold leading-none " + colour}>
            {Math.round(standing.score)}
          </span>
          <span className="text-[10.5px] tracking-[0.14em] text-muted">
            {grace
              ? "STARTS TOMORROW"
              : held
                ? "IMMACULATE"
                : next
                  ? `${next.away} TO ${next.rank.name}`
                  : rank.name}
          </span>
        </div>
        <Link
          href="/ranks"
          className="ml-auto text-[11px] text-accent"
        >
          How it works &rsaquo;
        </Link>
      </div>

      {/* The clean run, once the score is high enough for it to be the thing
          standing between here and the title. Below UNBROKEN the score is what
          needs moving, and a run of clean days is how it moves anyway. */}
      {!grace && held ? (
        <div className="flex flex-col gap-[5px] border border-gold p-[13px]">
          <span className="text-[12.5px] text-gold">
            {cleanDays} days, nothing missed.
          </span>
          <span className="text-[11.5px] leading-[1.55] text-muted">
            One missed day ends the run and the title. The score stays.
          </span>
        </div>
      ) : null}

      {!grace && !held && rank.key === "unbroken" ? (
        <div className="flex flex-col gap-[11px] border border-rule p-[13px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">
            TOWARD IMMACULATE
          </span>
          <CleanBar cleanDays={cleanDays} />
          <span className="text-[11.5px] leading-[1.55] text-muted">
            UNBROKEN already. {daysToImmaculate(cleanDays)} more days with
            nothing missed.
          </span>
        </div>
      ) : null}

      {grace ? (
        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">STILL COUNTING</span>
          {[
            ["Your streaks", "Yours, not the group's. Unaffected."],
            ["Your own record", "The score only you can see."],
          ].map(([what, why]) => (
            <div
              key={what}
              className="flex items-center justify-between gap-[10px] border-b border-rule py-3"
            >
              <div className="flex flex-col gap-[2px]">
                <span className="text-[12.5px]">{what}</span>
                <span className="text-[10.5px] text-muted">{why}</span>
              </div>
              <span className="text-[13px] text-pass">Running</span>
            </div>
          ))}
          <span className="text-[11.5px] leading-[1.55] text-muted">
            One day, each time you join. Anything you owed here comes back with
            you.
          </span>
        </section>
      ) : null}

      {/* A group with money off never mentions it at all (decision 43). */}
      {header.moneyOn && !grace ? (
        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">MONEY</span>
          {owed.length === 0 ? (
            <p className="text-[12px] leading-[1.6] text-muted">Nothing owed either way.</p>
          ) : (
            owed.map((b) => (
              <div
                key={b.userId}
                className="flex items-center justify-between gap-3 border border-rule p-[13px]"
              >
                <span className="text-[13px]">
                  {b.netOwed > 0 ? `You owe ${b.name}` : `${b.name} owes you`}
                </span>
                <span className="flex items-center gap-[10px]">
                  <span
                    className={
                      "text-[15px] tabular-nums " +
                      (b.netOwed > 0 ? "text-penalty" : "text-pass")
                    }
                  >
                    {formatMoney(Math.abs(b.netOwed), b.currency)}
                  </span>
                  {b.netOwed > 0 ? (
                    <Link
                      href={`/group/${groupId}/ledger`}
                      className="border border-rule px-3 py-[7px] text-[12.5px]"
                    >
                      Settle
                    </Link>
                  ) : null}
                </span>
              </div>
            ))
          )}
          <Link
            href={`/group/${groupId}/ledger`}
            className="flex items-center justify-between gap-[10px] border-t border-rule py-3"
          >
            <span className="text-[12.5px]">Full ledger</span>
            <span className="text-[11px] text-muted">every fine and settlement &rsaquo;</span>
          </Link>
        </section>
      ) : grace ? null : (
        <div className="text-[11.5px] leading-[1.55] text-muted">
          A miss costs your streak and your standing here.
        </div>
      )}

      {/* Neither of these exists yet in grace: no ceiling has been resolved and
          no day has been scored. */}
      {grace ? null : (
      <section className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.16em] text-muted">CEILING</span>
        <div className="relative h-[6px] bg-rule">
          <div
            className={"absolute inset-y-0 left-0 " + fill}
            style={{ width: `${pct}%` }}
          />
          {standing.ceiling < 1000 ? (
            <div
              className="absolute -top-1 -bottom-1 w-px bg-fg"
              style={{ left: `${ceilingPct}%` }}
            />
          ) : null}
        </div>
        <div className="flex justify-between text-[10px] text-muted">
          <span>0</span>
          <span>ceiling {Math.round(standing.ceiling)}</span>
          <span>1000</span>
        </div>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          {standing.breadth.accepted === 0
            ? "This group accepts nothing yet, so nothing caps you."
            : standing.breadth.shared === standing.breadth.accepted
              ? "You share everything this group accepts, so nothing caps you."
              : `You share ${standing.breadth.shared} of the ${standing.breadth.accepted} activities this group accepts. Sharing more raises the ceiling.`}
        </span>
      </section>
      )}

      {grace ? null : (
      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">LAST 7 DAYS</span>
        {standing.movements.length === 0 ? (
          <p className="text-[12px] text-muted">Nothing scored yet.</p>
        ) : (
          <div className="flex flex-col">
            {standing.movements.map((m) => (
              <div
                key={m.day}
                className="flex items-center justify-between gap-[10px] border-b border-rule py-[11px]"
              >
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[12.5px]">{REASON[m.reason] ?? m.reason}</span>
                  <span className="text-[10px] text-muted">{m.day}</span>
                </div>
                <span
                  className={
                    "text-[13px] tabular-nums " +
                    (m.delta > 0 ? "text-pass" : m.delta < 0 ? "text-penalty" : "text-muted")
                  }
                >
                  {m.delta > 0 ? "+" : ""}
                  {Math.round(m.delta)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
