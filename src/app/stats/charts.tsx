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

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function ActivityChartView({ chart }: { chart: ActivityChart }) {
  if (chart.points.length === 0) {
    return (
      <p className="text-[13px] leading-[1.6] text-muted">
        Nothing scored yet. The chart appears once the first period closes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]">
      {chart.kind === "numeric" ? <Numeric chart={chart} /> : null}
      {chart.kind === "binary" ? <Binary chart={chart} /> : null}
      {chart.kind === "weekly" ? <Weekly chart={chart} /> : null}
      {chart.kind === "windowed" ? <Windowed chart={chart} /> : null}
      <Weekdays chart={chart} />
      <Tiles chart={chart} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The three figures every chart carries, and the weekday bars under it. Both
// are drawn from the points alone, so a new kind gets them without asking.
// ---------------------------------------------------------------------------

function Tiles({ chart }: { chart: ActivityChart }) {
  const third = thirdTile(chart);
  return (
    <div className="flex gap-[10px]">
      <Tile value={String(chart.streak)} label="CURRENT STREAK" flame />
      <Tile value={String(chart.best)} label="BEST" />
      <Tile value={third.value} label={third.label} />
    </div>
  );
}

// The third figure is the one that depends on the kind: a rate for the kinds
// that carry a number, grace left for the kinds that do not.
function thirdTile(chart: ActivityChart): { value: string; label: string } {
  if (chart.kind === "numeric") {
    const total = chart.points.reduce((s, p) => s + numericValue(p.detail), 0);
    return {
      value: Math.round(total / chart.points.length).toLocaleString("en-US"),
      label: "AVERAGE A PERIOD",
    };
  }
  if (chart.kind === "weekly") {
    const total = chart.points.reduce((s, p) => s + (num(p.detail, "sessions") ?? 0), 0);
    return {
      value: (total / chart.points.length).toFixed(1),
      label: "SESSIONS A WEEK",
    };
  }
  return { value: String(chart.graceLeft), label: "GRACE LEFT" };
}

function Tile({ value, label, flame }: { value: string; label: string; flame?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-[5px] border border-rule p-3">
      <span
        className={
          "text-[19px] font-semibold leading-none tabular-nums " +
          (flame
            ? "bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-transparent"
            : "")
        }
      >
        {value}
      </span>
      <span className="text-[9.5px] leading-[1.4] tracking-[0.08em] text-muted">{label}</span>
    </div>
  );
}

// Monday-first weekday index for a period start.
function weekdayOf(day: string): number {
  return DateTime.fromISO(day).weekday - 1;
}

// For a weekly kind the bars count which days the sessions actually happened,
// which the module records; for every other kind they are the pass rate on
// that weekday. Both are counted here rather than on the server, because both
// are already in the points.
function Weekdays({ chart }: { chart: ActivityChart }) {
  const weekly = chart.kind === "weekly";
  const counts = Array.from({ length: 7 }, () => ({ hit: 0, of: 0 }));

  if (weekly) {
    for (const p of chart.points) {
      const days = Array.isArray(p.detail.days) ? (p.detail.days as unknown[]) : [];
      for (const d of days) {
        if (typeof d !== "string") continue;
        counts[weekdayOf(d)].hit += 1;
      }
    }
    // Every week offered every weekday, so the denominator is the week count.
    for (const c of counts) c.of = chart.points.length;
  } else {
    for (const p of chart.points) {
      const c = counts[weekdayOf(p.periodStart)];
      c.of += 1;
      if (p.passed) c.hit += 1;
    }
  }

  const values = counts.map((c) => (c.of === 0 ? null : (c.hit / c.of) * 100));
  if (values.every((v) => v === null)) return null;

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">
        {weekly ? "WHICH DAYS YOU GO" : "PASS RATE BY WEEKDAY"}
      </span>
      <div className="flex flex-col gap-[9px]">
        <div className="flex h-[70px] items-end gap-[6px]">
          {values.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end">
              <div className="bg-fg" style={{ height: `${v ?? 0}%` }} />
            </div>
          ))}
        </div>
        <div className="flex gap-[6px]">
          {DAYS.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-muted">
              {d}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The four kinds.
// ---------------------------------------------------------------------------

const numericValue = (d: Record<string, unknown>) =>
  num(d, "steps") ??
  num(d, "minutes") ??
  num(d, "amount") ??
  num(d, "calories") ??
  num(d, "glasses") ??
  0;

const numericTarget = (d: Record<string, unknown>) => num(d, "target") ?? num(d, "limit") ?? 0;

// Bars against the target. A bar that reached the line is solid, one that fell
// short is the rule colour: height carries the pass as well as tone does.
function Numeric({ chart }: { chart: ActivityChart }) {
  const peak = Math.max(
    1,
    ...chart.points.map((p) => Math.max(numericValue(p.detail), numericTarget(p.detail))),
  );
  const line = numericTarget(chart.points.at(-1)!.detail);
  const short = chart.points.filter((p) => !p.passed).length;

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">
        LAST {chart.points.length} PERIODS
      </span>
      <div className="relative h-[132px]">
        {line > 0 ? (
          <>
            <div
              className="absolute inset-x-0 border-t border-dashed border-accent"
              style={{ bottom: `${(line / peak) * 100}%` }}
            />
            <span
              className="absolute right-0 bg-bg pl-[4px] text-[9.5px] text-accent"
              style={{ bottom: `calc(${(line / peak) * 100}% + 2px)` }}
            >
              target {line.toLocaleString("en-US")}
            </span>
          </>
        ) : null}
        <div className="flex h-full items-end gap-[4px]">
          {chart.points.map((p) => (
            <div
              key={p.periodStart}
              title={`${p.periodStart}: ${numericValue(p.detail).toLocaleString("en-US")}`}
              className={"flex-1 " + (p.passed ? "bg-fg" : "bg-rule")}
              style={{ height: `${Math.max(2, (numericValue(p.detail) / peak) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        Bars at or above the line passed.{" "}
        {short === 0
          ? "None fell short."
          : `${short} ${short === 1 ? "period" : "periods"} fell short.`}
      </span>
    </section>
  );
}

// Held or slipped, laid out on a real calendar so a weekday reads down a
// column. Every cell carries a mark, so the meaning never rests on colour.
function Binary({ chart }: { chart: ActivityChart }) {
  const byDay = new Map(chart.points.map((p) => [p.periodStart, p.passed]));
  const first = DateTime.fromISO(chart.points[0].periodStart).startOf("week");
  const last = DateTime.fromISO(chart.points.at(-1)!.periodStart);
  const weeks: (boolean | null)[][] = [];
  for (let cursor = first; cursor <= last; cursor = cursor.plus({ weeks: 1 })) {
    const week = cursor;
    weeks.push(
      Array.from({ length: 7 }, (_, d) => {
        const key = week.plus({ days: d }).toFormat("yyyy-MM-dd");
        return byDay.has(key) ? byDay.get(key)! : null;
      }),
    );
  }
  const slips = chart.points.filter((p) => !p.passed).length;

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">
        HELD OR SLIPPED, {weeks.length} WEEKS
      </span>
      <div className="flex flex-col gap-[5px]">
        {weeks.map((week, w) => (
          <div key={w} className="flex gap-[5px]">
            {week.map((held, d) => (
              <Cell key={d} held={held} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-[5px]">
        {DAYS.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-muted">
            {d}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-[14px]">
        <span className="flex items-center gap-[6px] text-[10.5px] text-muted">
          <span className="flex text-pass">
            <Tick />
          </span>
          held
        </span>
        <span className="flex items-center gap-[6px] text-[10.5px] text-muted">
          <span className="flex text-penalty">
            <Cross />
          </span>
          slipped
        </span>
        <span className="ml-auto text-[10.5px] text-muted">empty is not scheduled</span>
      </div>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        {slips === 0
          ? "No slips in this window."
          : `${slips} ${slips === 1 ? "slip" : "slips"} in ${weeks.length} weeks.`}{" "}
        All on your own word. There is nothing here to verify.
      </span>
    </section>
  );
}

function Cell({ held }: { held: boolean | null }) {
  if (held === null) return <div className="aspect-square flex-1 border border-rule" />;
  return (
    <div
      className={
        "flex aspect-square flex-1 items-center justify-center border " +
        (held ? "border-pass text-pass" : "border-penalty text-penalty")
      }
      // A tint of the same colour, mixed rather than an opacity modifier:
      // Tailwind's bg-pass/15 cannot inject an alpha into a var()-backed
      // colour and silently drops it.
      style={{
        background: held
          ? "color-mix(in srgb, var(--pass) 15%, transparent)"
          : "color-mix(in srgb, var(--penalty) 15%, transparent)",
      }}
    >
      {held ? <Tick /> : <Cross />}
    </div>
  );
}

function Tick() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

// Weekly counts against the minimum, the count printed above each bar.
function Weekly({ chart }: { chart: ActivityChart }) {
  const sessions = (d: Record<string, unknown>) => num(d, "sessions") ?? 0;
  const required = (d: Record<string, unknown>) => num(d, "required") ?? 0;
  const min = required(chart.points.at(-1)!.detail);
  const peak = Math.max(1, min, ...chart.points.map((p) => sessions(p.detail)));
  const short = chart.points.filter((p) => sessions(p.detail) < min).length;

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">
        SESSIONS A WEEK, {chart.points.length} WEEKS
      </span>
      <div className="relative h-[132px]">
        {min > 0 ? (
          <>
            <div
              className="absolute inset-x-0 border-t border-dashed border-accent"
              style={{ bottom: `${(min / peak) * 84}%` }}
            />
            <span
              className="absolute right-0 bg-bg pl-[4px] text-[9.5px] text-accent"
              style={{ bottom: `calc(${(min / peak) * 84}% + 2px)` }}
            >
              minimum {min}
            </span>
          </>
        ) : null}
        <div className="flex h-full items-end gap-[7px]">
          {chart.points.map((p) => (
            <div
              key={p.periodStart}
              className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]"
            >
              <span
                className={
                  "text-[10px] tabular-nums " +
                  (sessions(p.detail) >= min ? "text-muted" : "text-penalty")
                }
              >
                {sessions(p.detail)}
              </span>
              <div
                className={"w-full " + (sessions(p.detail) >= min ? "bg-fg" : "bg-rule")}
                style={{ height: `${Math.max(2, (sessions(p.detail) / peak) * 84)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <span className="text-[11.5px] leading-[1.55] text-muted">
        {short === 0
          ? `Every week met the minimum of ${min}.`
          : `${short} ${short === 1 ? "week" : "weeks"} fell short of ${min}.`}
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
          style={{
            top: `${topOf(windowOpen)}%`,
            height: `${topOf(windowClose) - topOf(windowOpen)}%`,
            background: "color-mix(in srgb, var(--pass) 12%, transparent)",
          }}
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
