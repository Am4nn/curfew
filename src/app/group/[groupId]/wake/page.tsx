import { redirect, notFound } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { getWakeChart } from "@/server/chart";
import { WakePlot } from "../../../wake-plot";

export default async function GroupWakeTab({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  try {
    await assertMember(groupId, user.id);
  } catch {
    notFound();
  }

  const chart = await getWakeChart(groupId, 30);

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.14em] text-muted">WAKE TIMES</span>
        <span className="text-[11px] text-muted">last 30 days</span>
      </div>
      {chart.hasData ? (
        <WakePlot chart={chart} />
      ) : (
        <p className="text-[13px] text-muted">No wake check-ins in the last {chart.days} days.</p>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        Everyone&apos;s actual wake time each night. Descriptive only, this never ranks anyone.
      </p>
    </>
  );
}
