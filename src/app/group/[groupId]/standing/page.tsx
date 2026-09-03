import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { rankFor, nextRank, formatMoney } from "@/domain";
import { groupHeader, standingIn, groupBalances } from "@/server/group-view";
import { RankIcon, RANK_TEXT } from "../../../rank-icon";

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

  const rank = rankFor(standing.score);
  const next = nextRank(standing.score);
  const colour = RANK_TEXT[rank.key];
  const owed = header.moneyOn ? await groupBalances(groupId, user.id) : [];

  const pct = Math.min(100, (standing.score / 1000) * 100);
  const ceilingPct = Math.min(100, (standing.ceiling / 1000) * 100);

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
      <div className="flex items-center gap-[15px]">
        <span className={"flex flex-none " + colour}>
          <RankIcon score={standing.score} size={42} />
        </span>
        <div className="flex flex-col gap-[5px]">
          <span className={"text-[32px] font-semibold leading-none " + colour}>
            {Math.round(standing.score)}
          </span>
          <span className="text-[10.5px] tracking-[0.14em] text-muted">
            {next ? `${next.away} TO ${next.rank.name}` : rank.name}
          </span>
        </div>
        <Link
          href="/ranks"
          className="ml-auto text-[11px] text-accent"
        >
          How it works &rsaquo;
        </Link>
      </div>

      {/* A group with money off never mentions it at all (decision 43). */}
      {header.moneyOn ? (
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
                <span
                  className={
                    "text-[15px] tabular-nums " +
                    (b.netOwed > 0 ? "text-penalty" : "text-pass")
                  }
                >
                  {formatMoney(Math.abs(b.netOwed), b.currency)}
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
      ) : (
        <div className="border-l-[3px] border-l-pass bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
          A miss costs your streak and your standing here.
        </div>
      )}

      <section className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.16em] text-muted">CEILING</span>
        <div className="relative h-[6px] bg-rule">
          <div
            className={"absolute inset-y-0 left-0 " + colour.replace("text-", "bg-")}
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
    </div>
  );
}
