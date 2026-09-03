import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser } from "@/lib/session";
import { groupEvidence, type EvidenceItem } from "@/server/group-view";
import { readUrl, RETENTION_DAYS } from "@/server/evidence";
import { resolveUserTimezone } from "@/server/config";
import { ActivityIcon } from "../../../../activity-icon";
import { ReportButton } from "./report-button";

// The reason photos exist in a group. A dated log, newest first, and nothing
// else: no reactions, no comments, no feed mechanics.
//
// Today and yesterday load immediately; older days come on demand, so the tab
// never pulls the whole retention window.
export default async function EvidenceTab({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ older?: string }>;
}) {
  const { groupId } = await params;
  const { older } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const timezone = await resolveUserTimezone(
    user.id,
    new Date().toISOString().slice(0, 10),
  );
  const today = DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
  const yesterday = DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat("yyyy-MM-dd");

  const items = await groupEvidence(groupId, user.id, {
    since: older ? undefined : yesterday,
    limit: older ? 60 : 20,
  });

  // A presign failure (a stale key, a storage outage) must not take down the
  // whole tab over one bad photo; drop it rather than crash the page.
  const withUrl: (EvidenceItem & { url: string })[] = [];
  for (const item of items) {
    try {
      withUrl.push({ ...item, url: readUrl(item.objectKey) });
    } catch {
      // Skip it.
    }
  }

  const byDay = new Map<string, (EvidenceItem & { url: string })[]>();
  for (const item of withUrl) {
    const day = DateTime.fromISO(item.at).setZone(timezone).toFormat("yyyy-MM-dd");
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  const days = [...byDay.keys()].sort().reverse();

  const heading = (day: string) =>
    day === today ? "TODAY" : day === yesterday ? "YESTERDAY" : day;

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
      {days.length === 0 ? (
        <p className="text-[12.5px] leading-[1.6] text-muted">Nothing shared here yet.</p>
      ) : (
        days.map((day) => (
          <section key={day} className="flex flex-col gap-3">
            <span className="text-[10px] tracking-[0.16em] text-muted">
              {heading(day)}
            </span>
            <div className="grid grid-cols-2 gap-3">
              {byDay.get(day)!.map((item) => (
                <div key={item.id} className="flex flex-col gap-[6px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={`${item.who}, ${item.typeName}`}
                    className="aspect-square w-full border border-rule bg-surface object-cover"
                  />
                  <div className="flex items-center justify-between gap-[6px]">
                    <span className="text-[11px]">{item.who}</span>
                    <span className="text-[10px] text-muted">
                      {DateTime.fromISO(item.at).setZone(timezone).toFormat("h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-[5px] text-[10px] text-muted">
                      <ActivityIcon name={item.icon} size={11} />
                      {item.typeName}
                    </span>
                    {item.mine ? null : (
                      <ReportButton
                        evidenceId={item.id}
                        groupId={groupId}
                        who={item.who}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {!older && days.length > 0 ? (
        <a
          href={`/group/${groupId}/evidence?older=1`}
          className="flex h-11 w-full items-center justify-center border border-rule text-[14px]"
        >
          Load older
        </a>
      ) : null}

      <div className="border-l-[3px] border-l-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
        Photos are deleted {RETENTION_DAYS} days after they are taken. Only members you
        shared the activity with can see them.
      </div>
    </div>
  );
}
