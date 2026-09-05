import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser } from "@/lib/session";
import { groupHeader, weekStats } from "@/server/group-view";
import { ActivityIcon } from "../../../activity-icon";
import { BackLink } from "@/app/back-link";

// Four questions a group actually asks: how did we do this week, which days
// were bad, who is carrying it, and what is everyone failing at. Counted from
// outcomes, never read from anyone's check-in.
export default async function GroupStats({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [header, week] = await Promise.all([
    groupHeader(groupId, user.id),
    weekStats(groupId, user.id),
  ]);
  if (!header) redirect("/groups");

  const peak = Math.max(1, ...week.byDay.map((d) => d.of));
  const worst = [...week.byDay].sort(
    (a, b) => a.done / (a.of || 1) - b.done / (b.of || 1),
  )[0];
  const hardest = [...week.byType].sort((a, b) => a.percent - b.percent)[0];

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px] pt-5">
        <div className="flex items-center gap-[9px]">
          <BackLink fallback={`/group/${groupId}`} className="text-[14px] text-muted" />
          <span className="text-[14px] font-semibold tracking-[0.14em]">GROUP STATS</span>
        </div>
        <span className="text-[11px] text-muted">{header.name}</span>
      </header>

      <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
        {week.of === 0 ? (
          <p className="text-[12.5px] leading-[1.6] text-muted">
            Nothing has been scored here this week. Numbers appear once members
            share an activity and their first period closes.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-[6px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">THIS WEEK</span>
              <div className="flex items-baseline gap-[10px]">
                <span className="text-[38px] font-semibold leading-none tabular-nums">
                  {week.done}
                </span>
                <span className="text-[15px] text-muted">of {week.of} done</span>
              </div>
              <span className="text-[11.5px] leading-[1.55] text-muted">
                Every shared activity, every member, counted across the week.
              </span>
            </section>

            <section className="flex flex-col gap-[10px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">DAY BY DAY</span>
              <div className="flex gap-[5px]">
                {week.byDay.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-[6px]">
                    <div className="flex h-[44px] w-full flex-col justify-end bg-rule">
                      <div
                        className="w-full bg-fg"
                        style={{ height: `${(d.done / peak) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted">{d.done}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-[5px]">
                {week.byDay.map((d) => (
                  <span key={d.day} className="flex-1 text-center text-[10px] text-muted">
                    {DateTime.fromISO(d.day).toFormat("ccccc")}
                  </span>
                ))}
              </div>
              {worst ? (
                <span className="text-[11.5px] leading-[1.55] text-muted">
                  Out of {peak} a day. {DateTime.fromISO(worst.day).toFormat("cccc")} was
                  the worst day for everyone.
                </span>
              ) : null}
            </section>

            <section className="flex flex-col gap-[10px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">
                MEMBERS THIS WEEK
              </span>
              <div className="flex flex-col">
                {week.byMember.map((m) => (
                  <div key={m.name} className="flex items-center gap-[11px] border-b border-rule py-[11px]">
                    <div className="flex flex-1 flex-col gap-[6px]">
                      <div className="flex items-center justify-between gap-[9px]">
                        <span className="text-[13px]">{m.name}</span>
                        <span className="text-[11.5px] tabular-nums text-muted">
                          {m.done} of {m.of}
                        </span>
                      </div>
                      <div className="h-[3px] bg-rule">
                        <div
                          className="h-[3px] bg-fg"
                          style={{ width: `${(m.done / (m.of || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-[10px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">BY ACTIVITY</span>
              <div className="flex flex-col">
                {week.byType.map((t) => (
                  <div key={t.typeKey} className="flex items-center gap-[11px] border-b border-rule py-[11px]">
                    <span className="flex flex-none text-muted">
                      <ActivityIcon name={t.icon} size={17} />
                    </span>
                    <div className="flex flex-1 flex-col gap-[6px]">
                      <div className="flex items-center justify-between gap-[9px]">
                        <span className="text-[13px]">{t.name}</span>
                        <span className="text-[11.5px] tabular-nums text-muted">
                          {t.percent}%
                        </span>
                      </div>
                      <div className="h-[3px] bg-rule">
                        <div className="h-[3px] bg-fg" style={{ width: `${t.percent}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {hardest ? (
                <span className="text-[11.5px] leading-[1.55] text-muted">
                  {hardest.name} is the one this group holds least.
                </span>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
