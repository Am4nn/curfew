// The report. One HTML file, in the app's own voice and typeface: IBM Plex
// Mono, zero radius, no glow except the one that means something.
import type { Check, Series } from "./scenarios";
import type { LiveResult } from "./live";
import type {
  RankLadder,
  PartialShareRow,
  MissCost,
  HoldRow,
  ClimbPoint,
  Headline,
} from "./analysis";

export interface ScenarioResult {
  id: string;
  group: string;
  title: string;
  question: string;
  checks: Check[];
  notes: string[];
  series?: Series[];
  ms: number;
  error?: string;
}

export interface ReportInput {
  ran: string;
  results: ScenarioResult[];
  headlines: Headline[];
  ladders: RankLadder[];
  partial: PartialShareRow[];
  costs: MissCost[];
  holds: HoldRow[];
  climb: ClimbPoint[];
  live: LiveResult[];
  liveDays: number;
}

const esc = (s: unknown) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fmt = (v: unknown) =>
  typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : esc(JSON.stringify(v) ?? "").replace(/^"|"$/g, "");

/** A line chart as inline SVG. No library, no network. */
function chart(series: Series[], width = 720, height = 200): string {
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const ceilings = series.map((s) => s.ceiling).filter((c): c is number => c !== undefined);
  const max = Math.max(...all, ...ceilings, 1);
  const min = Math.min(...all, 0);
  const n = Math.max(...series.map((s) => s.points.length), 1);
  const x = (i: number) => (i / Math.max(n - 1, 1)) * (width - 44) + 40;
  const y = (v: number) => height - 22 - ((v - min) / Math.max(max - min, 1)) * (height - 34);

  const strokes = ["var(--fg)", "var(--muted)", "var(--pass)"];
  const paths = series
    .map((s, si) => {
      const d = s.points
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${strokes[si % strokes.length]}" stroke-width="2" ${si > 0 ? 'stroke-dasharray="4 3"' : ""}/>`;
    })
    .join("");

  const gridVals = [min, min + (max - min) / 2, max];
  const grid = gridVals
    .map(
      (v) =>
        `<line x1="40" y1="${y(v).toFixed(1)}" x2="${width - 4}" y2="${y(v).toFixed(1)}" stroke="var(--rule)" stroke-width="1"/>` +
        `<text x="0" y="${(y(v) + 4).toFixed(1)}" class="ax">${v.toFixed(0)}</text>`,
    )
    .join("");

  const legend = series
    .map(
      (s, si) =>
        `<span class="key"><i style="background:${strokes[si % strokes.length]}"></i>${esc(s.label)}</span>`,
    )
    .join("");

  return `<div class="chart"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(series[0]?.label ?? "chart")}">${grid}${paths}</svg><div class="legend">${legend}</div></div>`;
}

function checkRow(c: Check): string {
  const mark = c.ok ? "PASS" : "FAIL";
  return `<tr class="${c.ok ? "" : "bad"}">
    <td class="mark">${mark}</td>
    <td>${esc(c.what)}</td>
    <td class="num">${fmt(c.got)}</td>
    <td class="num muted">${fmt(c.want)}</td>
  </tr>`;
}

