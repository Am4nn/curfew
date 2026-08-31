import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can } from "@/server/admin";
import {
  checkinsPerDay,
  passRateOverTime,
  passRateByWeekday,
  finesPerDay,
  wakeTrend,
  outstandingBalances,
} from "@/server/insights";
import { formatMoney } from "@/domain";
import { TimeChart } from "../../charts";
import { BalanceBars } from "./charts";

const DAYS = 30;

function hhmm(minutes: number): string {
  const m = Math.max(0, minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default async function Insights() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await can(user.id, "insights.view"))) redirect("/admin");

  const [checkins, passRate, weekday, fines, wake, balances] = await Promise.all([
    checkinsPerDay(DAYS),
    passRateOverTime(DAYS),
    passRateByWeekday(84),
    finesPerDay(DAYS),
    wakeTrend(DAYS),
    outstandingBalances(),
  ]);

  return (
    <>
      <TimeChart
        title="CHECK-INS PER DAY"
        suffix={`last ${DAYS} days`}
        data={checkins}
        kind="bar"
        fmt={(v) => String(v)}
      />
      <TimeChart
        title="PASS RATE"
        suffix="% of scored periods"
        data={passRate}
        kind="line"
        color="var(--pass)"
        fmt={(v) => `${v}%`}
      />
      <TimeChart
        title="PASS RATE BY DAY"
        suffix="last 12 weeks"
        data={weekday}
        kind="bar"
        color="var(--pass)"
        fmt={(v) => `${v}%`}
      />
      <TimeChart
        title="FINES PER DAY"
        suffix={`last ${DAYS} days`}
        data={fines}
        kind="bar"
        color="var(--penalty)"
        fmt={(v) => formatMoney(v, "INR")}
      />
      <TimeChart
        title="AVERAGE WAKE TIME"
        suffix="across users"
        data={wake}
        kind="line"
        color="var(--accent)"
        baseZero={false}
        fmt={(v) => hhmm(v)}
      />
      <BalanceBars data={balances} fmt={(v, c) => formatMoney(v, c)} />
    </>
  );
}
