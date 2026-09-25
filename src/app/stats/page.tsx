import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { overviewFor, chartFor, AWAY } from "@/server/stats";
import { shortDay } from "@/lib/day-format";
import { ownPhotos } from "@/server/own-photos";
import { PhotoGrid } from "../photo-tile";
import { QuorumMark } from "../mark";
import { ActivityIcon, DeadFlame, Flame } from "../activity-icon";
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
      <main className="min-h-dvh px-5 pb-nav pt-5">
        <div className="mx-auto flex max-w-[560px] flex-col gap-[22px]">
          <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
            <BackLink fallback="/stats" className="text-base text-muted" />
            <QuorumMark size={15} />
            <h1 className="text-base font-semibold tracking-label">STATS</h1>
          </header>

          {/* The mock's picker, and a real one: a disclosure rather than a box
              with a chevron that does nothing. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 border border-rule px-3 py-[11px] [&::-webkit-details-marker]:hidden">
              <span className="flex flex-none">
                <ActivityIcon name={chart.icon} size={17} />
              </span>
              <span className="flex-1 text-base">{chart.name}</span>
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
                  className="flex items-center gap-2.5 border-t border-rule px-3 py-[11px] first:border-t-0"
                >
                  <span className="flex flex-none text-muted">
                    <ActivityIcon name={o.icon} size={17} />
                  </span>
                  <span className="flex-1 text-base">{o.name}</span>
                </Link>
              ))}
            </div>
          </details>

          <ActivityChartView chart={chart} />

          {photos.length > 0 ? (
            <section className="flex flex-col gap-[11px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-micro tracking-label text-muted">
                  YOUR PHOTOS
                </span>
                <Link href="/settings/photos" className="text-2xs text-muted">
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
    <main className="min-h-dvh px-5 pb-nav pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <QuorumMark size={15} />
          <h1 className="text-base font-semibold tracking-label">STATS</h1>
        </header>

        {stats.byActivity.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            Nothing scored yet. Numbers appear once your first period closes.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-1.5">
              <span className="text-micro tracking-label text-muted">
                PERFECT DAYS THIS MONTH
              </span>
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl font-semibold leading-none tabular-nums">
                  {stats.perfectDays}
                </span>
                <span className="text-base text-muted">of {stats.daysInMonth}</span>
              </div>
              <span className="text-2xs leading-relaxed text-muted">
                {stats.awayThisMonth > 0
                  ? `${stats.awayThisMonth} ${stats.awayThisMonth === 1 ? "day" : "days"} away ${stats.awayThisMonth === 1 ? "is" : "are"} not counted, either way.`
                  : "A perfect day is every activity that was scheduled, done."}
              </span>
            </section>

            <div className="flex gap-2.5">
              <Tile value={`${stats.passRate}%`} label="PERIODS PASSED, 30 DAYS" />
              <Tile
                value={String(stats.longestStreak)}
                label="LONGEST RUNNING STREAK"
                flame
              />
              <Tile value={String(stats.graceLeft)} label="GRACE LEFT THIS MONTH" />
            </div>

            <section className="flex flex-col gap-[11px]">
              <span className="text-micro tracking-label text-muted">
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
                            "aspect-square w-full " +
                            // An away day is drawn, not left blank: the dashed
                            // outline is what distinguishes a declared trip
                            // from a fortnight of not turning up.
                            (v === AWAY
                              ? "border border-dashed border-accent"
                              : v < 0
                                ? "border border-rule"
                                : "")
                          }
                          style={v < 0 ? undefined : { background: HEAT[heatStep(v)] }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-[7px]">
                  <span className="text-micro text-muted">none</span>
                  {HEAT.map((c, i) => (
                    <div key={i} className="h-[8px] w-[14px]" style={{ background: c }} />
                  ))}
                  <span className="text-micro text-muted">all</span>
                  {stats.away.length > 0 ? (
                    <span className="ml-2.5 flex items-center gap-[5px]">
                      <span className="block h-[8px] w-[8px] border border-dashed border-accent" />
                      <span className="text-micro text-accent">away</span>
                    </span>
                  ) : null}
                  <span className="ml-auto text-micro text-muted">
                    {stats.heatmap.length} weeks
                  </span>
                </div>
                {stats.away.map((a) => (
                  <span
                    key={a.from}
                    className="text-2xs leading-relaxed text-accent"
                  >
                    Away {shortDay(a.from)} to {shortDay(a.to)}. Those days were not
                    scheduled.
                  </span>
                ))}
              </div>
            </section>

            {/* Every one of these rows has always been a link to that
                activity's own chart, and nothing said so: no chevron, no press
                state, and the near-identical row on Home is not a link, so the
                shape reads as a line of a table. The artboard drew it that way
                too, which is how it got built that way.

                The chevron is the app's existing mark for this, on Home's
                starter rows and above the photos. The header says it in words
                as well, because a 12px glyph on the far edge is not something
                to rest a whole screen on. */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-micro tracking-label text-muted">
                  BY ACTIVITY, LAST 30 DAYS
                </span>
                <span className="text-micro tracking-label text-muted">
                  TAP FOR THE CHART
                </span>
              </div>
              <div className="flex flex-col">
                {stats.byActivity.map((row) => (
                  <Link
                    key={row.typeKey}
                    href={`/stats?a=${row.typeKey}`}
                    className="flex items-center gap-[11px] border-b border-rule py-[11px] active:opacity-70"
                  >
                    <span className="flex flex-none text-muted">
                      <ActivityIcon name={row.icon} size={17} />
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-[9px]">
                        <span className="text-sm">{row.name}</span>
                        <span className="flex items-center gap-[9px]">
                          <span className="text-2xs tabular-nums text-muted">
                            {row.percent}%
                          </span>
                          {/* Grey before alive: a run that came short keeps
                              its number, so a positive count is not a live
                              flame. Same order as Home and Activities. */}
                          {row.grey ? (
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
                        </span>
                      </div>
                      <div className="h-[3px] bg-rule">
                        <div className="h-[3px] bg-fg" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                    <span className="flex-none text-sm text-muted">&rsaquo;</span>
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
          "text-lg tabular-nums " +
          (flame ? "bg-gradient-to-r from-flame-from via-flame to-flame-to bg-clip-text text-transparent" : "")
        }
      >
        {value}
      </span>
      <span className="text-micro leading-snug text-muted">{label}</span>
    </div>
  );
}
