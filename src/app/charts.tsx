// Shared inline-SVG charts used by the admin Insights tab and the member stats
// page. Theme tokens, single series (one colour, no legend, the title names it),
// recessive grid, native hover titles. Thin marks, rounded bar ends on the
// baseline, 2px lines, one selective label (the latest value).

export type ChartPoint = {
  date: string; // yyyy-MM-dd, or a short label like "Mon"
  value: number;
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

export function TimeChart({
  title,
  data,
  kind,
  fmt,
  color = "var(--fg)",
  baseZero = true,
  suffix,
}: {
  title: string;
  data: ChartPoint[];
  kind: "bar" | "line";
  fmt: (v: number) => string;
  color?: string;
  baseZero?: boolean;
  suffix?: string;
}) {
  const W = 640, H = 176, padL = 48, padR = 12, padT = 12, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (data.length === 0) {
    return (
      <Figure title={title} suffix={suffix}>
        <p className="text-[13px] text-muted">No data yet.</p>
      </Figure>
    );
  }

  const vals = data.map((d) => d.value);
  let yMin = baseZero ? 0 : Math.min(...vals);
  let yMax = baseZero ? niceMax(Math.max(1, ...vals)) : Math.max(...vals);
  if (!baseZero) {
    const pad = Math.max(5, (yMax - yMin) * 0.15);
    yMin = Math.floor(yMin - pad);
    yMax = Math.ceil(yMax + pad);
  }
  const y = (v: number) => padT + (yMax === yMin ? plotH : ((yMax - v) / (yMax - yMin)) * plotH);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];

  const n = data.length;
  const band = plotW / n;
  const cx = (i: number) => padL + i * band + band / 2;
  const lx = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  const last = data[n - 1];

  return (
    <Figure title={title} suffix={suffix}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {fmt(Math.round(t))}
              </text>
            </g>
          ))}

          {kind === "bar"
            ? data.map((d, i) => {
                const bw = Math.max(1, band * 0.62);
                const h = y(yMin) - y(d.value);
                return (
                  <rect
                    key={i}
                    x={cx(i) - bw / 2}
                    y={y(d.value)}
                    width={bw}
                    height={Math.max(0, h)}
                    rx={Math.min(2, bw / 2)}
                    fill={color}
                  >
                    <title>{`${d.date}: ${fmt(d.value)}`}</title>
                  </rect>
                );
              })
            : (
              <>
                <polyline
                  points={data.map((d, i) => `${lx(i)},${y(d.value)}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
                {data.map((d, i) => (
                  <circle key={i} cx={lx(i)} cy={y(d.value)} r={2.5} fill={color}>
                    <title>{`${d.date}: ${fmt(d.value)}`}</title>
                  </circle>
                ))}
              </>
            )}

          {/* Selective label: the latest value only. */}
          <text
            x={W - padR}
            y={y(last.value) - 6}
            textAnchor="end"
            fontSize={11}
            fill="var(--fg)"
          >
            {fmt(last.value)}
          </text>
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{data[0].date}</span>
        <span>{last.date}</span>
      </div>
    </Figure>
  );
}

export function Figure({
  title,
  suffix,
  children,
}: {
  title: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold tracking-[0.1em]">{title}</h2>
        {suffix ? <span className="text-[11px] text-muted">{suffix}</span> : null}
      </div>
      {children}
    </section>
  );
}
