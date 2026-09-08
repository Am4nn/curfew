import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser } from "@/lib/session";
import { groupEvidence, type EvidenceItem } from "@/server/group-view";
import { readUrl } from "@/server/evidence";
import { resolveUserTimezone, userDay } from "@/server/config";
import { EvidenceGrid } from "./evidence-grid";

// The reason photos exist in a group. A dated log, newest first, and nothing
// else: no reactions, no comments, no feed mechanics.
//
// Today and yesterday load immediately; older days come on demand, so the tab
// never pulls the whole retention window.
/** One page of the log. */
const PAGE = 20;

export default async function EvidenceTab({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { groupId } = await params;
  // One number, clamped, so a hand-edited query string cannot ask for the
  // whole retention window in one page.
  const asked = Number((await searchParams).show);
  const limit = Number.isFinite(asked)
    ? Math.min(Math.max(Math.trunc(asked), PAGE), PAGE * 20)
    : PAGE;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  // The app clock and the viewer's own day, so a preview scrubbed to another
  // date labels the log's rows against the day it is pretending to be.
  const today = await userDay(user.id);
  const timezone = await resolveUserTimezone(user.id, today);
  const yesterday = DateTime.fromISO(today, { zone: "utc" })
    .minus({ days: 1 })
    .toFormat("yyyy-MM-dd");

  // Newest first, a page at a time. There is no `since` window any more: it
  // meant the first page could only ever be today and yesterday, so a quiet
  // group showed an empty tab with a Load older button under it.
  const items = await groupEvidence(groupId, user.id, { limit: limit + 1 });
  const more = items.length > limit;
  const page = more ? items.slice(0, limit) : items;

  // A presign failure (a stale key, a storage outage) must not take down the
  // whole tab over one bad photo; drop it rather than crash the page.
  const withUrl: (EvidenceItem & { url: string })[] = [];
  for (const item of page) {
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
            {/* The times are formatted here, in the viewer's own zone, on the
                server: a client component would spell them from the device
                clock (invariant 8). */}
            <EvidenceGrid
              groupId={groupId}
              items={byDay.get(day)!.map((item) => ({
                id: item.id,
                url: item.url,
                who: item.who,
                typeName: item.typeName,
                icon: item.icon,
                timeLabel: DateTime.fromISO(item.at)
                  .setZone(timezone)
                  .toFormat("h:mm a"),
                mine: item.mine,
              }))}
            />
          </section>
        ))
      )}

      {more ? (
        <a
          href={`/group/${groupId}/evidence?show=${limit + PAGE}`}
          className="flex h-11 w-full items-center justify-center border border-rule text-[14px] active:opacity-70"
        >
          Load older
        </a>
      ) : null}
    </div>
  );
}
