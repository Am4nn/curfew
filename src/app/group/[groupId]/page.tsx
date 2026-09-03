import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { rankFor } from "@/domain";
import { acceptedTypes } from "@/server/sharing";
import { groupHeader, memberStandings, standingIn, weekStats } from "@/server/group-view";
import { ActivityIcon } from "../../activity-icon";
import { RankScore, RANK_TEXT } from "../../rank-icon";

export default async function GroupOverview({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [header, accepted, members, standing, week] = await Promise.all([
    groupHeader(groupId, user.id),
    acceptedTypes(groupId),
    memberStandings(groupId, user.id),
    standingIn(groupId, user.id),
    weekStats(groupId, user.id),
  ]);
  if (!header) redirect("/groups");

  const rank = rankFor(standing.score);

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
      {accepted.length > 0 ? (
        <div className="flex flex-wrap gap-[7px]">
          {accepted.map((a) => (
            <span
              key={a.typeKey}
              className="flex items-center gap-[7px] border border-rule bg-surface px-[11px] py-[6px] text-[12px]"
            >
              <ActivityIcon name={a.icon} size={14} />
              {a.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] leading-[1.6] text-muted">
          This group accepts nothing yet.{" "}
          {header.role === "owner"
            ? "Pick its activities under Settings."
            : "The owner has not picked its activities."}
        </p>
      )}

      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">
          MEMBERS &middot; {members.length}
        </span>
        <div className="flex flex-col">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-[11px] border-b border-rule py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex items-baseline gap-[7px]">
                  <span className="text-[14px]">{m.you ? "You" : m.name}</span>
                  {m.you ? <span className="text-[10px] text-muted">you</span> : null}
                </div>
                <span className="truncate text-[11px] text-muted">{m.streaks}</span>
              </div>
              <RankScore score={m.score} />
            </div>
          ))}
        </div>
      </section>

      <Link
        href={`/group/${groupId}/standing`}
        className="flex items-center justify-between gap-3 border border-rule p-[13px]"
      >
        <div className="flex flex-col gap-[3px]">
          <span className="text-[12.5px]">
            You are {Math.round(standing.score)},{" "}
            <span className={"tracking-[0.1em] " + RANK_TEXT[rank.key]}>{rank.name}</span>{" "}
            here
          </span>
          <span className="text-[11px] text-muted">
            {standing.movements[0]
              ? `${standing.movements[0].delta >= 0 ? "+" : ""}${Math.round(standing.movements[0].delta)} today`
              : "nothing scored yet"}
          </span>
        </div>
        <span className="text-[13px] text-muted">&rsaquo;</span>
      </Link>

      <Link
        href={`/group/${groupId}/stats`}
        className="flex items-center justify-between gap-3 border border-rule p-[13px]"
      >
        <div className="flex flex-col gap-[3px]">
          <span className="text-[12.5px]">
            {week.of === 0
              ? "Nothing scored this week yet"
              : `This week the group did ${week.done} of ${week.of}`}
          </span>
          <span className="text-[11px] text-muted">Group stats</span>
        </div>
        <span className="text-[13px] text-muted">&rsaquo;</span>
      </Link>

      <Link
        href={`/group/${groupId}/settings`}
        className="flex h-11 w-full items-center justify-center border border-rule text-[14px]"
      >
        Invite someone
      </Link>
    </div>
  );
}
