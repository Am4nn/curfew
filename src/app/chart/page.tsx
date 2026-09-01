import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getPersonalStats } from "@/server/stats";
import { getPersonalStreak } from "@/server/streak";
import { TimeChart } from "../charts";

function hhmm(minutes: number): string {
  const m = Math.max(0, minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default async function Stats() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [stats, streak] = await Promise.all([
    getPersonalStats(user.id, 30),
    getPersonalStreak(user.id),
  ]);

  const noData = !stats.hasWake && !stats.hasScores && stats.monthPassRate === null;

  return (
    <main className="min-h-dvh px-5 pb-24 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">YOUR STATS</h1>
        </header>

        {noData ? (
          <p className="text-[13px] text-muted">
            Nothing to show yet. Stats appear once your nights are scored.
          </p>
        ) : (
          <>
            <p className="mb-7 text-[15px] leading-relaxed">
              {stats.monthPassRate !== null ? (
                <>
                  You hit your window <span className="text-pass">{stats.monthPassRate}%</span> of nights this month.{" "}
                </>
              ) : null}
              Current streak <span className="text-fg">{streak.current}</span>.
            </p>

            {stats.hasWake ? (
              <TimeChart
                title="WAKE TIME"
                suffix="7-day average"
                data={stats.wakeRolling}
                kind="line"
                color="var(--accent)"
                baseZero={false}
                fmt={(v) => hhmm(v)}
              />
            ) : null}

            {stats.hasScores ? (
              <TimeChart
                title="PASS RATE BY DAY"
                suffix="last 12 weeks"
                data={stats.weekdayPass}
                kind="bar"
                color="var(--pass)"
                fmt={(v) => `${v}%`}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