function scenarioBlock(r: ScenarioResult): string {
  const failed = r.checks.filter((c) => !c.ok).length;
  const status = r.error ? "ERROR" : failed > 0 ? `${failed} FAILED` : "OK";
  return `<section class="scn ${r.error || failed ? "bad" : ""}" id="${esc(r.id)}">
    <header>
      <h3>${esc(r.title)}</h3>
      <span class="status ${r.error || failed ? "bad" : "ok"}">${status}</span>
    </header>
    <p class="q">${esc(r.question)}</p>
    ${r.error ? `<pre class="err">${esc(r.error)}</pre>` : ""}
    ${
      r.checks.length
        ? `<table class="checks"><thead><tr><th></th><th>Assertion</th><th class="num">Got</th><th class="num">Expected</th></tr></thead><tbody>${r.checks.map(checkRow).join("")}</tbody></table>`
        : ""
    }
    ${r.series?.length ? chart(r.series) : ""}
    ${r.notes.length ? `<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    <p class="meta">${esc(r.id)} &middot; ${r.ms} ms</p>
  </section>`;
}

export function render(input: ReportInput): string {
  const total = input.results.reduce((s, r) => s + r.checks.length, 0);
  const failed = input.results.reduce(
    (s, r) => s + r.checks.filter((c) => !c.ok).length + (r.error ? 1 : 0),
    0,
  );

  const groups = [...new Set(input.results.map((r) => r.group))];
  const body = groups
    .map(
      (g) =>
        `<h2 id="g-${esc(g)}">${esc(g)}</h2>` +
        input.results
          .filter((r) => r.group === g)
          .map(scenarioBlock)
          .join(""),
    )
    .join("");

  const ladderRows = input.ladders
    .map(
      (l) =>
        `<tr><td>${esc(l.label)}</td><td class="num">${esc(l.completion)}</td>` +
        l.toRank
          .map((t) => `<td class="num">${t.days === null ? "never" : t.days}</td>`)
          .join("") +
        `<td class="num strong">${l.settlesAt.toFixed(0)}</td><td class="num muted">${l.peaksAt.toFixed(0)}</td><td>${esc(l.settlesRank)}</td></tr>`,
    )
    .join("");
  const ladderHead = input.ladders[0]?.toRank.map((t) => `<th class="num">${esc(t.rank)}</th>`).join("") ?? "";

  return `<title>Curfew engine simulation</title>
<style>
  :root {
    --bg: #f4f2ee; --fg: #16150f; --muted: #6c6a60; --rule: #d6d2c8;
    --pass: #1f6f3f; --fail: #a3231f; --card: #ffffff;
  }
  :root:not([data-theme="light"]) { }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0b0a09; --fg: #ece9e1; --muted: #8b887e; --rule: #2a2823;
      --pass: #58c07f; --fail: #e4736e; --card: #131210;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0b0a09; --fg: #ece9e1; --muted: #8b887e; --rule: #2a2823;
    --pass: #58c07f; --fail: #e4736e; --card: #131210;
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--fg); margin: 0;
    font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px; line-height: 1.55;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { font-size: 21px; letter-spacing: .02em; margin: 0 0 4px; }
  h2 { font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
       color: var(--muted); margin: 44px 0 12px; border-bottom: 1px solid var(--rule);
       padding-bottom: 8px; }
  h3 { font-size: 14px; margin: 0; }
  .sub { color: var(--muted); margin: 0 0 26px; }
  .tally { display: flex; gap: 22px; border: 1px solid var(--rule); padding: 14px 16px;
           background: var(--card); margin-bottom: 8px; }
  .tally div { display: flex; flex-direction: column; }
  .tally b { font-size: 22px; font-weight: 600; }
  .tally span { font-size: 10px; letter-spacing: .16em; color: var(--muted); text-transform: uppercase; }
  .scn { border: 1px solid var(--rule); background: var(--card); padding: 16px 18px; margin-bottom: 12px; }
  .scn.bad { border-color: var(--fail); }
  .scn header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .status { font-size: 10px; letter-spacing: .16em; }
  .status.ok { color: var(--pass); }
  .status.bad { color: var(--fail); }
  .q { color: var(--muted); margin: 6px 0 12px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th, td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
  th { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); font-weight: 400; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.mark { color: var(--pass); font-size: 10px; letter-spacing: .1em; width: 44px; }
  tr.bad td.mark { color: var(--fail); }
  tr.bad td { color: var(--fail); }
  .muted { color: var(--muted); }
  .strong { font-weight: 600; }
  .notes { margin: 10px 0 0; padding-left: 16px; color: var(--muted); }
  .notes li { margin: 2px 0; }
  .meta { font-size: 10px; color: var(--muted); margin: 12px 0 0; letter-spacing: .1em; }
  .err { color: var(--fail); white-space: pre-wrap; font-size: 12px; }
  .chart { margin: 14px 0 4px; overflow-x: auto; }
  .chart svg { width: 100%; height: 200px; display: block; }
  .ax { fill: var(--muted); font-size: 9px; font-family: inherit; }
  .legend { display: flex; gap: 14px; margin-top: 6px; }
  .key { font-size: 10px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
  .key i { width: 10px; height: 2px; display: inline-block; }
  .scroll { overflow-x: auto; }
  .head { border: 1px solid var(--rule); background: var(--card); padding: 14px 16px; margin-bottom: 10px; }
  .head p { margin: 4px 0 0; color: var(--muted); }
  .head b { font-weight: 600; color: var(--fg); }
</style>
<div class="wrap">
  <h1>Curfew engine simulation</h1>
  <p class="sub">${esc(input.ran)}</p>

  <div class="tally">
    <div><b>${input.results.length}</b><span>Scenarios</span></div>
    <div><b>${total}</b><span>Assertions</span></div>
    <div><b style="color:${failed ? "var(--fail)" : "var(--pass)"}">${failed}</b><span>Failed</span></div>
  </div>
  <p class="sub">Every scenario builds a world, runs the real nightly job over it, and reads back
  what the engine wrote. Nothing here is mocked: the scores, streaks, reputation curves and ledger
  rows below came out of <b>scoreAll</b>.</p>

  <h2>What the numbers say</h2>
  ${input.headlines
    .map(
      (h) =>
        `<div class="head"><b>${esc(h.question)}</b><p>${esc(h.answer)}</p></div>`,
    )
    .join("")}

  <h2>Reaching a rank, and holding it</h2>
  <div class="scn">
    <p class="q">Days from a standing start to each rank, and where a steady rate of missing ends up.
    A rate of missing does not converge to a point, it cycles: up through the clean days, down on the
    miss. "Holds at" is the bottom of that cycle, which is the score you can count on; "peaks at" is
    what it touches just before the next slip. The rank is read off the bottom.</p>
    <div class="scroll"><table>
      <thead><tr><th>Behaviour</th><th class="num">Completion</th>${ladderHead}<th class="num">Holds at</th><th class="num">Peaks at</th><th>Rank held</th></tr></thead>
      <tbody>${ladderRows}</tbody>
    </table></div>
    ${chart([{ label: "Never missing, from a standing start", points: input.climb.map((p) => ({ day: String(p.day), value: p.score })) }])}
  </div>

  <h2>What sharing narrowly costs</h2>
  <div class="scn">
    <p class="q">Breadth is types shared over types the group accepts, and the ceiling is
    250 + 750 x breadth. This is a group that accepts six.</p>
    <table>
      <thead><tr><th>Shared</th><th class="num">Breadth</th><th class="num">Ceiling</th><th>Highest rank</th><th>IMMACULATE</th></tr></thead>
      <tbody>${input.partial
        .map(
          (p) =>
            `<tr><td>${esc(p.shared)}</td><td class="num">${p.breadth.toFixed(2)}</td><td class="num">${p.ceiling.toFixed(0)}</td><td>${esc(p.highestRank)}</td><td>${p.immaculate ? "possible" : "out of reach"}</td></tr>`,
        )
        .join("")}</tbody>
    </table>
  </div>

  <h2>What one missed day costs</h2>
  <div class="scn">
    <table>
      <thead><tr><th class="num">At</th><th>Rank</th><th class="num">Points lost</th><th class="num">Clean days to undo</th></tr></thead>
      <tbody>${input.costs
        .map(
          (c) =>
            `<tr><td class="num">${c.atScore}</td><td>${esc(c.rank)}</td><td class="num">${c.pointsLost}</td><td class="num">${c.cleanDaysToUndo ?? "over 400"}</td></tr>`,
        )
        .join("")}</tbody>
    </table>
  </div>

  <h2>The worst you can do and still hold a rank</h2>
  <div class="scn">
    <table>
      <thead><tr><th>Rank</th><th class="num">From</th><th>Holds while</th></tr></thead>
      <tbody>${input.holds
        .map(
          (h) =>
            `<tr><td>${esc(h.rank)}</td><td class="num">${h.from}</td><td>${h.worstRate ? esc(h.worstRate) : "no steady rate of missing holds it"}</td></tr>`,
        )
        .join("")}</tbody>
    </table>
  </div>

  ${
    input.live.length
      ? `<h2>Eight people, ${input.liveDays} days, pressed one at a time</h2>
  <div class="scn">
    <p class="q">This one does not seed events. Each persona presses the real check-in
    endpoint on each simulated day, with the server clock pinned to that day, and the
    nightly job runs at four the next morning. What check-in refuses, refuses here.</p>
    <div class="scroll"><table>
      <thead><tr><th>Persona</th><th>Behaviour</th><th class="num">Presses</th><th class="num">Refused</th><th class="num">Days passed</th><th class="num">Streak</th><th class="num">Best</th><th class="num">Score</th><th>Rank</th></tr></thead>
      <tbody>${input.live
        .map(
          (r) =>
            `<tr><td>${esc(r.persona)}</td><td class="muted">${esc(r.description)}</td>` +
            `<td class="num">${r.presses}</td><td class="num">${r.refused}</td>` +
            `<td class="num">${r.daysPassed} of ${r.daysScored}</td>` +
            `<td class="num">${r.streak}</td><td class="num">${r.best}</td>` +
            `<td class="num strong">${r.score}</td><td>${esc(r.rank)}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
    ${chart(
      input.live
        .slice(0, 3)
        .map((r) => ({ label: r.persona, points: r.curve.map((c) => ({ day: c.day, value: c.value })) })),
    )}
  </div>`
      : ""
  }

  ${body}
</div>`;
}
