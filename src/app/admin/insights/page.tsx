import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can } from "@/server/admin";
import {
  checkinsPerDay,
  checkinsTrendCaption,
  topStats,
  passRateByType,
  worstTypeCallout,
  abandonmentByType,
  groupsSummary,
} from "@/server/insights";
import { TimeChart } from "../../charts";
import { TypeBreakdown, AbandonmentList, GroupsSummaryRows } from "./charts";

const DAYS = 30;

export default async function Insights() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await can(user.id, "insights.view"))) redirect("/admin");

  const [stats, checkins, rates, abandonment, groupStats] = await Promise.all([
    topStats(),
    checkinsPerDay(DAYS),
    passRateByType(),
    abandonmentByType(),
    groupsSummary(),
  ]);

  const trendCaption = checkinsTrendCaption(checkins);
  const callout = worstTypeCallout(rates, abandonment);

  return (
    <>
      <section className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="CHECKED IN TODAY" value={stats.checkedInToday} />
        <Stat label="OF ALL USERS" value={`${stats.pctOfApproved}%`} />
        <Stat label="SILENT 7 DAYS" value={stats.silent7Days} tone="penalty" />
      </section>

      <section className="mb-8">
        <TimeChart
          title="CHECK-INS A DAY, 30 DAYS"
          data={checkins}
          kind="bar"
          fmt={(v) => String(v)}
        />
        <p className="mt-1 text-[11.5px] text-muted">{trendCaption}</p>
      </section>

      <TypeBreakdown title="WHAT PEOPLE ACTUALLY HOLD" rates={rates} caption={callout} />

      <AbandonmentList title="ABANDONED WITHIN 14 DAYS" rows={abandonment.slice(0, 4)} />

      <GroupsSummaryRows title="GROUPS" stats={groupStats} />

      <div className="border-l-[3px] border-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
        Everything here is counted, never read. No screen in admin shows what a check-in
        contained or what a photo is of.
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "penalty";
}) {
  return (
    <div className="border border-rule p-3">
      <div className={"text-[19px] font-semibold leading-none " + (tone === "penalty" ? "text-penalty" : "")}>
        {value}
      </div>
      <div className="mt-[5px] text-[9.5px] leading-[1.4] tracking-[0.08em] text-muted">{label}</div>
    </div>
  );
}
