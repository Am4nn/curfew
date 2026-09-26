import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  getActivityType,
  displayNameOf,
  measureOf,
  isConditionKey,
  rankFor,
  isImmaculate,
  type ScheduleConfig,
} from "@/domain";
import { listUserActivities } from "@/server/activities";
import { RetireCondition } from "./retire-condition";
import { standingFor } from "@/server/standing";
import { globalScore } from "@/server/scoring";
import { cleanRunIn } from "@/server/clean-run";
import { QuorumMark } from "../mark";
import { ActivityIcon, DeadFlame, Established, Flame } from "../activity-icon";
import { RankIcon, rankText } from "../rank-icon";

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

  const [mine, score, cleanDays] = await Promise.all([
    listUserActivities(user.id),
    globalScore(user.id),
    cleanRunIn(user.id, null),
  ]);
  const tracked = mine.filter((a) => a.enabled);
  const rank = rankFor(score);
  const colour = rankText(score, cleanDays);
  const title = isImmaculate(score, cleanDays) ? "IMMACULATE" : rank.name;

  const rows = await Promise.all(
    tracked.map(async (a) => ({
      typeKey: a.typeKey,
      type: getActivityType(a.typeKey),
      // The label, for a condition somebody wrote (1.19).
      name: displayNameOf(getActivityType(a.typeKey), a.config),
      written: isConditionKey(a.typeKey),
      // 1.49. This list draws whichever number the activity carries, the same
      // as Home and the group hub. It does not decide.
      measure: measureOf(getActivityType(a.typeKey), a.config),
      established: (await standingFor(user.id, a.typeKey))?.consistency ?? null,
      streak: (await standingFor(user.id, a.typeKey))?.streak ?? 0,
      grey: (await standingFor(user.id, a.typeKey))?.grey ?? false,
      summary: summarise(a.typeKey, a.schedule, a.config),
    })),
  );

  return (
    <main className="min-h-dvh px-5 pb-nav pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <QuorumMark size={15} />
          <h1 className="text-base font-semibold tracking-label">ACTIVITIES</h1>
        </header>

        {/* The global score. Its owner sees it and nobody else ever does. */}
        <Link href="/ranks" className="flex items-center gap-[13px] border border-rule p-3.5">
          <span className={"flex flex-none " + colour}>
            <RankIcon score={score} cleanDays={cleanDays} size={30} />
          </span>
          <div className="flex flex-1 flex-col gap-[3px]">
            <div className="flex items-baseline gap-[9px]">
              <span className={"text-xl font-semibold tabular-nums " + colour}>
                {Math.round(score)}
              </span>
              <span className={"text-micro tracking-caps " + colour}>
                {title}
              </span>
            </div>
            <span className="text-micro leading-relaxed text-muted">
              Your record across everything you track, groups or not. Only you see
              this.
            </span>
          </div>
        </Link>

        {rows.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <span className="text-micro tracking-label text-muted">YOURS</span>
            <div className="flex flex-col">
              {/* The row is a div with a Link inside it rather than a Link
                  with everything inside that, because a condition somebody
                  wrote carries its own control and a button inside a link is
                  two interactive elements in one: Tab reaches one of them and
                  a screen reader reads the pair as a single confused thing. */}
              {rows.map((row) => (
                <div
                  key={row.typeKey}
                  className="flex items-center gap-3 border-b border-rule"
                >
                <Link
                  href={`/activities/${row.typeKey}`}
                  className="flex min-w-0 flex-1 items-center gap-3 py-[13px]"
                >
                  <span className="flex flex-none">
                    <ActivityIcon name={row.type.icon} size={20} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div className="flex items-center gap-[9px]">
                      <span className="text-base">{row.name}</span>
                      {/* 1.49, and grey first among the streak branches for
                          the same reason as on Home: a run that came short
                          holds its number, so a positive count is not enough
                          to earn a live flame. */}
                      {row.measure === "consistency" ? (
                        <Established established={row.established} />
                      ) : row.grey ? (
                        <span className="flex items-center gap-1">
                          <DeadFlame size={13} />
                          <span className="text-xs leading-none text-muted tabular-nums">
                            {row.streak}
                          </span>
                        </span>
                      ) : row.streak > 0 ? (
                        <span className="flex items-center gap-1">
                          <Flame size={13} />
                          <span className="bg-gradient-to-r from-flame-from via-flame to-flame-to bg-clip-text text-xs font-medium leading-none text-transparent tabular-nums">
                            {row.streak}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <span className="truncate text-2xs text-muted">{row.summary}</span>
                  </div>
                  <span className="flex-none text-sm text-muted">&rsaquo;</span>
                </Link>
                {/* A condition somebody wrote is the one thing here that can
                    be put away rather than only switched off: its label stops
                    being offered, and its history stays (1.19). */}
                {row.written ? (
                  <RetireCondition typeKey={row.typeKey} label={row.name} />
                ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            You are not tracking anything yet.
          </p>
        )}

        <Link
          href="/activities/add"
          className="flex h-11 w-full items-center justify-center border border-fg bg-fg text-base font-semibold text-bg"
        >
          + Add activity
        </Link>
      </div>
    </main>
  );
}
