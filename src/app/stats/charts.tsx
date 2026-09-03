import { DateTime } from "luxon";
import type { ActivityChart } from "@/server/stats";

// Four chart kinds, drawn by the engine. A module names its kind and the engine
// draws it (invariant 6): nothing here branches on a type key, only on a kind.
//
// The `detail` a point carries is the module's own output. Each chart reads
// only the fields its own kind defines, and the engine never interprets them
// beyond that.

const num = (d: Record<string, unknown>, key: string): number | null => {
  const v = d[key];
  return typeof v === "number" ? v : null;
};

export function ActivityChartView({ chart }: { chart: ActivityChart }) {
  if (chart.points.length === 0) {
    return (
      <p className="text-[13px] leading-[1.6] text-muted">
        Nothing scored yet. The chart appears once the first period closes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {chart.kind === "numeric" ? <Numeric chart={chart} /> : null}
      {chart.kind === "binary" ? <Binary chart={chart} /> : null}
      {chart.kind === "weekly" ? <Weekly chart={chart} /> : null}
      {chart.kind === "windowed" ? <Windowed chart={chart} /> : null}
      <PassRate chart={chart} />
    </div>
  );
}

// Bars against the target, with the rule's direction shown as the line to be
// on the right side of.
function Numeric({ chart }: { chart: ActivityChart }) {
  const value = (d: Record<string, unknown>) =>
    num(d, "steps") ?? num(d, "minutes") ?? num(d, "amount") ?? num(d, "calories") ?? num(d, "glasses") ?? 0;
  const target = (d: Record<string, unknown>) => num(d, "target") ?? num(d, "limit") ?? 0;

  const peak = Math.max(
    1,
    ...chart.points.map((p) => Math.max(value(p.detail), target(p.detail))),
  );
  const line = target(chart.points.at(-1)!.detail);

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">LAST 30 PERIODS</span>
      <div className="relative flex h-[120px] items-end gap-[3px]">
        {line > 0 ? (
          <div
            className="absolute inset-x-0 border-t border-dashed border-muted"
            style={{ bottom: `${(line / peak) * 100}%` }}
          />
        ) : null}
        {chart.points.map((p) => (
          <div
            key={p.periodStart}
            title={`${p.periodStart}: ${value(p.detail)}`}
            className={"flex-1 " + (p.passed ? "bg-pass" : "bg-penalty")}
            style={{ height: `${Math.max(2, (value(p.detail) / peak) * 100)}%` }}
          />
        ))}
      </div>
      {line > 0 ? (
        <span className="text-[11.5px] leading-[1.55] text-muted">
          The dashed line is your target of {line.toLocaleString("en-US")}.
        </span>
      ) : null}
    </section>
  );
}

// Held or slipped. Every cell carries a mark, so the meaning does not rest on
// colour alone.
function Binary({ chart }: { chart: ActivityChart }) {
  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">HELD OR SLIPPED</span>
      <div className="grid grid-cols-7 gap-[4px]">
        {chart.points.map((p) => (
          <div
            key={p.periodStart}
            title={p.periodStart}
            className={
              "flex aspect-square items-center justify-center border text-[11px] " +
              (p.passed ? "border-pass text-pass" : "border-penalty text-penalty")
            }
          >
            {p.passed ? "✓" : "✕"}
          </div>
        ))}
      </div>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        A tick is a day it held. A cross is a day you said it did not.
      </span>
    </section>
  );
}

