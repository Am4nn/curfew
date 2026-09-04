import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { overviewFor, chartFor } from "@/server/stats";
import { ownPhotos } from "@/server/own-photos";
import { PhotoGrid } from "../photo-tile";
import { QuorumMark } from "../mark";
import { ActivityIcon, Flame } from "../activity-icon";
import { ActivityChartView } from "./charts";
import { BackLink } from "@/app/back-link";

// The heatmap ramp, none to all, defined once in globals.css so light mode
// gets its own five steps. Tailwind can't emit a class for a value picked at
// runtime, so these are read as CSS variables and set inline.
const HEAT = [
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
];

// A day's completion, 0..1, into one of the five steps. Anything above zero
// lands at least on step 2, so a day with something done never reads as empty.
function heatStep(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 4;
  return 1 + Math.min(2, Math.floor(v * 3));
}

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
    // The photographs this activity asked for, beside the numbers they back up.
    const photos = await ownPhotos(user.id, { typeKey: a, limit: 6 });
    return (
      <main className="min-h-dvh px-5 pb-24 pt-5">
        <div className="mx-auto flex max-w-[560px] flex-col gap-[22px]">
          <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
            <BackLink fallback="/stats" className="text-[14px] text-muted" />
            <QuorumMark size={15} />
            <h1 className="text-[14px] font-semibold tracking-[0.16em]">STATS</h1>
          </header>

          {/* The mock's picker, and a real one: a disclosure rather than a box
              with a chevron that does nothing. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-[10px] border border-rule px-3 py-[11px] [&::-webkit-details-marker]:hidden">
              <span className="flex flex-none">
                <ActivityIcon name={chart.icon} size={17} />
              </span>
              <span className="flex-1 text-[14px]">{chart.name}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="flex-none text-muted transition-transform group-open:rotate-180"
                aria-hidden="true"
              >
                <path d="M5 9l7 7 7-7" />
              </svg>
            </summary>
            <div className="flex flex-col border-x border-b border-rule">
              {chart.others.map((o) => (
                <Link
                  key={o.typeKey}
                  href={`/stats?a=${o.typeKey}`}
                  className="flex items-center gap-[10px] border-t border-rule px-3 py-[11px] first:border-t-0"
                >
                  <span className="flex flex-none text-muted">
                    <ActivityIcon name={o.icon} size={17} />
                  </span>
                  <span className="flex-1 text-[14px]">{o.name}</span>
                </Link>
              ))}
            </div>
          </details>

          <ActivityChartView chart={chart} />

          {photos.length > 0 ? (
            <section className="flex flex-col gap-[11px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] tracking-[0.16em] text-muted">
                  YOUR PHOTOS
                </span>
                <Link href="/settings/photos" className="text-[11px] text-muted">
                  All &rsaquo;
                </Link>
              </div>
              <PhotoGrid photos={photos} showType={false} />
            </section>
          ) : null}
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
              <div className="flex flex-col gap-[9px]">
                {/* A week is a column, a day a row, as in the mock: eight weeks
                    read left to right the way a calendar does. */}
                <div className="flex gap-[3px]">
                  {stats.heatmap.map((week, w) => (
                    <div key={w} className="flex flex-1 flex-col gap-[3px]">
                      {week.map((v, d) => (
                        <div
                          key={d}
                          className={
                            "aspect-square w-full " + (v < 0 ? "border border-rule" : "")
                          }
                          style={v < 0 ? undefined : { background: HEAT[heatStep(v)] }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-[7px]">
                  <span className="text-[10px] text-muted">none</span>
                  {HEAT.map((c, i) => (
                    <div key={i} className="h-[8px] w-[14px]" style={{ background: c }} />
                  ))}
                  <span className="text-[10px] text-muted">all</span>
                  <span className="ml-auto text-[10px] text-muted">
                    {stats.heatmap.length} weeks
                  </span>
                </div>
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
                        <span className="flex items-center gap-[9px]">
                          <span className="text-[11.5px] tabular-nums text-muted">
                            {row.percent}%
                          </span>
                          {row.streak > 0 ? (
                            <span className="flex items-center gap-1">
                              <Flame size={13} />
                              <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-[12px] font-medium leading-none text-transparent tabular-nums">
                                {row.streak}
                              </span>
                            </span>
                          ) : null}
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
