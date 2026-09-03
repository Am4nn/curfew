import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { overviewFor, chartFor } from "@/server/stats";
import { QuorumMark } from "../mark";
import { ActivityIcon } from "../activity-icon";
import { ActivityChartView } from "./charts";

// Stats: the month at a glance, then one activity at a time. Everything is
// counted from scored periods, which come from check-ins alone (invariant 2).
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>;
}) {
  const { a } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  if (a) {
    const chart = await chartFor(user.id, a);
    if (!chart) redirect("/stats");
    return (
      <main className="min-h-dvh px-5 pb-24 pt-5">
        <div className="mx-auto flex max-w-[560px] flex-col gap-6">
          <header className="-mx-5 flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px]">
            <Link href="/stats" className="flex items-center gap-[9px]">
              <span className="text-[14px] text-muted">&lsaquo;</span>
              <span className="text-[14px] font-semibold tracking-[0.14em]">
                {chart.name.toUpperCase()}
              </span>
            </Link>
            <span className="text-muted">
              <ActivityIcon name={chart.icon} />
            </span>
          </header>
          <ActivityChartView chart={chart} />
        </div>
      </main>
    );
  }

  const stats = await overviewFor(user.id);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <QuorumMark size={15} />
          <h1 className="text-[14px] font-semibold tracking-[0.16em]">STATS</h1>
        </header>

        {stats.byActivity.length === 0 ? (
          <p className="text-[13px] leading-[1.6] text-muted">
            Nothing scored yet. Numbers appear once your first period closes.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-[6px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">
                PERFECT DAYS THIS MONTH
              </span>
              <div className="flex items-baseline gap-[10px]">
                <span className="text-[38px] font-semibold leading-none tabular-nums">
                  {stats.perfectDays}
                </span>
                <span className="text-[15px] text-muted">of {stats.daysInMonth}</span>
              </div>
              <span className="text-[11.5px] leading-[1.55] text-muted">
                A perfect day is every activity that was scheduled, done.
              </span>
            </section>

            <div className="flex gap-[10px]">
              <Tile value={`${stats.passRate}%`} label="PERIODS PASSED, 30 DAYS" />
              <Tile
                value={String(stats.longestStreak)}
                label="LONGEST RUNNING STREAK"
                flame
              />
              <Tile value={String(stats.graceLeft)} label="GRACE LEFT THIS MONTH" />
            </div>

            <section className="flex flex-col gap-[11px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">
                EVERY DAY, HOW MUCH OF IT
              </span>
              <div className="flex flex-col gap-[3px]">
                {stats.heatmap.map((week, w) => (
                  <div key={w} className="flex gap-[3px]">
                    {week.map((v, d) => (
                      <div
                        key={d}
                        className="aspect-square flex-1 border border-rule"
                        style={
                          v < 0
                            ? { opacity: 0.25 }
                            : { backgroundColor: "var(--fg)", opacity: 0.12 + v * 0.88 }
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-[10px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">
                BY ACTIVITY, LAST 30 DAYS
              </span>
              <div className="flex flex-col">
                {stats.byActivity.map((row) => (
                  <Link
                    key={row.typeKey}
                    href={`/stats?a=${row.typeKey}`}
                    className="flex items-center gap-[11px] border-b border-rule py-[11px]"
                  >
                    <span className="flex flex-none text-muted">
                      <ActivityIcon name={row.icon} size={17} />
                    </span>
                    <div className="flex flex-1 flex-col gap-[6px]">
                      <div className="flex items-center justify-between gap-[9px]">
                        <span className="text-[13px]">{row.name}</span>
                        <span className="text-[11.5px] tabular-nums text-muted">
                          {row.percent}%
                        </span>
                      </div>
                      <div className="h-[3px] bg-rule">
                        <div className="h-[3px] bg-fg" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Tile({ value, label, flame }: { value: string; label: string; flame?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-1 border border-rule p-3">
      <span
        className={
          "text-[19px] tabular-nums " +
          (flame ? "bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-transparent" : "")
        }
      >
        {value}
      </span>
      <span className="text-[10px] leading-[1.35] text-muted">{label}</span>
    </div>
  );
}
