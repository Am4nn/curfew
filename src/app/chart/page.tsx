import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups } from "@/server/groups";
import { getWakeChart, type WakeChart } from "@/server/chart";

const SERIES_STROKE = ["var(--fg)", "var(--accent)"];

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function Chart() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const groups = await listUserGroups(user.id);

  return (
    <main className="min-h-dvh px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">WAKE TIMES</h1>
          <Link href="/" className="text-[12px] text-muted">
            ‹ dashboard
          </Link>
        </header>

        {groups.length === 0 ? (
          <p className="text-[14px] text-muted">No groups yet.</p>
        ) : (
          await Promise.all(
            groups.map(async (g) => {
              const chart = await getWakeChart(g.groupId, 30);
              return <GroupChart key={g.groupId} name={g.name} chart={chart} />;
            }),
          )
        )}
      </div>
    </main>
  );
}

function GroupChart({ name, chart }: { name: string; chart: WakeChart }) {
  return (
    <section className="mb-9">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.1em]">{name}</h2>
      {!chart.hasData ? (
        <p className="text-[13px] text-muted">
          No wake check-ins in the last {chart.days} days.
        </p>
      ) : (
        <WakePlot chart={chart} />
      )}
    </section>
  );
}

function WakePlot({ chart }: { chart: WakeChart }) {
  const W = 520;
  const H = 170;
  const padL = 44;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const all = chart.series.flatMap((s) => s.points.map((p) => p.minutes));
  let yMin = Math.min(...all) - 15;
  let yMax = Math.max(...all) + 15;
  if (yMax - yMin < 60) {
    const mid = (yMin + yMax) / 2;
    yMin = mid - 30;
    yMax = mid + 30;
  }
  yMin = Math.max(0, Math.floor(yMin / 30) * 30);
  yMax = Math.min(1440, Math.ceil(yMax / 30) * 30);

  const x = (day: number) =>
    padL + (chart.days <= 1 ? 0 : (day / (chart.days - 1)) * plotW);
  const y = (min: number) => padT + ((yMax - min) / (yMax - yMin)) * plotH;

  // A few horizontal time gridlines.
  const lines: number[] = [];
  for (let m = yMin; m <= yMax; m += 60) lines.push(m);

  const end = new Date(`${chart.startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + chart.days - 1);

  return (
    <>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Wake times over the last 30 days"
        >
          {lines.map((m) => (
            <g key={m}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(m)}
                y2={y(m)}
                stroke="var(--rule)"
                strokeWidth={1}
              />
              <text x={4} y={y(m) + 4} fontSize={10} fill="var(--muted)">
                {hhmm(m)}
              </text>
            </g>
          ))}
          {chart.series.map((s, i) => {
            const stroke = SERIES_STROKE[i % SERIES_STROKE.length];
            const pts = s.points.map((p) => `${x(p.dayIndex)},${y(p.minutes)}`);
            return (
              <g key={s.userId}>
                {s.points.length > 1 ? (
                  <polyline
                    points={pts.join(" ")}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.5}
                  />
                ) : null}
                {s.points.map((p, j) => (
                  <circle key={j} cx={x(p.dayIndex)} cy={y(p.minutes)} r={2.5} fill={stroke} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{chart.startDate}</span>
        <span className="flex gap-4">
          {chart.series.map((s, i) => (
            <span key={s.userId} className="flex items-center gap-1">
              <span
                className="inline-block h-[2px] w-4"
                style={{ background: SERIES_STROKE[i % SERIES_STROKE.length] }}
              />
              {s.name}
            </span>
          ))}
        </span>
        <span>{end.toISOString().slice(0, 10)}</span>
      </div>
    </>
  );
}