// Weekly counts against the minimum.
function Weekly({ chart }: { chart: ActivityChart }) {
  const sessions = (d: Record<string, unknown>) => num(d, "sessions") ?? 0;
  const required = (d: Record<string, unknown>) => num(d, "required") ?? 0;
  const peak = Math.max(1, ...chart.points.map((p) => Math.max(sessions(p.detail), required(p.detail))));

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">WEEK BY WEEK</span>
      <div className="flex h-[110px] items-end gap-[6px]">
        {chart.points.map((p) => (
          <div key={p.periodStart} className="flex flex-1 flex-col items-center gap-[6px]">
            {/* An explicit height, not h-full: the column above this track has
                no height of its own (its items-end parent lets it shrink to
                content), so a percentage height here would resolve against
                nothing and never show a bar. */}
            <div className="flex h-[90px] w-full flex-col justify-end bg-rule">
              <div
                className={p.passed ? "bg-pass" : "bg-penalty"}
                style={{ height: `${(sessions(p.detail) / peak) * 100}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted">
              {sessions(p.detail)}
            </span>
          </div>
        ))}
      </div>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        Against a minimum of {required(chart.points.at(-1)!.detail)} a week.
      </span>
    </section>
  );
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = ((minutes % 60) + 60) % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// The actual wake press, in the period's own timezone, plotted against the
// window it had to land in. Sleep is the only type shaped this way.
function Windowed({ chart }: { chart: ActivityChart }) {
  const last = chart.points.at(-1)!.detail;
  const windowOpen = num(last, "wake_window_open_minutes");
  const windowClose = num(last, "wake_window_close_minutes");
  const dots = chart.points
    .map((p) => ({
      periodStart: p.periodStart,
      minutes: num(p.detail, "wake_at_minutes"),
      ok: p.detail.wake_ok === true,
    }))
    .filter(
      (d): d is { periodStart: string; minutes: number; ok: boolean } => d.minutes !== null,
    );

  if (windowOpen === null || windowClose === null || dots.length === 0) {
    return (
      <section className="flex flex-col gap-[11px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">WAKE TIME</span>
        <p className="text-[11.5px] leading-[1.55] text-muted">
          No wake check-in recorded yet.
        </p>
      </section>
    );
  }

  const buffer = Math.max(30, Math.round((windowClose - windowOpen) / 2));
  const domainMin = Math.min(windowOpen, ...dots.map((d) => d.minutes)) - buffer;
  const domainMax = Math.max(windowClose, ...dots.map((d) => d.minutes)) + buffer;
  const span = Math.max(1, domainMax - domainMin);
  const topOf = (minutes: number) => ((minutes - domainMin) / span) * 100;
  const missed = dots.filter((d) => !d.ok).length;

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">
        WAKE TIME, {dots.length} DAYS
      </span>
      <div className="relative h-[132px] border-b border-l border-rule">
        <div
          className="absolute inset-x-0 border-y border-dashed border-pass"
          style={{ top: `${topOf(windowOpen)}%`, height: `${topOf(windowClose) - topOf(windowOpen)}%` }}
        />
        <span
          className="absolute right-[6px] -translate-y-1/2 text-[9.5px] text-pass"
          style={{ top: `${topOf(windowOpen)}%` }}
        >
          window
        </span>
        {dots.map((d, i) => (
          <div
            key={d.periodStart}
            title={`${d.periodStart}: ${formatClock(d.minutes)}`}
            className={
              "absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 " +
              (d.ok ? "bg-fg" : "bg-penalty")
            }
            style={{
              left: `${dots.length === 1 ? 50 : (i / (dots.length - 1)) * 100}%`,
              top: `${topOf(d.minutes)}%`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{formatClock(domainMin)}</span>
        <span>{formatClock(windowOpen)}</span>
        <span>{formatClock(windowClose)}</span>
        <span>{formatClock(domainMax)}</span>
      </div>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        {missed === 0
          ? "Every morning landed inside the window."
          : `${missed} morning${missed === 1 ? "" : "s"} landed outside the window.`}{" "}
        Descriptive only, this never ranks anyone.
      </span>
    </section>
  );
}

function PassRate({ chart }: { chart: ActivityChart }) {
  const passed = chart.points.filter((p) => p.passed).length;
  const percent = Math.round((passed / chart.points.length) * 100);
  const first = DateTime.fromISO(chart.points[0].periodStart).toFormat("d LLL");

  return (
    <section className="flex items-center justify-between gap-3 border border-rule p-[13px]">
      <span className="text-[12.5px]">
        {passed} of {chart.points.length} passed since {first}
      </span>
      <span className="text-[15px] tabular-nums text-muted">{percent}%</span>
    </section>
  );
}
