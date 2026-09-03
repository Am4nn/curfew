import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType, rankFor, type ScheduleConfig } from "@/domain";
import { listUserActivities } from "@/server/activities";
import { standingFor } from "@/server/standing";
import { globalScore } from "@/server/scoring";
import { QuorumMark } from "../mark";
import { ActivityIcon, Flame } from "../activity-icon";
import { RankIcon, RANK_TEXT } from "../rank-icon";

/** "Daily, 3 windows, photo on confirm", from the type's own declaration. */
function summarise(typeKey: string, schedule: ScheduleConfig, config: unknown): string {
  const type = getActivityType(typeKey);
  const parts: string[] = [];

  if (schedule.schedule.kind === "minimum") {
    parts.push(`Any ${schedule.schedule.perWeek} per week`);
  } else {
    const days = schedule.schedule.days;
    if (days.length === 7) parts.push("Daily");
    else if (days.length === 5 && days.every((d) => d <= 5)) parts.push("Mon to Fri");
    else parts.push(`${days.length} days a week`);
  }

  const steps = type.steps(config, "2026-01-01");
  if (steps.length > 1) parts.push(`${steps.length} windows`);

  if (type.evidence.level === "required") {
    parts.push(type.evidence.steps?.length ? `photo on ${type.evidence.steps[0]}` : "photo");
  }

  return parts.join(" · ");
}

export default async function ActivitiesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [mine, score] = await Promise.all([
    listUserActivities(user.id),
    globalScore(user.id),
  ]);
  const tracked = mine.filter((a) => a.enabled);
  const rank = rankFor(score);

  const rows = await Promise.all(
    tracked.map(async (a) => ({
      typeKey: a.typeKey,
      type: getActivityType(a.typeKey),
      streak: (await standingFor(user.id, a.typeKey))?.streak ?? 0,
      summary: summarise(a.typeKey, a.schedule, a.config),
    })),
  );

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <QuorumMark size={15} />
          <h1 className="text-[14px] font-semibold tracking-[0.16em]">ACTIVITIES</h1>
        </header>

        {/* The global score. Its owner sees it and nobody else ever does. */}
        <Link href="/ranks" className="flex items-center gap-[13px] border border-rule p-[14px]">
          <span className={"flex flex-none " + RANK_TEXT[rank.key]}>
            <RankIcon score={score} size={30} />
          </span>
          <div className="flex flex-1 flex-col gap-[3px]">
            <div className="flex items-baseline gap-[9px]">
              <span className={"text-[20px] font-semibold tabular-nums " + RANK_TEXT[rank.key]}>
                {Math.round(score)}
              </span>
              <span className={"text-[10.5px] tracking-[0.14em] " + RANK_TEXT[rank.key]}>
                {rank.name}
              </span>
            </div>
            <span className="text-[10.5px] leading-[1.5] text-muted">
              Your record across everything you track, groups or not. Only you see
              this.
            </span>
          </div>
        </Link>

        {rows.length > 0 ? (
          <section className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">YOURS</span>
            <div className="flex flex-col">
              {rows.map((row) => (
                <Link
                  key={row.typeKey}
                  href={`/activities/${row.typeKey}`}
                  className="flex items-center gap-3 border-b border-rule py-[13px]"
                >
                  <span className="flex flex-none">
                    <ActivityIcon name={row.type.icon} size={20} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div className="flex items-center gap-[9px]">
                      <span className="text-[14px]">{row.type.name}</span>
                      {row.streak > 0 ? (
                        <span className="flex items-center gap-1">
                          <Flame size={13} />
                          <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-[12px] font-medium leading-none text-transparent tabular-nums">
                            {row.streak}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <span className="truncate text-[11.5px] text-muted">{row.summary}</span>
                  </div>
                  <span className="flex-none text-[13px] text-muted">&rsaquo;</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-[13px] leading-[1.6] text-muted">
            You are not tracking anything yet.
          </p>
        )}

        <Link
          href="/activities/add"
          className="flex h-11 w-full items-center justify-center border border-fg bg-fg text-[14px] font-semibold text-bg"
        >
          + Add activity
        </Link>
      </div>
    </main>
  );
}
