// Generates the v3 .dc.html artboards from one source of truth so the shared
// chrome (mark, nav, flame, inputs, headers) stays identical across every screen.
// Run: node .design/build-v3.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));

const C = {
  bg: "#0b0a09",
  surface: "#17150f",
  fg: "#f2f2f2",
  muted: "#8c8c8c",
  rule: "#2e2c28",
  dash: "#4a4740",
  penalty: "#e4574b",
  pass: "#6ba17f",
  accent: "#7fa8ff",
  gold: "#ffd23f",
  flame: "#ff7a2f",
};

// Palette A: built from tokens already in the app.
const PAL_A = ["#8a4f49", "#8c8c8c", "#7fa8ff", "#6ba17f", "#ff7a2f", "#ffd23f"];
// Palette B: a metal climb, rust to gold. More separation between neighbours.
const PAL_B = ["#a8443a", "#a1855a", "#6f9bc4", "#6ba17f", "#e8963c", "#ffd76b"];

const RANKS = [
  { n: "DOUBT", r: "0-99", m: "Your record does not back you" },
  { n: "INTENT", r: "100-349", m: "You have said what you will do" },
  { n: "PRACTICE", r: "350-599", m: "You are doing it, most of the time" },
  { n: "DISCIPLINE", r: "600-849", m: "It holds when it is inconvenient" },
  { n: "UNBROKEN", r: "850-1000", m: "The record has no meaningful gaps" },
  { n: "IMMACULATE", r: "950+", m: "A title inside UNBROKEN, not a rank of its own" },
];

const PAL = PAL_A;
const rc = (i) => PAL[i];

// --- primitives ------------------------------------------------------------

const svg = (w, body, stroke = "currentColor", sw = 1.6) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square">${body}</svg>`;

// The real Curfew mark: the 3a Quorum squares, fourth seat empty (src/app/mark.tsx).
const mark = (size = 15) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges" fill="${C.fg}"><rect x="2" y="2" width="13" height="13"></rect><rect x="17" y="2" width="13" height="13"></rect><rect x="2" y="17" width="13" height="13"></rect></svg>`;

// The app's Flame, gradient and all (src/app/page.tsx).
let seq = 0;
function flame(size = 13) {
  const id = `fl${seq++}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;"><defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#ffc24b"></stop><stop offset="55%" stop-color="#ff7a2f"></stop><stop offset="100%" stop-color="#e4574b"></stop></linearGradient></defs><path d="M12 2c2.5 3.5 4.6 5.6 4.6 9.1a4.6 4.6 0 0 1-9.2 0c0-1.5.5-2.6 1.5-3.7C10.4 8.6 12 6.1 12 2Z" fill="url(#${id})"></path><path d="M12 12.4c1 .9 1.6 1.7 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-.8.5-1.6 1.6-2.8Z" fill="#ffe6a1"></path></svg>`;
}

const grad = (fs, weight = 600) =>
  `font-size:${fs}px;font-weight:${weight};line-height:1;background-image:linear-gradient(95deg,#ffd23f,#ff7a2f,#e4574b);-webkit-background-clip:text;background-clip:text;color:transparent;`;

// Every streak number in the app wears the flame gradient.
function streak(n, { big = false } = {}) {
  if (big)
    return `<span style="display:flex;align-items:center;gap:9px;">${flame(30)}<span style="${grad(30)}">${n}</span></span>`;
  return `<span style="display:flex;align-items:center;gap:4px;">${flame(13)}<span style="${grad(12, 500)}">${n}</span></span>`;
}

const NAV_ICON = {
  home: `<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V20h14V9.5"></path>`,
  activities: `<path d="M10 7h10"></path><path d="M10 12h10"></path><path d="M10 17h10"></path><path d="M3.5 6.6 5 8.1 7.4 5.6"></path><path d="M3.5 11.6 5 13.1 7.4 10.6"></path><path d="M3.5 16.6 5 18.1 7.4 15.6"></path>`,
  groups: `<circle cx="9" cy="8" r="3"></circle><path d="M3.5 20a5.5 5.5 0 0 1 11 0"></path><path d="M16.5 6.2a3 3 0 0 1 0 5.6"></path><path d="M15.5 20a5.5 5.5 0 0 0-1.2-3.5"></path>`,
  stats: `<path d="M4 20V11"></path><path d="M10 20V4"></path><path d="M16 20v-6"></path>`,
  settings: `<line x1="4" y1="8" x2="20" y2="8"></line><line x1="4" y1="16" x2="20" y2="16"></line><circle cx="9" cy="8" r="2.3" fill="${C.bg}"></circle><circle cx="15" cy="16" r="2.3" fill="${C.bg}"></circle>`,
};

const ACT = {
  sleep: `<path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z"></path>`,
  gym: `<path d="M4 9v6"></path><path d="M7 6.5v11"></path><path d="M17 6.5v11"></path><path d="M20 9v6"></path><path d="M7 12h10"></path>`,
  food: `<path d="M3.5 11h11a5.5 5.5 0 0 1-11 0Z"></path><path d="M3.5 19h11"></path><path d="M19 4v16"></path><path d="M19 4c1.6 0 2.5 1.4 2.5 3.2S20.6 10.5 19 10.5"></path>`,
  supplements: `<path d="M6.5 13.5 13.5 6.5a4 4 0 0 1 5.6 5.6l-7 7a4 4 0 0 1-5.6-5.6Z"></path><path d="M10 10l5.6 5.6"></path>`,
  office: `<path d="M4 20V5h10v15"></path><path d="M14 10h6v10"></path><path d="M7 8h1.5"></path><path d="M10 8h1.5"></path><path d="M7 12h1.5"></path><path d="M10 12h1.5"></path><path d="M7 16h4.5"></path>`,
  study: `<path d="M4 5h7v14H4z"></path><path d="M13 5h7v14h-7z"></path><path d="M11 5v14"></path>`,
  steps: `<path d="M6 4c1.6 0 2.5 1.6 2.5 4S8 12.5 6 12.5 3.5 11 3.5 8.5 4.4 4 6 4Z"></path><path d="M4 15h4v3.5H4z"></path><path d="M17 8c1.6 0 2.5 1.6 2.5 4s-.5 4.5-2.5 4.5-2.5-1.5-2.5-4S15.4 8 17 8Z"></path><path d="M15 19h4v2.5h-4z"></path>`,
  water: `<path d="M12 3.2c3.4 4 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 2.6-6 6-10Z"></path>`,
  reading: `<path d="M12 7.2C10 5.4 7.4 4.6 3.5 4.6V18c3.9 0 6.5.8 8.5 2.6"></path><path d="M12 7.2c2-1.8 4.6-2.6 8.5-2.6V18c-3.9 0-6.5.8-8.5 2.6"></path><path d="M12 7.2v13.4"></path>`,
  screen: `<rect x="6" y="2.6" width="12" height="18.8"></rect><path d="M10 5.6h4"></path><path d="M12 10v3.2l2.2 1.6"></path>`,
  nightfast: `<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.4V12l3 2"></path><path d="M6 18 18 6"></path>`,
  sugarfree: `<path d="M4.6 8.6 12 4.4l7.4 4.2v6.8L12 19.6 4.6 15.4Z"></path><path d="M6 18.4 18 5.6"></path>`,
};

const CAM = `<rect x="3" y="6" width="18" height="14"></rect><path d="M8 6l1.5-2h5L16 6"></path><circle cx="12" cy="13" r="3.2"></circle>`;

// --- rank icon candidates --------------------------------------------------

// Set 1, "standing": what your record earns you. Ends on the crown.
function rank1(stage, size = 22, color = "currentColor") {
  const body = [
    `<path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z"></path><path d="M7 18 17 6.6"></path>`,
    `<path d="M6 21V3.5"></path><path d="M6 4.4h11.5l-2.3 3.7 2.3 3.7H6"></path>`,
    `<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="4.3"></circle><circle cx="12" cy="12" r="1" fill="${color}" stroke="none"></circle>`,
    `<path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z"></path>`,
    `<path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z"></path><path d="M8.7 11.8 11.2 14.3 15.6 9.8"></path>`,
    `<path d="M3.2 7.6 7.4 13l4.6-7.6L16.6 13l4.2-5.4V19H3.2Z"></path><path d="M3.2 19h17.6"></path>`,
  ][stage];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">${body}</svg>`;
}

// Set 2, "the climb": where you are on the way up. Also ends on the crown.
function rank2(stage, size = 22, color = "currentColor") {
  const body = [
    `<path d="M9.5 14.5 7 17a3.9 3.9 0 0 1-5.5-5.5l2.5-2.5"></path><path d="M14.5 9.5 17 7a3.9 3.9 0 0 1 5.5 5.5L20 15"></path><path d="M9 15 15 9"></path>`,
    `<path d="M12 21v-8"></path><path d="M12 13C12 9.2 9.2 7 5.5 7c0 3.8 2.7 6 6.5 6Z"></path><path d="M12.5 13c0-3.2 2.4-5.2 5.8-5.2 0 3.2-2.4 5.2-5.8 5.2Z"></path>`,
    `<path d="M4 4.5c1.5 0 2.3 1.5 2.3 3.7S5.8 12.2 4 12.2 1.7 10.8 1.7 8.2 2.5 4.5 4 4.5Z"></path><path d="M2 14.6h4v3.4H2z"></path><path d="M18 8c1.5 0 2.3 1.5 2.3 3.7s-.5 4.1-2.3 4.1-2.3-1.4-2.3-4S16.5 8 18 8Z"></path><path d="M16 18.2h4v3.3h-4z"></path>`,
    `<circle cx="12" cy="4.6" r="2.1"></circle><path d="M12 6.7V21"></path><path d="M7.5 10.5h9"></path><path d="M3.5 14c0 4 3.8 7 8.5 7s8.5-3 8.5-7"></path>`,
    `<path d="M2.5 20 9 7.5 12.4 14 15 9.6 21.5 20Z"></path><path d="M6.6 14.2h4.6"></path>`,
    `<path d="M3.2 7.6 7.4 13l4.6-7.6L16.6 13l4.2-5.4V19H3.2Z"></path><path d="M3.2 19h17.6"></path>`,
  ][stage];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">${body}</svg>`;
}

// PRACTICE candidates, still being chosen.
const PRACTICE = {
  target: `<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="4.3"></circle><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"></circle>`,
  repeat: `<path d="M4 10.5a6 6 0 0 1 6-6h5"></path><path d="M12.5 2 15.5 4.5 12.5 7"></path><path d="M20 13.5a6 6 0 0 1-6 6H9"></path><path d="M11.5 17 8.5 19.5 11.5 22"></path>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5"></rect><path d="M3.5 9.5h17"></path><path d="M8 2.5V6"></path><path d="M16 2.5V6"></path><path d="M8.6 14.6 11 17 15.6 12.4"></path>`,
  stairs: `<path d="M3 20h5v-4h5v-4h5V6h3"></path><path d="M3 20V16"></path>`,
  compass: `<circle cx="12" cy="12" r="8.5"></circle><path d="M15.6 8.4 13.6 13.6 8.4 15.6 10.4 10.4Z"></path>`,
  dots: `<circle cx="5" cy="12" r="2.2" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="2.2"></circle>`,
};
let PRACTICE_PICK = PRACTICE.target; // settled

// The chosen mix: DOUBT and DISCIPLINE from Standing, INTENT and UNBROKEN from
// The Climb, IMMACULATE fixed. PRACTICE is still open.
function rankFinal(stage, size = 22, color = "currentColor") {
  const body = [
    `<path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z"></path><path d="M7 18 17 6.6"></path>`,
    `<path d="M12 21v-8"></path><path d="M12 13C12 9.2 9.2 7 5.5 7c0 3.8 2.7 6 6.5 6Z"></path><path d="M12.5 13c0-3.2 2.4-5.2 5.8-5.2 0 3.2-2.4 5.2-5.8 5.2Z"></path>`,
    PRACTICE_PICK,
    `<path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z"></path><path d="M8.7 11.8 11.2 14.3 15.6 9.8"></path>`,
    `<path d="M2.5 20 9 7.5 12.4 14 15 9.6 21.5 20Z"></path><path d="M6.6 14.2h4.6"></path>`,
    `<path d="M3.2 7.6 7.4 13l4.6-7.6L16.6 13l4.2-5.4V19H3.2Z"></path><path d="M3.2 19h17.6"></path>`,
  ][stage];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">${body}</svg>`;
}

const rank = rankFinal;
const glow = (color) => `filter:drop-shadow(0 0 6px ${color}99);`;

// --- chrome ----------------------------------------------------------------

const TABS = [
  ["home", "Home"],
  ["activities", "Activities"],
  ["groups", "Groups"],
  ["stats", "Stats"],
  ["settings", "Settings"],
];

function nav(active, badges = {}) {
  const items = TABS.map(([key, text]) => {
    const on = key === active;
    const dot = badges[key]
      ? `<span style="position:absolute;top:7px;left:calc(50% + 8px);width:5px;height:5px;border-radius:50%;background:${C.penalty};"></span>`
      : "";
    return `<div style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 0 11px;color:${on ? C.fg : C.muted};">${dot}${svg(19, NAV_ICON[key])}<span style="font-size:10px;">${text}</span></div>`;
  }).join("");
  return `<div style="display:flex;border-top:1px solid ${C.rule};background:${C.bg};">${items}</div>`;
}

function head(title, { back = false, right = "" } = {}) {
  const left = back
    ? `<div style="display:flex;align-items:center;gap:9px;"><span style="color:${C.muted};font-size:14px;">&#8249;</span><span style="font-size:14px;font-weight:600;letter-spacing:0.14em;">${title}</span></div>`
    : `<div style="display:flex;align-items:center;gap:9px;">${mark()}<span style="font-size:14px;font-weight:600;letter-spacing:0.16em;">${title}</span></div>`;
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 11px;border-bottom:1px solid ${C.rule};">${left}${right}</div>`;
}

const adminLink = (on) =>
  `<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:${C.muted};">Admin${on ? `<span style="width:5px;height:5px;border-radius:50%;background:${C.penalty};display:inline-block;align-self:flex-start;margin-top:1px;"></span>` : ""}<span>&#8250;</span></span>`;

function page(body, active, badges) {
  return `<div style="width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">${body}${nav(active, badges)}</div>`;
}

const bare = (body) =>
  `<div style="width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">${body}</div>`;

const scroller = (inner, pad = "18px 20px 24px", gap = 20) =>
  `<div style="flex:1;overflow-y:auto;padding:${pad};display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;

const label = (t) =>
  `<div style="font-size:10px;letter-spacing:0.16em;color:${C.muted};">${t}</div>`;

// `fs` and `pad` mirror the app's button sizes (src/app/ui.tsx): lg is 14px in
// 16, sm is 11.5px in 10.
const btn = (t, { filled = false, wide = true, h = 44, color = null, fs = 14, pad = 16 } = {}) =>
  `<button type="button" style="${wide ? "width:100%;" : `align-self:flex-start;padding:0 ${pad}px;`}height:${h}px;border:1px solid ${filled ? C.fg : C.rule};background:${filled ? C.fg : "transparent"};color:${filled ? C.bg : color || C.fg};font-family:inherit;font-size:${fs}px;font-weight:${filled ? 600 : 400};cursor:pointer;">${t}</button>`;

// Small print, and nothing more. Every board's footnote used to sit in a
// tinted panel with a coloured bar down its side, which is emphasis a footnote
// does not need and which appeared on so many screens that it stopped meaning
// anything. Only a penalty keeps its colour, because that one is a warning.
const note = (t, c = C.accent) =>
  `<div style="font-size:11.5px;color:${c === C.penalty ? C.penalty : C.muted};line-height:1.55;">${t}</div>`;

const chip = (icon, name) =>
  `<span style="border:1px solid ${C.rule};background:${C.surface};padding:6px 11px;font-size:12px;display:flex;align-items:center;gap:7px;">${svg(14, ACT[icon])}${name}</span>`;

const checkbox = (on, text) =>
  `<div style="display:flex;align-items:center;gap:9px;">
    <span style="width:16px;height:16px;border:1px solid ${on ? C.fg : C.rule};background:${on ? C.fg : "transparent"};display:flex;align-items:center;justify-content:center;flex:none;">${on ? svg(11, `<path d="M4 12.5 9 17.5 20 6.5"></path>`, C.bg, 3) : ""}</span>
    <span style="font-size:12px;color:${on ? C.fg : C.muted};">${text}</span>
  </div>`;

const toggle = (on) =>
  `<div style="width:40px;height:22px;border:1px solid ${on ? C.fg : C.rule};background:${on ? C.fg : "transparent"};display:flex;align-items:center;justify-content:${on ? "flex-end" : "flex-start"};padding:2px;flex:none;"><div style="width:16px;height:16px;background:${on ? C.bg : C.muted};"></div></div>`;

// --- form controls ---------------------------------------------------------

const fieldWrap = (l, control, hint = "") =>
  `<div style="display:flex;flex-direction:column;gap:7px;">
    <span style="font-size:11px;letter-spacing:0.06em;color:${C.muted};">${l}</span>
    ${control}
    ${hint ? `<span style="font-size:11px;color:${C.muted};line-height:1.5;">${hint}</span>` : ""}
  </div>`;

const input = (v, unit = "", ph = false) =>
  `<div style="border:1px solid ${C.rule};background:${C.bg};padding:11px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
    <span style="font-size:14px;color:${ph ? C.muted : C.fg};">${v}</span>
    ${unit ? `<span style="font-size:12px;color:${C.muted};">${unit}</span>` : ""}
  </div>`;

const select = (v) =>
  `<div style="border:1px solid ${C.rule};background:${C.bg};padding:11px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
    <span style="font-size:14px;">${v}</span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.muted}" stroke-width="2"><path d="M5 9l7 7 7-7"></path></svg>
  </div>`;

const stepper = (v, unit = "") =>
  `<div style="display:flex;border:1px solid ${C.rule};">
    <div style="width:44px;display:flex;align-items:center;justify-content:center;border-right:1px solid ${C.rule};color:${C.muted};font-size:16px;">&#8722;</div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 0;"><span style="font-size:14px;">${v}</span>${unit ? `<span style="font-size:12px;color:${C.muted};">${unit}</span>` : ""}</div>
    <div style="width:44px;display:flex;align-items:center;justify-content:center;border-left:1px solid ${C.rule};color:${C.muted};font-size:16px;">+</div>
  </div>`;

const segmented = (opts, active) =>
  `<div style="display:flex;border:1px solid ${C.rule};">${opts
    .map(
      (o, i) =>
        `<div style="flex:1;text-align:center;padding:10px 4px;font-size:12.5px;${i === active ? `background:${C.fg};color:${C.bg};` : `color:${C.muted};`}${i ? `border-left:1px solid ${C.rule};` : ""}">${o}</div>`,
    )
    .join("")}</div>`;

const dayCell = (d, on, wide = false) =>
  `<div style="${wide ? "flex:1.5;" : "flex:1;"}height:38px;display:flex;align-items:center;justify-content:center;font-size:11.5px;border:1px solid ${on ? C.fg : C.rule};background:${on ? C.fg : "transparent"};color:${on ? C.bg : C.muted};">${d}</div>`;

// on = an array of 7, or a number meaning "any N a week".
const dayPicker = (on) => {
  const any = typeof on === "number";
  return `<div style="display:flex;flex-direction:column;gap:9px;">
    <div style="display:flex;gap:6px;">
      ${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => dayCell(d, !any && on[i])).join("")}
      ${dayCell("ANY", any, true)}
    </div>
    ${any ? stepper(on, "days a week") : ""}
  </div>`;
};

const timeRange = (a, b) =>
  `<div style="display:flex;align-items:center;gap:9px;">
    <div style="flex:1;border:1px solid ${C.rule};padding:10px 12px;font-size:14px;">${a}</div>
    <span style="font-size:11px;color:${C.muted};">to</span>
    <div style="flex:1;border:1px solid ${C.rule};padding:10px 12px;font-size:14px;">${b}</div>
  </div>`;

// A property of the type: stated, never offered as a control.
const fact = (title, sub) =>
  `<div style="border:1px solid ${C.rule};background:${C.surface};padding:12px 13px;display:flex;flex-direction:column;gap:3px;">
    <span style="font-size:13px;">${title}</span>
    <span style="font-size:11px;color:${C.muted};line-height:1.5;">${sub}</span>
  </div>`;

// Evidence is a property of the type, never a control.
const evidenceFact = (level, source) =>
  `<div style="border:1px solid ${C.rule};background:${C.surface};padding:12px 13px;display:flex;align-items:center;gap:11px;">
    <span style="color:${level === "Required" ? C.fg : C.muted};display:flex;flex:none;">${svg(17, level === "None" ? CAM + `<path d="M4 20 20 4"></path>` : CAM)}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:13px;">${level === "None" ? "No photo" : `Photo ${level.toLowerCase()}`}</span>
      <span style="font-size:11px;color:${C.muted};line-height:1.5;">${source}</span>
    </div>
  </div>`;

// `css` goes into the helmet's own style block, which is where an artboard's
// keyframes have to live: a board that only demonstrates motion cannot do it
// with inline style attributes.
function wrap(inner, css = "") {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${C.bg}; }
    ::-webkit-scrollbar { display: none; }
    * { scrollbar-width: none; -ms-overflow-style: none; }
${css}
  </style>
</helmet>
${inner}
</x-dc>
</body>
</html>
`;
}

const files = {};
const put = (name, inner, css = "") => (files[name] = wrap(inner, css));

// --- home ------------------------------------------------------------------

function activityRow({ icon, name, days, status, action, done = false, off = false }) {
  const right = done
    ? `<span style="display:flex;align-items:center;gap:6px;color:${C.pass};font-size:12px;flex:none;">${svg(15, `<path d="M4 12.5 9 17.5 20 6.5"></path>`)}done</span>`
    : action
      ? `<button type="button" style="height:34px;padding:0 13px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;flex:none;">${action.cam ? svg(14, CAM, C.bg, 1.5) : ""}${action.t}</button>`
      : "";
  return `<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${C.rule};opacity:${off ? 0.42 : 1};">
    <span style="color:${off ? C.muted : C.fg};display:flex;flex:none;">${svg(20, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
      <div style="display:flex;align-items:center;gap:9px;"><span style="font-size:14px;">${name}</span>${days > 0 ? streak(days) : ""}</div>
      <span style="font-size:11.5px;color:${C.muted};">${status}</span>
    </div>${right}</div>`;
}

const balancesBlock = (owe, owed) => `<div style="display:flex;flex-direction:column;gap:10px;">
  ${label("BALANCES")}
  <div style="display:flex;gap:10px;">
    <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
      <span style="font-size:10px;color:${C.muted};">YOU OWE</span>
      <span style="font-size:19px;color:${owe === "0" ? C.muted : C.penalty};">&#8377;${owe}</span>
    </div>
    <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
      <span style="font-size:10px;color:${C.muted};">OWED TO YOU</span>
      <span style="font-size:19px;color:${owed === "0" ? C.muted : C.pass};">&#8377;${owed}</span>
    </div>
  </div>
</div>`;

const groupSummaryRow = (n, s, i) =>
  `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid ${C.rule};"><span style="font-size:14px;">${n}</span><span style="display:flex;align-items:center;gap:8px;color:${rc(i)};">${rank(i, 15, rc(i))}<span style="font-size:13px;">${s}</span></span></div>`;

put(
  "V3Home.dc.html",
  page(
    head("CURFEW", { right: adminLink(true) }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">3</span>
            <span style="font-size:15px;color:${C.muted};">of 5 done</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            ${[1, 1, 1, 0, 0].map((v) => `<div style="flex:1;height:3px;background:${v ? C.fg : C.rule};"></div>`).join("")}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;">
          ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: "Wake window closes 7:45 AM", action: { t: "Check in" } })}
          ${activityRow({ icon: "food", name: "Food", days: 41, status: "2 of 3 meals &middot; 1180 of 2000 cal", action: { t: "Log", cam: true } })}
          ${activityRow({ icon: "study", name: "Study", days: 6, status: "Not logged yet", action: { t: "Check in" } })}
          ${activityRow({ icon: "gym", name: "Gym", days: 12, status: "3 of 3 this week", done: true })}
          ${activityRow({ icon: "supplements", name: "Supplements", days: 9, status: "Logged 8:12 AM", done: true })}
          ${activityRow({ icon: "office", name: "Office", days: 22, status: "Not scheduled today", off: true })}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("BALANCES")}
          <div style="display:flex;gap:10px;">
            <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;color:${C.muted};">YOU OWE</span>
              <span style="font-size:19px;color:${C.penalty};">&#8377;150</span>
            </div>
            <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;color:${C.muted};">OWED TO YOU</span>
              <span style="font-size:19px;color:${C.pass};">&#8377;300</span>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("GROUPS")}
          <div style="display:flex;flex-direction:column;">
            ${groupSummaryRow("Weekend Club", "640", 3)}
            ${groupSummaryRow("Morning Crew", "412", 2)}
          </div>
        </div>`,
      ),
    "home",
    { groups: 1 },
  ),
);

// The notice is a blocking overlay, not a banner. It appears over whatever
// route you are on and the app does nothing until Got it is pressed. There is
// no cross: acknowledging is the only way out, and it is final.
const noticeOverlay = (items) =>
  `<div style="position:absolute;inset:0;background:#0b0a09e6;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="width:100%;border:1px solid ${C.rule};background:${C.bg};display:flex;flex-direction:column;">
      <div style="padding:16px 18px 12px;border-bottom:1px solid ${C.rule};">
        <span style="font-size:10px;letter-spacing:0.16em;color:${C.muted};">WHAT CHANGED</span>
      </div>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:16px;max-height:60vh;overflow-y:auto;">
        ${items
          .map(
            ([title, body]) =>
              `<div style="display:flex;flex-direction:column;gap:5px;">
                <span style="font-size:14px;">${title}</span>
                <span style="font-size:12px;color:${C.muted};line-height:1.6;">${body}</span>
              </div>`,
          )
          .join("")}
      </div>
      <div style="padding:4px 18px 12px;font-size:10.5px;color:${C.muted};">15 Sept &middot; from Curfew</div>
      <div style="padding:0 18px 18px;">
        ${btn("Got it", { filled: true })}
      </div>
    </div>
  </div>`;

const NOTICE_ITEMS = [
  [
    "Money is off",
    "No group is tracking fines for now. What you owe and what you are owed is kept exactly as it was, and comes back if this is switched on again.",
  ],
  ["Screen is available", "A new activity you can add: time on your phone, kept under a limit."],
];

put(
  "V3Notice.dc.html",
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">
    ${head("CURFEW", { right: adminLink(false) })}
    ${scroller(
      `<div style="display:flex;flex-direction:column;gap:6px;">
        ${label("TODAY")}
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="font-size:38px;font-weight:600;line-height:1;">3</span>
          <span style="font-size:15px;color:${C.muted};">of 5 done</span>
        </div>
        <div style="display:flex;gap:4px;margin-top:6px;">
          ${[1, 1, 1, 0, 0].map((v) => `<div style="flex:1;height:3px;background:${v ? C.fg : C.rule};"></div>`).join("")}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;">
        ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: "Wake window closes 7:45 AM", action: { t: "Check in" } })}
        ${activityRow({ icon: "food", name: "Food", days: 41, status: "2 of 3 meals", action: { t: "Log", cam: true } })}
        ${activityRow({ icon: "study", name: "Study", days: 6, status: "Not logged yet", action: { t: "Log", cam: true } })}
        ${activityRow({ icon: "gym", name: "Gym", days: 12, status: "3 of 3 this week", done: true })}
      </div>`,
    )}
    ${nav("home")}
    ${noticeOverlay(NOTICE_ITEMS)}
  </div>`,
);

put(
  "V3NoticeGroups.dc.html",
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">
    ${groupHead("Overview")}
    ${scroller(
      `<div style="display:flex;flex-wrap:wrap;gap:7px;">
        ${chip("sleep", "Sleep")}${chip("gym", "Gym")}${chip("food", "Food")}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${label("MEMBERS &middot; 4")}
        <div style="display:flex;flex-direction:column;">
          ${memberRow("Sam", "812", 3, "Sleep 15 &middot; Gym 24 &middot; Food 60")}
          ${memberRow("You", "640", 3, "Sleep 18 &middot; Gym 12", true)}
          ${memberRow("Alex", "455", 2, "Sleep 9 &middot; Gym 6")}
        </div>
      </div>`,
    )}
    ${nav("groups")}
    ${noticeOverlay(NOTICE_ITEMS)}
  </div>`,
);

// The first screen anyone sees, and the one that has to answer "what does this
// track" without a paragraph. Four real activities, each naming what it
// measures and going straight to setup, beat a block of prose that answers
// neither. The descriptions are the modules' own.
function startRow(icon, name, desc) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid ${C.rule};">
    <span style="display:flex;flex:none;">${svg(20, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:14px;">${name}</span>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.45;">${desc}</span>
    </div>
    <span style="color:${C.muted};font-size:13px;flex:none;">&#8250;</span>
  </div>`;
}

const startList = `<div style="display:flex;flex-direction:column;gap:11px;">
  ${label("PICK ONE TO START")}
  <div style="display:flex;flex-direction:column;">
    ${startRow("sleep", "Sleep", "Three timed check-ins a night")}
    ${startRow("water", "Water", "Glasses through the day")}
    ${startRow("gym", "Gym", "Sessions counted over a week")}
    ${startRow("steps", "Steps", "The number your phone says")}
    <div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid ${C.rule};">
      <span style="flex:1;font-size:13.5px;color:${C.muted};">See every activity</span>
      <span style="color:${C.muted};font-size:13px;flex:none;">&#8250;</span>
    </div>
  </div>
</div>`;

// The invite, when one is waiting. Its own block rather than a line above the
// day's count: who asked, which group, and what a group can ever see. Opening
// it is a link to the join screen, because joining means choosing what to
// share, and that is not a decision to take from a button here.
// Three controls, three different things. Accept opens the join screen, because
// joining means choosing what to share. Decline refuses it, which revokes the
// invite and the sender can see that. The cross only hides it: the invite stays
// pending and a link already in hand still works, it just stops being listed.
//
// The cross exists because clearing a card off your home screen is the wrong
// reason to decline, and the sender cannot tell that apart from a refusal.
const inviteCard = `<div style="border:1px solid ${C.rule};padding:12px 13px;display:flex;flex-direction:column;gap:10px;">
  <div style="display:flex;align-items:flex-start;gap:12px;">
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
      <span style="font-size:10px;letter-spacing:0.16em;color:${C.accent};">AN INVITE</span>
      <span style="font-size:14px;">Night Owls</span>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.45;">Riya Shah invited you</span>
    </div>
    <span style="flex:none;width:28px;height:28px;margin:-4px -4px 0 0;display:flex;align-items:center;justify-content:center;color:${C.muted};">${svg(11, `<path d="M6 6 18 18"></path><path d="M18 6 6 18"></path>`, "currentColor", 2)}</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    ${btn("Accept", { filled: true, wide: false, h: 30, fs: 11.5, pad: 10 })}
    ${btn("Decline", { wide: false, h: 30, fs: 11.5, pad: 10, color: C.penalty })}
  </div>
</div>`;

const emptyToday = `<div style="display:flex;flex-direction:column;gap:3px;">
  ${label("TODAY")}
  <div style="font-size:22px;font-weight:600;line-height:1.3;">You are tracking nothing.</div>
</div>`;

put(
  "V3HomeEmpty.dc.html",
  page(
    head("CURFEW") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="font-size:19px;line-height:1.4;">You are tracking nothing.</div>
        </div>
        <div style="border:1px solid ${C.rule};background:${C.surface};padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="font-size:13px;color:${C.muted};line-height:1.6;">Pick an activity, set what counts as done, and check in. Streaks are yours. Groups come later, and only see what you share.</div>
          ${btn("Add an activity", { filled: true })}
        </div>
        <div style="border:1px solid ${C.rule};padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="font-size:13px;color:${C.muted};line-height:1.6;">Keeping it up alone is harder. Start a group and invite the friends who will notice when you stop.</div>
          ${btn("Create a group")}
        </div>
        ${note("Groups are invite-only. They only ever see the activities you choose to share.")}`,
      ),
    "home",
  ),
);

// The redesign, beside the board it replaces rather than over it.
put(
  "V3HomeStart.dc.html",
  page(
    head("CURFEW") +
      scroller(
        `${emptyToday}
        ${startList}
        ${btn("Create a group")}
        <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Groups are invite-only, and they only ever see the activities you choose to share. Make one and invite the people who will notice when you stop.</span>`,
      ),
    "home",
  ),
);

// The same screen with an invite waiting. The invite goes ABOVE the catalog and
// never instead of it: accepting one while tracking nothing lands on the join
// screen with nothing to share, so the way out of that has to stay in view.
// The bottom note goes, because the invite block already carries that sentence.
put(
  "V3HomeStartInvite.dc.html",
  page(
    head("CURFEW") +
      scroller(
        `${inviteCard}${emptyToday}${startList}${btn("Create a group")}
        <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Groups are invite-only, and they only ever see the activities you choose to share. Make one and invite the people who will notice when you stop.</span>`,
      ),
    "home",
  ),
);

put(
  "V3HomeDone.dc.html",
  page(
    head("CURFEW", { right: adminLink(false) }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">5</span>
            <span style="font-size:15px;color:${C.muted};">of 5 done</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            ${[1, 1, 1, 1, 1].map(() => `<div style="flex:1;height:3px;background:${C.fg};"></div>`).join("")}
          </div>
          <div style="font-size:12px;color:${C.muted};margin-top:8px;">Next window opens 10:00 PM.</div>
        </div>
        <div style="display:flex;flex-direction:column;">
          ${activityRow({ icon: "sleep", name: "Sleep", days: 19, status: "Wake logged 7:02 AM", done: true })}
          ${activityRow({ icon: "food", name: "Food", days: 42, status: "3 meals &middot; 1740 cal", done: true })}
          ${activityRow({ icon: "study", name: "Study", days: 7, status: "Logged 9:10 PM", done: true })}
          ${activityRow({ icon: "gym", name: "Gym", days: 13, status: "4 of 3 this week", done: true })}
          ${activityRow({ icon: "supplements", name: "Supplements", days: 10, status: "Logged 8:12 AM", done: true })}
          ${activityRow({ icon: "office", name: "Office", days: 22, status: "Not scheduled today", off: true })}
        </div>

        ${balancesBlock("150", "300")}

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("GROUPS")}
          <div style="display:flex;flex-direction:column;">
            ${groupSummaryRow("Weekend Club", "644", 3)}
            ${groupSummaryRow("Morning Crew", "419", 2)}
          </div>
        </div>`,
      ),
    "home",
  ),
);

put(
  "V3HomeNoMoney.dc.html",
  page(
    head("CURFEW") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">4</span>
            <span style="font-size:15px;color:${C.muted};">of 5 done</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            ${[1, 1, 1, 1, 0].map((v) => `<div style="flex:1;height:3px;background:${v ? C.fg : C.rule};"></div>`).join("")}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;">
          ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: "Wake window closes 7:45 AM", action: { t: "Check in" } })}
          ${activityRow({ icon: "study", name: "Study", days: 6, status: "Not logged yet", action: { t: "Log", cam: true } })}
          ${activityRow({ icon: "gym", name: "Gym", days: 12, status: "3 of 3 this week", done: true })}
          ${activityRow({ icon: "supplements", name: "Supplements", days: 9, status: "Logged 8:12 AM", done: true })}
          ${activityRow({ icon: "nightfast", name: "Nightfast", days: 11, status: "Did last night hold?", action: { t: "Answer" } })}
          ${activityRow({ icon: "water", name: "Water", days: 23, status: "6 of 8 glasses", action: { t: "+1" } })}
          ${activityRow({ icon: "food", name: "Food", days: 41, status: "3 meals &middot; 1740 cal", done: true })}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("GROUPS")}
          <div style="display:flex;flex-direction:column;">
            ${groupSummaryRow("Morning Crew", "412", 2)}
            ${groupSummaryRow("Deep Work", "204", 1)}
          </div>
        </div>`,
      ),
    "home",
  ),
);

// --- activities ------------------------------------------------------------

function myActivityRow(icon, name, summary, d) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <span style="display:flex;flex:none;">${svg(20, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
      <div style="display:flex;align-items:center;gap:9px;"><span style="font-size:14px;">${name}</span>${streak(d)}</div>
      <span style="font-size:11.5px;color:${C.muted};">${summary}</span>
    </div>
    <span style="color:${C.muted};font-size:13px;flex:none;">&#8250;</span>
  </div>`;
}

put(
  "V3Activities.dc.html",
  page(
    head("ACTIVITIES") +
      scroller(
        `<div style="border:1px solid ${C.rule};padding:14px;display:flex;align-items:center;gap:13px;">
          <span style="color:${rc(3)};display:flex;flex:none;">${rank(3, 30, rc(3))}</span>
          <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:20px;font-weight:600;color:${rc(3)};">712</span><span style="font-size:10.5px;letter-spacing:0.14em;color:${rc(3)};">DISCIPLINE</span></div>
            <span style="font-size:10.5px;color:${C.muted};line-height:1.5;">Your record across everything you track, groups or not. Only you see this.</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("YOURS")}
          <div style="display:flex;flex-direction:column;">
            ${myActivityRow("sleep", "Sleep", "Daily &middot; 3 windows &middot; photo on confirm", 18)}
            ${myActivityRow("food", "Food", "Daily &middot; 3 logs, under 2000 cal", 41)}
            ${myActivityRow("gym", "Gym", "Any 3 per week &middot; photo", 12)}
            ${myActivityRow("supplements", "Supplements", "Daily &middot; once &middot; photo", 9)}
            ${myActivityRow("study", "Study", "Daily &middot; 45 min target", 6)}
            ${myActivityRow("office", "Office", "Mon to Fri", 22)}
          </div>
        </div>
        ${btn("+ Add activity", { filled: true })}`,
      ),
    "activities",
  ),
);

function catalogRow(icon, name, desc, added = false) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid ${C.rule};">
    <span style="display:flex;flex:none;color:${added ? C.muted : C.fg};">${svg(20, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:14px;color:${added ? C.muted : C.fg};">${name}</span>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.45;">${desc}</span>
    </div>
    ${added ? `<span style="font-size:11px;color:${C.muted};flex:none;">tracking</span>` : `<span style="color:${C.fg};font-size:18px;flex:none;line-height:1;">+</span>`}
  </div>`;
}

put(
  "V3Catalog.dc.html",
  page(
    head("ADD ACTIVITY", { back: true }) +
      scroller(
        `<div style="display:flex;flex-direction:column;">
          ${catalogRow("supplements", "Supplements", "One photo a day of what you took")}
          ${catalogRow("office", "Office", "Turning up on the days you said you would")}
          ${catalogRow("study", "Study", "Time at the desk, counted in minutes")}
          ${catalogRow("steps", "Steps", "A daily step count from your watch or phone")}
          ${catalogRow("water", "Water", "Glasses a day, on your word alone")}
          ${catalogRow("reading", "Reading", "Pages or minutes, whichever you count in")}
          ${catalogRow("screen", "Screen", "Time on your phone, kept under a limit")}
          ${catalogRow("nightfast", "Nightfast", "Nothing to eat after the hour you set")}
          ${catalogRow("sugarfree", "Sugar-free", "A day without sugar, declared each night")}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("ALREADY TRACKING")}
          <div style="display:flex;flex-direction:column;">
            ${catalogRow("sleep", "Sleep", "Three timed check-ins a night", true)}
            ${catalogRow("gym", "Gym", "Sessions counted over a week", true)}
            ${catalogRow("food", "Food", "Every meal logged, calories if you want them", true)}
          </div>
        </div>
        ${note("Missing something you track? Ask an admin to add it.", C.muted)}`,
      ),
    "activities",
  ),
);

// --- configure -------------------------------------------------------------

function configure(name, icon, d, best, fields, ev, foot) {
  return page(
    head(name.toUpperCase(), { back: true, right: `<span style="color:${C.muted};">${svg(18, ACT[icon])}</span>` }) +
      scroller(
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          ${streak(d, { big: true })}
          <span style="font-size:11px;color:${C.muted};">days &middot; best ${best}</span>
        </div>
        ${fields}
        ${ev}
        ${foot ? note(foot) : ""}
        ${btn(`Stop tracking ${name}`, { color: C.penalty })}`,
        "18px 20px 24px",
        18,
      ),
    "activities",
  );
}

put(
  "V3CfgSleep.dc.html",
  configure(
    "Sleep",
    "sleep",
    18,
    64,
    `${fact("Judged noon to noon", "A late night belongs to the night before.")}
     ${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Night window", timeRange("10:00 PM", "12:30 AM"))}
     ${fieldWrap("Wake window", timeRange("6:30 AM", "7:45 AM"))}
     ${fieldWrap("Confirm window", timeRange("7:45 AM", "9:00 AM"))}
     ${fieldWrap("Grace", stepper(2, "per month"), "1 left this month.")}`,
    evidenceFact("Required", "On the confirm window. Live camera."),
    "Changes apply from tomorrow.",
  ),
);

put(
  "V3CfgGym.dc.html",
  configure(
    "Gym",
    "gym",
    12,
    31,
    `${fieldWrap("Days", dayPicker(3))}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("Required", "Live camera, on every session."),
    "Changes apply from Monday.",
  ),
);

put(
  "V3CfgFood.dc.html",
  configure(
    "Food",
    "food",
    41,
    41,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Logs required", stepper(3, "per day"))}
     ${fieldWrap("Calorie limit", input("2000", "cal"), "Both must hold to pass.")}
     ${fieldWrap("Grace", stepper(1, "per month"))}`,
    evidenceFact("Required", "Live camera, and the calories with it."),
    "A photo is not proof. It records that you took one in the app, at a server timestamp.",
  ),
);

put(
  "V3CfgSupplements.dc.html",
  configure(
    "Supplements",
    "supplements",
    9,
    9,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Logs required", stepper(1, "per day"))}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("Required", "Live camera. A photo of what you took."),
    "",
  ),
);

put(
  "V3CfgOffice.dc.html",
  configure(
    "Office",
    "office",
    22,
    48,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 0, 0]))}
     ${fieldWrap("Window", timeRange("10:00 AM", "2:00 PM"))}
     ${fieldWrap("Grace", stepper(3, "per month"))}`,
    evidenceFact("Optional", "Live camera."),
    "",
  ),
);

put(
  "V3CfgStudy.dc.html",
  configure(
    "Study",
    "study",
    6,
    22,
    `${fieldWrap("Days", dayPicker(5))}
     ${fieldWrap("Target", stepper(45, "minutes"))}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("Required", "Live camera."),
    "",
  ),
);

put(
  "V3CfgSteps.dc.html",
  configure(
    "Steps",
    "steps",
    31,
    77,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Rule", segmented(["At or above", "At or below"], 0))}
     ${fieldWrap("Target", input("8,000", "steps"))}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("Optional", "Gallery allowed. A shot of your watch or app counts."),
    "Curfew cannot read your watch. The number is yours to enter.",
  ),
);

put(
  "V3CfgWater.dc.html",
  configure(
    "Water",
    "water",
    23,
    23,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Target", stepper(8, "glasses"))}
     ${fieldWrap("Grace", stepper(3, "per month"))}`,
    evidenceFact("None", "Nothing to photograph. This runs on your word."),
    "",
  ),
);

put(
  "V3CfgReading.dc.html",
  configure(
    "Reading",
    "reading",
    14,
    52,
    `${fieldWrap("Days", dayPicker(4))}
     ${fieldWrap("Count in", segmented(["Minutes", "Pages"], 0))}
     ${fieldWrap("Target", stepper(30, "minutes"))}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("Optional", "Live camera. A shot of the page you stopped on."),
    "",
  ),
);

put(
  "V3CfgScreen.dc.html",
  configure(
    "Screen",
    "screen",
    5,
    19,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Rule", segmented(["At or above", "At or below"], 1))}
     ${fieldWrap("Limit", input("3", "hours"))}
     ${fieldWrap("Grace", stepper(3, "per month"))}`,
    evidenceFact("Optional", "Gallery allowed. A screenshot of your phone's own report."),
    "Curfew cannot read your screen time. The number is yours to enter.",
  ),
);

put(
  "V3CfgNightfast.dc.html",
  configure(
    "Nightfast",
    "nightfast",
    11,
    26,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 0, 0]))}
     ${fieldWrap("Nothing after", select("8:00 PM"))}
     ${fieldWrap("Confirm window", timeRange("6:00 AM", "11:00 AM"), "Next morning you say whether it held.")}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("None", "Nothing can prove absence. This runs on your word."),
    "You still check in once a day. Saying nothing is not a pass.",
  ),
);

put(
  "V3CfgSugarfree.dc.html",
  configure(
    "Sugar-free",
    "sugarfree",
    4,
    17,
    `${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
     ${fieldWrap("Confirm window", timeRange("8:00 PM", "11:59 PM"), "End of the day you say whether it held.")}
     ${fieldWrap("Grace", stepper(2, "per month"))}`,
    evidenceFact("None", "Nothing can prove absence. This one runs on your word."),
    "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
  ),
);

put(
  "V3CfgNew.dc.html",
  page(
    head("STEPS", { back: true, right: `<span style="color:${C.muted};">${svg(18, ACT.steps)}</span>` }) +
      scroller(
        `<div style="border:1px solid ${C.rule};background:${C.surface};padding:14px;font-size:12.5px;color:${C.muted};line-height:1.6;">A daily step count from your watch or phone. These are the defaults.</div>
        ${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
        ${fieldWrap("Rule", segmented(["At or above", "At or below"], 0))}
        ${fieldWrap("Target", input("8,000", "steps"))}
        ${fieldWrap("Grace", stepper(2, "per month"))}
        ${evidenceFact("Optional", "Gallery allowed. A shot of your watch or app counts.")}
        ${note("A new activity does not move your reputation for 7 days.", C.pass)}
        ${btn("Start tracking Steps", { filled: true })}`,
        "18px 20px 24px",
        18,
      ),
    "activities",
  ),
);

put(
  "V3CfgErrors.dc.html",
  page(
    head("SLEEP", { back: true, right: `<span style="color:${C.muted};">${svg(18, ACT.sleep)}</span>` }) +
      scroller(
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          ${streak(18, { big: true })}
          <span style="font-size:11px;color:${C.muted};">days &middot; best 64</span>
        </div>
        ${fieldWrap(
          "Night window",
          `<div style="display:flex;align-items:center;gap:9px;">
            <div style="flex:1;border:1px solid ${C.penalty};padding:10px 12px;font-size:14px;">11:00 PM</div>
            <span style="font-size:11px;color:${C.muted};">to</span>
            <div style="flex:1;border:1px solid ${C.penalty};padding:10px 12px;font-size:14px;">10:00 PM</div>
          </div>`,
        )}
        <span style="font-size:11px;color:${C.penalty};line-height:1.5;margin-top:-11px;">The window closes before it opens.</span>
        ${fieldWrap("Wake window", `<div style="display:flex;align-items:center;gap:9px;"><div style="flex:1;border:1px solid ${C.penalty};padding:10px 12px;font-size:14px;">11:30 PM</div><span style="font-size:11px;color:${C.muted};">to</span><div style="flex:1;border:1px solid ${C.penalty};padding:10px 12px;font-size:14px;">1:00 AM</div></div>`)}
        <span style="font-size:11px;color:${C.penalty};line-height:1.5;margin-top:-11px;">Wake overlaps the night window. They cannot share a minute.</span>
        ${fieldWrap("Grace", `<div style="display:flex;flex-direction:column;gap:6px;"><div style="border:1px solid ${C.penalty};background:${C.bg};padding:11px 12px;font-size:14px;">31</div><span style="font-size:11px;color:${C.penalty};line-height:1.5;">Grace cannot be more than the days in a month.</span></div>`)}
        <div style="border-left:3px solid ${C.penalty};background:${C.surface};padding:11px 13px;font-size:11.5px;color:${C.penalty};line-height:1.55;">Three things need fixing before this can be saved.</div>
        <button type="button" style="width:100%;height:44px;border:1px solid ${C.rule};background:transparent;color:${C.muted};font-family:inherit;font-size:14px;cursor:not-allowed;">Save</button>`,
        "18px 20px 24px",
        18,
      ),
    "activities",
  ),
);


// --- evidence and check-in -------------------------------------------------

// One check-in page for every activity that needs anything beyond a tap. The
// photo slot is the only part that changes: optional, or required and blocking.
function checkinPage({ meta, required, shot, fields, canSend, blockedBy }) {
  const slot = shot
    ? `<div style="position:relative;height:186px;background:linear-gradient(145deg,#2b2620,#14120f);border:1px solid ${C.rule};display:flex;align-items:center;justify-content:center;color:#4a4740;font-size:11px;letter-spacing:0.18em;">
        CAPTURED FRAME
        <span style="position:absolute;top:8px;right:8px;width:26px;height:26px;background:${C.penalty};color:${C.bg};display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;">&#10005;</span>
      </div>`
    : `<div style="border:1px dashed ${required ? C.penalty : C.dash};background:${C.surface};height:186px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:${C.muted};">
        ${svg(28, CAM, C.muted, 1.4)}
        <span style="font-size:12.5px;">Take a photo</span>
      </div>`;
  return bare(
    head("CHECK IN", { back: true, right: `<span style="font-size:11px;color:${C.muted};">${meta}</span>` }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:9px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;">
            <span style="font-size:11px;letter-spacing:0.14em;color:${C.muted};">PHOTO</span>
            <span style="font-size:11px;color:${required && !shot ? C.penalty : C.muted};">${required ? "required" : "optional"}</span>
          </div>
          ${slot}
        </div>
        ${fields}
        <div style="flex:1;"></div>
        ${
          canSend
            ? ""
            : `<span style="font-size:11px;color:${C.penalty};line-height:1.5;">${blockedBy || "Take the photo to send this check-in."}</span>`
        }
        <div style="display:flex;gap:10px;">
          <button type="button" style="flex:1;height:46px;border:1px solid ${C.rule};background:transparent;color:${C.penalty};font-family:inherit;font-size:13.5px;cursor:pointer;">Discard</button>
          <button type="button" style="flex:1.6;height:46px;border:1px solid ${canSend ? C.fg : C.rule};background:${canSend ? C.fg : "transparent"};color:${canSend ? C.bg : C.muted};font-family:inherit;font-size:13.5px;font-weight:${canSend ? 600 : 400};cursor:${canSend ? "pointer" : "not-allowed"};">Send</button>
        </div>`,
        "18px 20px 24px",
        18,
      ),
  );
}

put(
  "V3Checkin.dc.html",
  checkinPage({
    meta: "Study &middot; 9:04 PM",
    required: false,
    shot: false,
    canSend: true,
    fields: `${fieldWrap("Minutes studied", input("45", "min"), "Target is 45. Anything at or above counts.")}`,
  }),
);

put(
  "V3CheckinRequired.dc.html",
  checkinPage({
    meta: "Food &middot; meal 3 &middot; 9:04 PM",
    required: true,
    shot: false,
    canSend: false,
    blockedBy: "Take the photo and enter the calories to send this check-in.",
    fields: `${fieldWrap("Calories", `<div style="border:1px solid ${C.penalty};background:${C.bg};padding:11px 12px;font-size:14px;color:${C.muted};">Required</div>`, "1180 so far today. The limit is 2000.")}`,
  }),
);

put(
  "V3CheckinReady.dc.html",
  checkinPage({
    meta: "Food &middot; meal 3 &middot; 9:06 PM",
    required: true,
    shot: true,
    canSend: true,
    fields: `${fieldWrap("Calories", input("520", "cal"), "1700 of 2000 once this is sent.")}`,
  }),
);

put(
  "V3CheckinAbstain.dc.html",
  bare(
    head("CHECK IN", { back: true, right: `<span style="font-size:11px;color:${C.muted};">Nightfast &middot; 7:40 AM</span>` }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:16px;line-height:1.5;">Nothing after 8:00 PM last night. Did it hold?</span>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Nobody can check this one. The record is only worth what your answer is worth.</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button type="button" style="width:100%;height:52px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;">It held</button>
          <button type="button" style="width:100%;height:52px;border:1px solid ${C.rule};background:transparent;color:${C.penalty};font-family:inherit;font-size:15px;cursor:pointer;">I slipped</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule};">
          <span style="font-size:12.5px;color:${C.muted};">Current streak</span>
          ${streak(11)}
        </div>
        <div style="flex:1;"></div>
        ${note("A slip breaks the streak and costs your standing in any group you share this with. It costs nothing else.", C.muted)}`,
        "18px 20px 24px",
        18,
      ),
  ),
);

put(
  "V3Camera.dc.html",
  `<div style="width:390px;height:844px;background:#000;color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;position:relative;">
    <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1c1a17,#0b0a09 60%,#121110);"></div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#3a3733;font-size:12px;letter-spacing:0.2em;">LIVE PREVIEW</div>
    <div style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:20px;">
      <span style="font-size:13px;opacity:0.8;">&#10005;</span>
      <span style="font-size:11px;letter-spacing:0.16em;opacity:0.8;">FOOD &middot; MEAL 3</span>
      <span style="width:13px;"></span>
    </div>
    <div style="flex:1;"></div>
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;padding:0 20px 34px;">
      <span style="font-size:11.5px;opacity:0.65;">Window closes 9:30 PM</span>
      <div style="width:70px;height:70px;border:2px solid ${C.fg};border-radius:50%;display:flex;align-items:center;justify-content:center;">
        <div style="width:56px;height:56px;background:${C.fg};border-radius:50%;"></div>
      </div>
    </div>
  </div>`,
);

put(
  "V3CaptureConfirm.dc.html",
  `<div style="width:390px;height:844px;background:#000;color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px;">
      <span style="font-size:11px;letter-spacing:0.16em;opacity:0.8;">SLEEP &middot; CONFIRM</span>
      <span style="font-size:11px;color:${C.muted};">7:36 AM</span>
    </div>
    <div style="flex:1;margin:0 20px;background:linear-gradient(145deg,#2b2620,#14120f);display:flex;align-items:center;justify-content:center;color:#4a4740;font-size:12px;letter-spacing:0.18em;">CAPTURED FRAME</div>
    <div style="padding:20px;display:flex;gap:10px;">
      <button type="button" style="flex:1;height:46px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:13.5px;cursor:pointer;">Retake</button>
      <button type="button" style="flex:1;height:46px;border:1px solid ${C.rule};background:transparent;color:${C.penalty};font-family:inherit;font-size:13.5px;cursor:pointer;">Discard</button>
      <button type="button" style="flex:1.6;height:46px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;">Save</button>
    </div>
    <div style="padding:0 20px 30px;font-size:11px;color:${C.muted};line-height:1.55;text-align:center;">Nothing is recorded until you save.</div>
  </div>`,
);

// --- groups ----------------------------------------------------------------

function groupHead(active) {
  const tabs = ["Overview", "Evidence", "Standing", "Settings"];
  return `<div style="display:flex;align-items:center;gap:10px;padding:20px 20px 15px;">
    <span style="color:${C.muted};font-size:15px;">&#8249;</span>
    <span style="font-size:16px;font-weight:600;">Weekend Club</span>
  </div>
  <div style="display:flex;padding:0 20px;border-bottom:1px solid ${C.rule};">${tabs
    .map(
      (t) =>
        `<div style="margin-right:22px;font-size:11px;letter-spacing:0.12em;color:${t === active ? C.fg : C.muted};padding-bottom:10px;${t === active ? `box-shadow:inset 0 -2px 0 ${C.fg};` : ""}">${t.toUpperCase()}</div>`,
    )
    .join("")}</div>`;
}

function memberRow(name, score, ri, streaks, you = false) {
  return `<div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid ${C.rule};">
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
      <div style="display:flex;align-items:baseline;gap:7px;"><span style="font-size:14px;">${name}</span>${you ? `<span style="font-size:10px;color:${C.muted};">you</span>` : ""}</div>
      <span style="font-size:11px;color:${C.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${streaks}</span>
    </div>
    <span style="display:flex;align-items:center;gap:8px;color:${rc(ri)};flex:none;">${rank(ri, 17, rc(ri))}<span style="font-size:15px;">${score}</span></span>
  </div>`;
}

put(
  "V3GroupOverview.dc.html",
  page(
    groupHead("Overview") +
      scroller(
        `<div style="display:flex;flex-wrap:wrap;gap:7px;">
          ${chip("sleep", "Sleep")}${chip("gym", "Gym")}${chip("food", "Food")}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MEMBERS &middot; 4")}
          <div style="display:flex;flex-direction:column;">
            ${memberRow("Sam", "812", 3, "Sleep 15 &middot; Gym 24 &middot; Food 60")}
            ${memberRow("You", "640", 3, "Sleep 18 &middot; Gym 12", true)}
            ${memberRow("Alex", "455", 2, "Sleep 9 &middot; Gym 6")}
            ${memberRow("Ravi", "180", 1, "Sleep 2")}
          </div>
        </div>

        <div style="border:1px solid ${C.rule};padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <span style="font-size:12.5px;">You are 640, <span style="color:${rc(3)};letter-spacing:0.1em;">DISCIPLINE</span> here</span>
            <span style="font-size:11px;color:${C.muted};">+4 today &middot; 210 to UNBROKEN</span>
          </div>
          <span style="color:${C.muted};font-size:13px;">&#8250;</span>
        </div>

        <div style="border:1px solid ${C.rule};padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <span style="font-size:12.5px;">This week the group did 34 of 42</span>
            <span style="font-size:11px;color:${C.muted};">Group stats</span>
          </div>
          <span style="color:${C.muted};font-size:13px;">&#8250;</span>
        </div>

        ${btn("Invite someone")}`,
      ),
    "groups",
  ),
);

// Group stats. Four questions a group actually asks: how did we do this week,
// which days were bad, who is carrying it, and what is everyone failing at.
put(
  "V3GroupStats.dc.html",
  page(
    head("GROUP STATS", { back: true, right: `<span style="font-size:11px;color:${C.muted};">Weekend Club</span>` }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("THIS WEEK")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">34</span>
            <span style="font-size:15px;color:${C.muted};">of 42 done</span>
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Every shared activity, every member, counted across the week.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("DAY BY DAY")}
          <div style="display:flex;gap:5px;">
            ${[6, 6, 5, 6, 4, 3, 4]
              .map(
                (v) =>
                  `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
                    <div style="width:100%;height:44px;display:flex;flex-direction:column;justify-content:flex-end;background:${C.rule};">
                      <div style="width:100%;height:${(v / 6) * 100}%;background:${C.fg};"></div>
                    </div>
                    <span style="font-size:10px;color:${C.muted};">${v}</span>
                  </div>`,
              )
              .join("")}
          </div>
          <div style="display:flex;gap:5px;">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span style="flex:1;text-align:center;font-size:10px;color:${C.muted};">${d}</span>`).join("")}</div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Out of 6 a day. Saturday was the worst day for everyone.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MEMBERS THIS WEEK")}
          <div style="display:flex;flex-direction:column;">
            ${[
              ["Sam", 12, 12],
              ["You", 9, 12],
              ["Alex", 8, 12],
              ["Ravi", 5, 6],
            ]
              .map(([n, did, of]) => {
                const pct = Math.round((did / of) * 100);
                return `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
                  <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:9px;">
                      <span style="font-size:13px;">${n}</span>
                      <span style="font-size:11.5px;color:${C.muted};">${did} of ${of}</span>
                    </div>
                    <div style="height:3px;background:${C.rule};"><div style="height:3px;width:${pct}%;background:${C.fg};"></div></div>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Ravi shares one activity, so he has fewer to hit. The share is what compares, not the count.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WHAT THE GROUP FINDS HARD")}
          <div style="display:flex;flex-direction:column;">
            ${[
              ["Sleep", "sleep", 91],
              ["Food", "food", 83],
              ["Gym", "gym", 58],
            ]
              .map(
                ([n, i, pct]) =>
                  `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
                    <span style="display:flex;flex:none;color:${C.muted};">${svg(17, ACT[i])}</span>
                    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:9px;">
                        <span style="font-size:13px;">${n}</span>
                        <span style="font-size:11.5px;color:${C.muted};">${pct}%</span>
                      </div>
                      <div style="height:3px;background:${C.rule};"><div style="height:3px;width:${pct}%;background:${C.fg};"></div></div>
                    </div>
                  </div>`,
              )
              .join("")}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Gym is the one nobody holds. Two members have missed it twice this month.</span>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid ${C.rule};padding:13px;">
          <span style="font-size:12.5px;">Longest streak in the group</span>
          <span style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:${C.muted};">Sam</span>${streak(60)}</span>
        </div>`,
      ),
    "groups",
  ),
);

function evidenceCell(who, when, act) {
  const name = { sleep: "Wake", gym: "Gym", food: "Food", study: "Study" }[act];
  return `<div style="display:flex;flex-direction:column;gap:6px;">
    <div style="aspect-ratio:1;background:linear-gradient(150deg,#26221c,#141210);border:1px solid ${C.rule};"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
      <span style="font-size:11px;">${who}</span>
      <span style="font-size:10px;color:${C.muted};">${when}</span>
    </div>
    <span style="font-size:10px;color:${C.muted};display:flex;align-items:center;gap:5px;">${svg(11, ACT[act])}${name}</span>
  </div>`;
}

put(
  "V3GroupEvidence.dc.html",
  page(
    groupHead("Evidence") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:12px;">
          ${label("TODAY")}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${evidenceCell("Sam", "7:04 AM", "sleep")}
            ${evidenceCell("You", "7:12 AM", "sleep")}
            ${evidenceCell("Alex", "7:40 PM", "gym")}
            ${evidenceCell("Sam", "8:15 PM", "food")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${label("YESTERDAY")}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${evidenceCell("You", "6:58 AM", "sleep")}
            ${evidenceCell("Sam", "6:22 PM", "gym")}
          </div>
        </div>
        ${btn("Load older")}
        ${note("Photos are deleted 30 days after they are taken. Only members you shared the activity with can see them.", C.muted)}`,
      ),
    "groups",
  ),
);

const movements = (rows) =>
  `<div style="display:flex;flex-direction:column;">${rows
    .map(
      ([d, t, a, c]) =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid ${C.rule};"><div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:12.5px;">${t}</span><span style="font-size:10px;color:${C.muted};">${d}</span></div><span style="font-size:13px;color:${c};">${a}</span></div>`,
    )
    .join("")}</div>`;

put(
  "V3GroupStanding.dc.html",
  page(
    groupHead("Standing") +
      scroller(
        `<div style="display:flex;align-items:center;gap:15px;">
          <span style="color:${rc(3)};display:flex;flex:none;">${rank(3, 42, rc(3))}</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:32px;font-weight:600;line-height:1;color:${rc(3)};">640</span>
            <span style="font-size:10.5px;letter-spacing:0.14em;color:${C.muted};">210 TO UNBROKEN</span>
          </div>
          <span style="margin-left:auto;font-size:11px;color:${C.accent};">How it works &#8250;</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MONEY")}
          <div style="border:1px solid ${C.rule};padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:3px;"><span style="font-size:13px;">You owe Sam</span><span style="font-size:11px;color:${C.muted};">2 missed wake windows</span></div>
            <div style="display:flex;align-items:center;gap:11px;"><span style="font-size:15px;color:${C.penalty};">&#8377;100</span><button type="button" style="height:30px;padding:0 11px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:12px;cursor:pointer;">Settle</button></div>
          </div>
          <div style="border:1px solid ${C.rule};padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:3px;"><span style="font-size:13px;">Alex owes you</span><span style="font-size:11px;color:${C.muted};">1 missed gym week</span></div>
            <span style="font-size:15px;color:${C.pass};">&#8377;100</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-top:1px solid ${C.rule};">
            <span style="font-size:12.5px;">Full ledger</span>
            <span style="font-size:11px;color:${C.muted};">every fine and settlement &#8250;</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("CEILING")}
          <div style="height:6px;background:${C.rule};position:relative;">
            <div style="position:absolute;left:0;top:0;bottom:0;width:64%;background:${rc(3)};"></div>
            <div style="position:absolute;left:70%;top:-4px;bottom:-4px;width:1px;background:${C.fg};"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:${C.muted};"><span>0</span><span>ceiling 700</span><span>1000</span></div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">You share 2 of the 3 activities this group accepts. Share Food and the ceiling moves to 1000.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("LAST 7 DAYS")}
          ${movements([
            ["2 Sep", "All shared activities done", "+4", C.pass],
            ["1 Sep", "All shared activities done", "+4", C.pass],
            ["31 Aug", "Missed the wake window", "-9", C.penalty],
            ["30 Aug", "All shared activities done", "+4", C.pass],
            ["29 Aug", "Gym week missed, grace spent", "-9", C.penalty],
          ])}
        </div>
        ${note("Grace saved your gym streak on 29 Aug. It protects neither this number nor the fine.", C.penalty)}`,
      ),
    "groups",
  ),
);

put(
  "V3GroupStandingNoMoney.dc.html",
  page(
    groupHead("Standing") +
      scroller(
        `<div style="display:flex;align-items:center;gap:15px;">
          <span style="color:${rc(2)};display:flex;flex:none;">${rank(2, 42, rc(2))}</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:32px;font-weight:600;line-height:1;color:${rc(2)};">412</span>
            <span style="font-size:10.5px;letter-spacing:0.14em;color:${C.muted};">188 TO DISCIPLINE</span>
          </div>
          <span style="margin-left:auto;font-size:11px;color:${C.accent};">How it works &#8250;</span>
        </div>

        ${note("A miss costs your streak and your standing here.", C.pass)}

        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("CEILING")}
          <div style="height:6px;background:${C.rule};position:relative;">
            <div style="position:absolute;left:0;top:0;bottom:0;width:41%;background:${rc(2)};"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:${C.muted};"><span>0</span><span>ceiling 1000</span><span>1000</span></div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">You share everything this group accepts, so nothing caps you.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("LAST 7 DAYS")}
          ${movements([
            ["2 Sep", "All shared activities done", "+7", C.pass],
            ["1 Sep", "Missed Study", "-13", C.penalty],
            ["31 Aug", "All shared activities done", "+7", C.pass],
            ["30 Aug", "All shared activities done", "+7", C.pass],
          ])}
        </div>`,
      ),
    "groups",
  ),
);

put(
  "V3GroupLedgerFull.dc.html",
  page(
    head("LEDGER", { back: true, right: `<span style="font-size:11px;color:${C.muted};">Weekend Club</span>` }) +
      scroller(
        `<div style="display:flex;gap:10px;">
          <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
            <span style="font-size:10px;color:${C.muted};">YOU OWE</span>
            <span style="font-size:19px;color:${C.penalty};">&#8377;100</span>
          </div>
          <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
            <span style="font-size:10px;color:${C.muted};">OWED TO YOU</span>
            <span style="font-size:19px;color:${C.pass};">&#8377;100</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("EVERY ENTRY")}
          <div style="border:1px solid ${C.rule};">
            ${[
              ["2 Sep", "You missed the wake window", "You to Sam", "&#8377;50", C.penalty],
              ["31 Aug", "Alex missed the gym week", "Alex to you", "&#8377;100", C.pass],
              ["30 Aug", "You missed the wake window", "You to Sam", "&#8377;50", C.penalty],
              ["28 Aug", "Sam settled with you", "Sam to you", "&#8377;150", C.muted],
              ["24 Aug", "Correction: fine raised in error", "Reversed", "&#8377;50", C.muted],
              ["21 Aug", "You missed the gym week", "You to Alex", "&#8377;100", C.penalty],
            ]
              .map(
                ([d, t, who, a, c]) =>
                  `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid ${C.rule};">
                    <div style="display:flex;flex-direction:column;gap:3px;min-width:0;"><span style="font-size:12.5px;">${t}</span><span style="font-size:10px;color:${C.muted};">${d} &middot; ${who}</span></div>
                    <span style="font-size:13px;color:${c};flex:none;">${a}</span>
                  </div>`,
              )
              .join("")}
          </div>
        </div>
        ${note("Entries are never edited or removed. A correction is a new row.", C.muted)}`,
      ),
    "groups",
  ),
);

// One toggle for the activity. Photos are a text choice underneath, and only
// where the type has evidence at all.
function shareRow(name, icon, on, sub, photos) {
  return `<div style="display:flex;flex-direction:column;border-bottom:1px solid ${C.rule};">
    <div style="display:flex;align-items:center;gap:11px;padding:13px 0 ${on && photos !== undefined ? "9px" : "13px"};">
      <span style="display:flex;flex:none;color:${on ? C.fg : C.muted};">${svg(18, ACT[icon])}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
        <span style="font-size:13.5px;">${name}</span>
        <span style="font-size:11px;color:${C.muted};">${sub}</span>
      </div>
      ${toggle(on)}
    </div>
    ${
      on && photos !== undefined
        ? `<div style="display:flex;align-items:center;gap:9px;padding:0 0 13px 29px;">
            <span style="width:16px;height:16px;border:1px solid ${photos ? C.fg : C.rule};background:${photos ? C.fg : "transparent"};display:flex;align-items:center;justify-content:center;flex:none;">${photos ? svg(11, `<path d="M4 12.5 9 17.5 20 6.5"></path>`, C.bg, 3) : ""}</span>
            <span style="font-size:12px;color:${photos ? C.fg : C.muted};">Share evidence with this group</span>
          </div>`
        : ""
    }
  </div>`;
}

put(
  "V3GroupSettings.dc.html",
  page(
    groupHead("Settings") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WHAT YOU SHARE")}
          <div style="display:flex;flex-direction:column;">
            ${shareRow("Sleep", "sleep", true, "18 day streak", true)}
            ${shareRow("Gym", "gym", true, "12 day streak", false)}
            ${shareRow("Food", "food", false, "you track this, it stays private here")}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Sharing more of what the group accepts raises your ceiling. Stopping does not erase your record here, it settles to the lower ceiling.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("ACCEPTED ACTIVITIES &middot; OWNER")}
          <div style="display:flex;flex-direction:column;">
            ${["sleep|Sleep|4 members share", "gym|Gym|3 members share", "food|Food|1 member shares"]
              .map((s) => {
                const [i, n, sub] = s.split("|");
                return `<div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid ${C.rule};">
                  <span style="display:flex;flex:none;">${svg(18, ACT[i])}</span>
                  <div style="flex:1;display:flex;flex-direction:column;gap:3px;"><span style="font-size:13.5px;">${n}</span><span style="font-size:11px;color:${C.muted};">${sub}</span></div>
                  <span style="font-size:11.5px;color:${C.penalty};flex:none;">Remove</span>
                </div>`;
              })
              .join("")}
          </div>
          ${btn("+ Accept another activity")}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MONEY &middot; OWNER")}
          <div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid ${C.rule};">
            <div style="flex:1;display:flex;flex-direction:column;gap:3px;"><span style="font-size:13.5px;">Track money</span><span style="font-size:11px;color:${C.muted};line-height:1.5;">Fines are owed between members, never collected by Curfew</span></div>
            ${toggle(true)}
          </div>
          ${["Sleep|&#8377;50 a miss", "Gym|&#8377;100 a week missed", "Food|no fine"]
            .map((s) => {
              const [n, v] = s.split("|");
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid ${C.rule};"><span style="font-size:13px;">${n}</span><span style="font-size:12.5px;color:${v === "no fine" ? C.muted : C.penalty};">${v}</span></div>`;
            })
            .join("")}
        </div>

        ${btn("Leave group", { color: C.penalty })}`,
      ),
    "groups",
  ),
);

put(
  "V3Groups.dc.html",
  page(
    head("GROUPS") +
      scroller(
        `<div style="border-left:3px solid ${C.accent};background:${C.surface};padding:13px;display:flex;flex-direction:column;gap:10px;">
          <span style="font-size:13px;line-height:1.5;">Priya invited you to <span style="font-weight:600;">Deep Work</span>.</span>
          <div style="display:flex;gap:9px;">
            <button type="button" style="height:34px;padding:0 14px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;">Accept</button>
            <button type="button" style="height:34px;padding:0 14px;border:1px solid ${C.rule};background:transparent;color:${C.penalty};font-family:inherit;font-size:12px;cursor:pointer;">Decline</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("YOUR GROUPS")}
          <div style="display:flex;flex-direction:column;">
            ${[
              ["Weekend Club", "4 members &middot; money on", "640", 3],
              ["Morning Crew", "6 members", "412", 2],
            ]
              .map(
                ([n, s, sc, i]) =>
                  `<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${C.rule};">
                    <span style="color:${C.muted};display:flex;flex:none;">${svg(19, NAV_ICON.groups)}</span>
                    <div style="flex:1;display:flex;flex-direction:column;gap:3px;"><span style="font-size:14px;">${n}</span><span style="font-size:11px;color:${C.muted};">${s}</span></div>
                    <span style="display:flex;align-items:center;gap:8px;color:${rc(i)};flex:none;">${rank(i, 17, rc(i))}<span style="font-size:14px;">${sc}</span></span>
                  </div>`,
              )
              .join("")}
          </div>
        </div>
        ${btn("+ New group")}
        ${note("Groups are invite-only. Nobody finds one by searching.", C.muted)}`,
      ),
    "groups",
    { groups: 1 },
  ),
);

put(
  "V3JoinShare.dc.html",
  page(
    head("JOIN DEEP WORK", { back: true }) +
      scroller(
        `<div style="font-size:12.5px;color:${C.muted};line-height:1.6;">Deep Work tracks three activities. Choose what you send them. You can change this any time.</div>

        <div style="display:flex;flex-direction:column;">
          ${shareRow("Study", "study", true, "you track this &middot; 6 day streak", false)}
          ${shareRow("Office", "office", true, "you track this &middot; 22 day streak", true)}
          <div style="display:flex;flex-direction:column;border-bottom:1px solid ${C.rule};">
            <div style="display:flex;align-items:center;gap:11px;padding:13px 0 8px;">
              <span style="display:flex;flex:none;color:${C.muted};">${svg(18, ACT.supplements)}</span>
              <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                <span style="font-size:13.5px;">Supplements</span>
                <span style="font-size:11px;color:${C.muted};">You do not track this yet</span>
              </div>
              ${toggle(false)}
            </div>
            <div style="padding:0 0 13px 29px;">
              <button type="button" style="height:32px;padding:0 12px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:12px;cursor:pointer;">Set it up first</button>
            </div>
          </div>
        </div>

        <div style="border:1px solid ${C.rule};padding:13px;display:flex;flex-direction:column;gap:7px;">
          <span style="font-size:12.5px;">Sharing 2 of 3 caps your score at 750.</span>
          <span style="font-size:11px;color:${C.muted};line-height:1.55;">You start at 200, <span style="color:${rc(1)};">INTENT</span>.</span>
        </div>
        ${btn("Join group", { filled: true })}`,
      ),
    "groups",
    { groups: 1 },
  ),
);

put(
  "V3JoinSetup.dc.html",
  page(
    head("SUPPLEMENTS", { back: true, right: `<span style="color:${C.muted};">${svg(18, ACT.supplements)}</span>` }) +
      scroller(
        `<div style="border:1px solid ${C.rule};background:${C.surface};padding:14px;font-size:12.5px;color:${C.muted};line-height:1.6;">Deep Work accepts this. Set it up for yourself first, then it can be shared. It stays yours either way.</div>
        ${fieldWrap("Period", segmented(["Day", "Week"], 0))}
        ${fieldWrap("Days", dayPicker([1, 1, 1, 1, 1, 1, 1]))}
        ${fieldWrap("Logs required", stepper(1, "per day"))}
        ${fieldWrap("Grace", stepper(2, "per month"))}
        ${evidenceFact("Required", "Live camera. A photo of what you took.")}
        ${btn("Add and share with Deep Work", { filled: true })}
        ${btn("Add for myself only")}`,
        "18px 20px 24px",
        18,
      ),
    "groups",
    { groups: 1 },
  ),
);

// --- ranks -----------------------------------------------------------------

put(
  "V3Ranks.dc.html",
  page(
    head("HOW REPUTATION WORKS", { back: true }) +
      scroller(
        `<div style="border:1px solid ${C.rule};padding:14px;display:flex;align-items:center;gap:13px;">
          <span style="color:${rc(3)};display:flex;flex:none;">${rank(3, 30, rc(3))}</span>
          <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:20px;font-weight:600;color:${rc(3)};">640</span><span style="font-size:10.5px;letter-spacing:0.14em;color:${rc(3)};">DISCIPLINE</span></div>
            <span style="font-size:10.5px;color:${C.muted};">In Weekend Club. 210 to UNBROKEN.</span>
          </div>
        </div>
        <div style="font-size:12.5px;color:${C.muted};line-height:1.6;">Reputation runs 0 to 1000 in each group. Everyone starts at 200. It moves a little every day: up when the day is clean, down when it is not. Sharing more of what a group accepts raises how high you can climb.</div>
        <div style="display:flex;flex-direction:column;">
          ${[4, 3, 2, 1, 0]
            .map((i) => {
              const r = RANKS[i];
              return `<div style="display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid ${C.rule};">
                <span style="color:${rc(i)};display:flex;flex:none;">${rank(i, 26, rc(i))}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                  <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:13.5px;letter-spacing:0.12em;color:${rc(i)};">${r.n}</span><span style="font-size:11px;color:${C.muted};">${r.r}</span></div>
                  <span style="font-size:11px;color:${C.muted};">${r.m}</span>
                </div>
              </div>`;
            })
            .join("")}
          <div style="display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid ${C.rule};">
            <span style="color:${C.gold};display:flex;flex:none;${glow(C.gold)}">${rank(5, 26, C.gold)}</span>
            <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
              <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:13.5px;letter-spacing:0.12em;color:${C.gold};">IMMACULATE</span><span style="font-size:11px;color:${C.muted};">950+</span></div>
              <span style="font-size:11px;color:${C.muted};">${RANKS[5].m}</span>
            </div>
          </div>
        </div>
        ${note("1000 is approached, not reached. Grace saves a streak. It never saves this number.", C.muted)}`,
      ),
    "groups",
  ),
);

// --- rank icon sheets ------------------------------------------------------

const PRACTICE_OPTIONS = [
  ["Target", "target", "Aim and repetition. Reads at any size, and it is the most common icon for this idea, which cuts both ways."],
  ["Repeat", "repeat", "Two arrows going round. Practice as the thing you do again, which is exactly what a streak is."],
  ["Calendar, checked", "calendar", "Days ticked off. The most literal, and the busiest at 14px."],
  ["Stairs", "stairs", "Steps upward. Sits naturally between the sprout and the shield."],
  ["Compass", "compass", "Heading somewhere on purpose. Distinct, but it says direction more than repetition."],
  ["Dots, two filled", "dots", "Progress through a set. Quietest of the six, and nearly invisible at small sizes."],
];

// --- stats -----------------------------------------------------------------
//
// Chart parameters come from the app's own tokens, not a generic palette. Two
// colour jobs appear here and no others:
//   sequential  one hue, rule to flame, for "how much of the day did you do"
//   status      pass and penalty, which sit at deltaE 7.1 for deuteranopia, so
//               every status cell also carries a mark. Colour never works alone.
const HEAT = ["#221f1b", "#4a3524", "#7d4d26", "#b35f27", "#ff7a2f"];

const statTile = (v, l, color = C.fg) =>
  `<div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:5px;">
    <span style="font-size:19px;font-weight:600;line-height:1;color:${color};">${v}</span>
    <span style="font-size:9.5px;letter-spacing:0.08em;color:${C.muted};line-height:1.4;">${l}</span>
  </div>`;

// Eight weeks of days, each shaded by the share of that day's activities passed.
function heatmap(weeks) {
  return `<div style="display:flex;flex-direction:column;gap:9px;">
    <div style="display:flex;gap:3px;">${weeks
      .map(
        (w) =>
          `<div style="flex:1;display:flex;flex-direction:column;gap:3px;">${w
            .map(
              (v) =>
                `<div style="width:100%;aspect-ratio:1;background:${v < 0 ? "transparent" : HEAT[v]};${v < 0 ? `border:1px solid ${C.rule};` : ""}"></div>`,
            )
            .join("")}</div>`,
      )
      .join("")}</div>
    <div style="display:flex;align-items:center;gap:7px;">
      <span style="font-size:10px;color:${C.muted};">none</span>
      ${HEAT.map((c) => `<div style="width:14px;height:8px;background:${c};"></div>`).join("")}
      <span style="font-size:10px;color:${C.muted};">all</span>
      <span style="margin-left:auto;font-size:10px;color:${C.muted};">8 weeks</span>
    </div>
  </div>`;
}

// Every one of these goes to that activity's own chart, and the first drawing
// of it said so nowhere: no chevron and no press state, on a row shaped exactly
// like Home's, which is not a link. So nobody pressed one. The chevron is the
// same mark the starter rows and the photo strip use.
const passBar = (name, icon, pct, d) =>
  `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
    <span style="display:flex;flex:none;color:${C.muted};">${svg(17, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:9px;">
        <span style="font-size:13px;">${name}</span>
        <span style="display:flex;align-items:center;gap:9px;"><span style="font-size:11.5px;color:${C.muted};">${pct}%</span>${streak(d)}</span>
      </div>
      <div style="height:3px;background:${C.rule};"><div style="height:3px;width:${pct}%;background:${C.fg};"></div></div>
    </div>
    <span style="flex:none;font-size:13px;color:${C.muted};">&rsaquo;</span>
  </div>`;

// A section header with its own hint on the right, as YOUR PHOTOS carries
// "All ›". The chevrons are 12px on the far edge of a dense row, which is not
// enough on its own to tell anyone the row is a door.
const labelHint = (t, hint) =>
  `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">${label(t)}${label(hint)}</div>`;

put(
  "V3Stats.dc.html",
  page(
    head("STATS") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("PERFECT DAYS THIS MONTH")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">17</span>
            <span style="font-size:15px;color:${C.muted};">of 30</span>
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">A perfect day is every activity that was scheduled, done.</span>
        </div>

        <div style="display:flex;gap:10px;">
          ${statTile("83%", "PERIODS PASSED, 30 DAYS")}
          ${statTile("41", "LONGEST RUNNING STREAK", C.flame)}
          ${statTile("4", "GRACE LEFT THIS MONTH")}
        </div>

        <div style="display:flex;flex-direction:column;gap:11px;">
          ${label("EVERY DAY, HOW MUCH OF IT")}
          ${heatmap([
            [2, 4, 4, 3, 4, 1, 2],
            [4, 4, 3, 4, 4, 2, 3],
            [3, 2, 4, 4, 1, 0, 2],
            [4, 4, 4, 4, 4, 3, 4],
            [2, 3, 4, 3, 4, 4, 2],
            [4, 4, 2, 4, 3, 1, 3],
            [3, 4, 4, 4, 4, 4, 4],
            [4, 4, 3, -1, -1, -1, -1],
          ])}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${labelHint("BY ACTIVITY, LAST 30 DAYS", "TAP FOR THE CHART")}
          <div style="display:flex;flex-direction:column;">
            ${passBar("Food", "food", 97, 41)}
            ${passBar("Water", "water", 90, 23)}
            ${passBar("Office", "office", 86, 22)}
            ${passBar("Sleep", "sleep", 78, 18)}
            ${passBar("Gym", "gym", 71, 12)}
            ${passBar("Nightfast", "nightfast", 64, 11)}
            ${passBar("Study", "study", 43, 6)}
          </div>
        </div>`,
      ),
    "stats",
  ),
);

const activityPicker = (icon, name) =>
  `<div style="border:1px solid ${C.rule};background:${C.bg};padding:11px 12px;display:flex;align-items:center;gap:10px;">
    <span style="display:flex;flex:none;">${svg(17, ACT[icon])}</span>
    <span style="flex:1;font-size:14px;">${name}</span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.muted}" stroke-width="2"><path d="M5 9l7 7 7-7"></path></svg>
  </div>`;

const weekdayBars = (vals) =>
  `<div style="display:flex;flex-direction:column;gap:9px;">
    <div style="display:flex;align-items:flex-end;gap:6px;height:70px;">
      ${vals.map((v) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;"><div style="height:${v}%;background:${C.fg};"></div></div>`).join("")}
    </div>
    <div style="display:flex;gap:6px;">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span style="flex:1;text-align:center;font-size:10px;color:${C.muted};">${d}</span>`).join("")}</div>
  </div>`;

const statsPage = (name, icon, body) =>
  page(head("STATS") + scroller(`${activityPicker(icon, name)}${body}`, "18px 20px 24px", 22), "stats");

put(
  "V3StatsSleep.dc.html",
  statsPage(
    "Sleep",
    "sleep",
    `<div style="display:flex;flex-direction:column;gap:11px;">
      ${label("WAKE TIME, 21 DAYS")}
      <div style="position:relative;height:132px;border-left:1px solid ${C.rule};border-bottom:1px solid ${C.rule};">
        <div style="position:absolute;left:0;right:0;top:34%;height:26%;background:#6ba17f1f;border-top:1px dashed ${C.pass};border-bottom:1px dashed ${C.pass};"></div>
        ${[52, 44, 60, 47, 41, 72, 68, 45, 50, 43, 55, 48, 39, 63, 58, 46, 51, 44, 42, 66, 49]
          .map(
            (v, i) =>
              `<div style="position:absolute;left:${5 + i * 4.4}%;top:${v}%;width:7px;height:7px;background:${v > 60 || v < 34 ? C.penalty : C.fg};transform:translate(-50%,-50%);"></div>`,
          )
          .join("")}
        <span style="position:absolute;right:6px;top:36%;font-size:9.5px;color:${C.pass};">window</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:${C.muted};"><span>6:00 AM</span><span>7:45 AM</span><span>9:00 AM</span></div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Four mornings landed outside the window. Descriptive only, this never ranks anyone.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:11px;">
      ${label("PASS RATE BY WEEKDAY")}
      ${weekdayBars([86, 90, 82, 78, 64, 40, 55])}
    </div>

    <div style="display:flex;gap:10px;">
      ${statTile("18", "CURRENT STREAK", C.flame)}
      ${statTile("64", "BEST")}
      ${statTile("1", "GRACE LEFT")}
    </div>`,
  ),
);

put(
  "V3StatsSteps.dc.html",
  statsPage(
    "Steps",
    "steps",
    `<div style="display:flex;flex-direction:column;gap:11px;">
      ${label("STEPS A DAY, 21 DAYS")}
      <div style="position:relative;height:132px;">
        <div style="position:absolute;left:0;right:0;bottom:55%;border-top:1px dashed ${C.accent};"></div>
        <span style="position:absolute;right:0;bottom:57%;font-size:9.5px;color:${C.accent};">target 8,000</span>
        <div style="display:flex;align-items:flex-end;gap:4px;height:100%;">
          ${[62, 70, 44, 81, 58, 35, 66, 74, 52, 90, 61, 47, 68, 77, 39, 84, 56, 63, 71, 48, 88]
            .map((v) => `<div style="flex:1;height:${v}%;background:${v >= 55 ? C.fg : C.rule};"></div>`)
            .join("")}
        </div>
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Bars at or above the line passed. Seven days fell short.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:11px;">
      ${label("PASS RATE BY WEEKDAY")}
      ${weekdayBars([70, 74, 66, 72, 58, 88, 80])}
    </div>

    <div style="display:flex;gap:10px;">
      ${statTile("31", "CURRENT STREAK", C.flame)}
      ${statTile("77", "BEST")}
      ${statTile("9,140", "AVERAGE A DAY")}
    </div>`,
  ),
);

put(
  "V3StatsGym.dc.html",
  statsPage(
    "Gym",
    "gym",
    `<div style="display:flex;flex-direction:column;gap:11px;">
      ${label("SESSIONS A WEEK, 10 WEEKS")}
      <div style="position:relative;height:132px;">
        <div style="position:absolute;left:0;right:0;bottom:47%;border-top:1px dashed ${C.accent};"></div>
        <span style="position:absolute;right:0;bottom:49%;font-size:9.5px;color:${C.accent};">minimum 3</span>
        <div style="display:flex;align-items:flex-end;gap:7px;height:100%;">
          ${[3, 4, 3, 2, 5, 3, 6, 3, 4, 3]
            .map(
              (v) =>
                `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;justify-content:flex-end;height:100%;">
                  <span style="font-size:10px;color:${v >= 3 ? C.muted : C.penalty};">${v}</span>
                  <div style="width:100%;height:${(v / 6) * 84}%;background:${v >= 3 ? C.fg : C.rule};"></div>
                </div>`,
            )
            .join("")}
        </div>
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">One week fell short. Grace covered it, so the run held.</span>
    </div>

    <div style="display:flex;gap:10px;">
      ${statTile("12", "CURRENT STREAK", C.flame)}
      ${statTile("31", "BEST")}
      ${statTile("3.6", "SESSIONS A WEEK")}
    </div>

    <div style="display:flex;flex-direction:column;gap:11px;">
      ${label("WHICH DAYS YOU GO")}
      ${weekdayBars([64, 30, 72, 26, 58, 40, 18])}
    </div>`,
  ),
);

const heldCell = (state) => {
  if (state === -1) return `<div style="flex:1;aspect-ratio:1;border:1px solid ${C.rule};"></div>`;
  const on = state === 1;
  const glyph = on
    ? `<path d="M4 12.5 9 17.5 20 6.5"></path>`
    : `<path d="M6 6 18 18"></path><path d="M18 6 6 18"></path>`;
  return `<div style="flex:1;aspect-ratio:1;border:1px solid ${on ? C.pass : C.penalty};background:${on ? "#6ba17f26" : "#e4574b26"};display:flex;align-items:center;justify-content:center;color:${on ? C.pass : C.penalty};">${svg(11, glyph, "currentColor", 2.6)}</div>`;
};

put(
  "V3StatsAbstain.dc.html",
  statsPage(
    "Nightfast",
    "nightfast",
    `<div style="display:flex;flex-direction:column;gap:11px;">
      ${label("HELD OR SLIPPED, 5 WEEKS")}
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${[
          [1, 1, 1, 0, 1, -1, -1],
          [1, 1, 1, 1, 1, -1, -1],
          [1, 0, 1, 1, 0, -1, -1],
          [1, 1, 1, 1, 1, -1, -1],
          [1, 1, 1, -1, -1, -1, -1],
        ]
          .map((w) => `<div style="display:flex;gap:5px;">${w.map(heldCell).join("")}</div>`)
          .join("")}
      </div>
      <div style="display:flex;gap:5px;">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span style="flex:1;text-align:center;font-size:10px;color:${C.muted};">${d}</span>`).join("")}</div>
      <div style="display:flex;align-items:center;gap:14px;">
        <span style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:${C.muted};"><span style="color:${C.pass};display:flex;">${svg(11, `<path d="M4 12.5 9 17.5 20 6.5"></path>`, "currentColor", 2.6)}</span>held</span>
        <span style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:${C.muted};"><span style="color:${C.penalty};display:flex;">${svg(11, `<path d="M6 6 18 18"></path><path d="M18 6 6 18"></path>`, "currentColor", 2.6)}</span>slipped</span>
        <span style="margin-left:auto;font-size:10.5px;color:${C.muted};">weekends off</span>
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Three slips in five weeks, all on your own word. There is nothing here to verify.</span>
    </div>

    <div style="display:flex;gap:10px;">
      ${statTile("11", "CURRENT STREAK", C.flame)}
      ${statTile("26", "BEST")}
      ${statTile("2", "GRACE LEFT")}
    </div>

    <div style="display:flex;flex-direction:column;gap:11px;">
      ${label("PASS RATE BY WEEKDAY")}
      ${weekdayBars([88, 76, 82, 60, 44, 0, 0])}
    </div>`,
  ),
);

// --- settings --------------------------------------------------------------

function setRow(k, v, danger = false) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <span style="font-size:13.5px;color:${danger ? C.penalty : C.fg};">${k}</span>
    <span style="font-size:12.5px;color:${C.muted};display:flex;align-items:center;gap:8px;">${v}<span>&#8250;</span></span>
  </div>`;
}

put(
  "V3Settings.dc.html",
  page(
    head("SETTINGS") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:8px;">
          ${label("APPEARANCE")}
          ${segmented(["Dark", "Light"], 0)}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("PERSONAL")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Timezone", "Asia/Kolkata")}
            ${setRow("Activities", "6 tracked")}
            ${setRow("What you share", "2 groups")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("YOUR DATA")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Photo retention", "30 days")}
            ${setRow("How reputation works", "")}
            ${setRow("What Curfew stores", "")}
            ${setRow("Delete data", "")}
          </div>
        </div>
        ${btn("Sign out")}`,
      ),
    "settings",
  ),
);

put(
  "V3SettingsSharing.dc.html",
  page(
    head("WHAT YOU SHARE", { back: true }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WEEKEND CLUB")}
          <div style="display:flex;flex-direction:column;">
            ${shareRow("Sleep", "sleep", true, "18 day streak", true)}
            ${shareRow("Gym", "gym", true, "12 day streak", false)}
            ${shareRow("Food", "food", false, "private here")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MORNING CREW")}
          <div style="display:flex;flex-direction:column;">
            ${shareRow("Sleep", "sleep", true, "18 day streak", false)}
            ${shareRow("Study", "study", true, "6 day streak", true)}
          </div>
        </div>
        ${note("Photos off leaves your streak shared. Turning an activity off keeps your record in that group, it just stops growing.", C.muted)}`,
      ),
    "settings",
  ),
);

put(
  "V3Data.dc.html",
  page(
    head("DELETE DATA", { back: true }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:8px;">
          ${label("PHOTOS")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Delete a single photo", "")}
            ${setRow("Delete all photos", "412 stored")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("HISTORY")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Delete one activity's history", "")}
            ${setRow("Delete all habit history", "")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("ACCOUNT")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Delete my account", "", true)}
          </div>
        </div>
        ${note("Money owed is never deleted. You owe &#8377;150 in Weekend Club. Ledger entries stay, and your name stays on them, so the people involved can still see who owes what.", C.penalty)}
        ${note("Photos go within minutes. Habit history goes with them. Nothing here can be undone.", C.muted)}`,
      ),
    "settings",
  ),
);

// Every photograph a person has taken, in one place. Read-only: deleting stays
// on one screen, so there is a single place where something goes for good.
const ownPhoto = (act, date) =>
  `<div style="display:flex;flex-direction:column;gap:6px;">
    <div style="aspect-ratio:1;background:linear-gradient(150deg,#26221c,#141210);border:1px solid ${C.rule};"></div>
    <span style="font-size:10px;color:${C.muted};display:flex;align-items:center;gap:5px;">${svg(11, ACT[act])}${{ sleep: "Sleep", gym: "Gym", food: "Food", study: "Study", steps: "Steps" }[act]}</span>
    <span style="font-size:10px;color:${C.muted};">${date}</span>
  </div>`;

put(
  "V3SettingsPhotos.dc.html",
  page(
    head("YOUR PHOTOS", { back: true }) +
      scroller(
        `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          ${ownPhoto("sleep", "3 Sep")}${ownPhoto("food", "3 Sep")}${ownPhoto("gym", "2 Sep")}
          ${ownPhoto("food", "2 Sep")}${ownPhoto("study", "2 Sep")}${ownPhoto("sleep", "1 Sep")}
          ${ownPhoto("steps", "1 Sep")}${ownPhoto("food", "31 Aug")}${ownPhoto("gym", "30 Aug")}
        </div>
        <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">412 photos. Each one is deleted 30 days after it was taken. Delete one sooner on the delete data screen.</span>`,
      ),
    "settings",
  ),
);

// --- admin -----------------------------------------------------------------
//
// The console has its own chrome: a sub-nav, never the bottom tab bar.
function adminPage(active, body, bar, overlay) {
  const tabs = ["Overview", "Users", "Groups", "Insights", "Controls", "Ops", "Reports"];
  const chrome = `<div style="display:flex;align-items:center;gap:9px;padding:20px 20px 15px;">
      ${mark()}<span style="font-size:14px;font-weight:600;letter-spacing:0.16em;">ADMIN</span>
      <span style="margin-left:auto;font-size:11px;color:${C.muted};">Back to app &#8250;</span>
    </div>
    <div style="display:flex;padding:0 20px;border-bottom:1px solid ${C.rule};">${tabs
      .map(
        (t) =>
          `<div style="margin-right:12px;font-size:9.5px;letter-spacing:0.08em;color:${t === active ? C.fg : C.muted};padding-bottom:10px;${t === active ? `box-shadow:inset 0 -2px 0 ${C.fg};` : ""}">${t.toUpperCase()}</div>`,
      )
      .join("")}</div>`;
  return `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">${chrome}${scroller(body)}${bar || ""}${overlay || ""}</div>`;
}

const kpi = (v, l, color = C.fg) =>
  `<div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:5px;">
    <span style="font-size:19px;font-weight:600;line-height:1;color:${color};">${v}</span>
    <span style="font-size:9.5px;letter-spacing:0.08em;color:${C.muted};line-height:1.4;">${l}</span>
  </div>`;

const adminRow = (a, b, c = "") =>
  `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid ${C.rule};">
    <div style="display:flex;flex-direction:column;gap:3px;min-width:0;">
      <span style="font-size:13px;">${a}</span>
      ${b ? `<span style="font-size:10.5px;color:${C.muted};">${b}</span>` : ""}
    </div>
    ${c ? `<span style="font-size:11.5px;color:${C.muted};flex:none;">${c}</span>` : ""}
  </div>`;

put(
  "V3AdminOverview.dc.html",
  adminPage(
    "Overview",
    `<div style="display:flex;gap:10px;">
      ${kpi("128", "USERS")}
      ${kpi("31", "GROUPS")}
      ${kpi("7", "PENDING INVITES", C.penalty)}
    </div>
    <div style="display:flex;gap:10px;">
      ${kpi("412", "ACTIVITIES TRACKED")}
      ${kpi("2.4 GB", "EVIDENCE STORED")}
      ${kpi("94%", "CHECK-INS SCORED")}
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("LAST NIGHT'S RUN")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Scoring", "1,204 periods closed", "ok")}
        ${adminRow("Reputation", "128 users recomputed", "ok")}
        ${adminRow("Retention sweep", "318 photos deleted", "ok")}
        ${adminRow("Drift check", "3 periods differ from stored", "review")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("PENDING APPROVALS &middot; 3")}
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[
          ["priya@example.com", "invited by Sam &middot; Weekend Club &middot; 2 Sep"],
          ["ravi@example.com", "invited by Alex &middot; Deep Work &middot; 1 Sep"],
          ["noor@example.com", "invited by Sam &middot; Morning Crew &middot; 31 Aug"],
        ]
          .map(
            ([e, sub]) =>
              `<div style="border:1px solid ${C.rule};padding:13px;display:flex;flex-direction:column;gap:11px;">
                <div style="display:flex;flex-direction:column;gap:3px;">
                  <span style="font-size:13px;">${e}</span>
                  <span style="font-size:10.5px;color:${C.muted};">${sub}</span>
                </div>
                <div style="display:flex;gap:9px;">
                  <button type="button" style="height:32px;padding:0 14px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;">Approve</button>
                  <button type="button" style="height:32px;padding:0 14px;border:1px solid ${C.rule};background:transparent;color:${C.penalty};font-family:inherit;font-size:12px;cursor:pointer;">Reject</button>
                </div>
              </div>`,
          )
          .join("")}
      </div>
    </div>`,
  ),
);

put(
  "V3AdminUsers.dc.html",
  adminPage(
    "Users",
    `<div style="border:1px solid ${C.rule};background:${C.bg};padding:11px 12px;display:flex;align-items:center;gap:10px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${C.muted}" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="M16.5 16.5 21 21"></path></svg>
      <span style="font-size:13.5px;color:${C.muted};">Search by name or email</span>
    </div>
    <div style="display:flex;gap:7px;">
      ${["All", "Active", "Pending", "Banned"].map((t, i) => `<span style="border:1px solid ${i === 0 ? C.fg : C.rule};background:${i === 0 ? C.fg : "transparent"};color:${i === 0 ? C.bg : C.muted};padding:6px 11px;font-size:11.5px;">${t}</span>`).join("")}
    </div>
    <div style="display:flex;flex-direction:column;">
      ${[
        ["Sam Verma", "sam@example.com &middot; 3 groups &middot; 6 activities", "active"],
        ["Alex Rao", "alex@example.com &middot; 2 groups &middot; 4 activities", "active"],
        ["Priya N", "priya@example.com &middot; invited 2 Sep", "pending"],
        ["Ravi K", "ravi@example.com &middot; 1 group &middot; 1 activity", "active"],
        ["Noor A", "noor@example.com &middot; invited 31 Aug", "pending"],
      ]
        .map(
          ([n, sub, st]) =>
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid ${C.rule};">
              <div style="display:flex;flex-direction:column;gap:3px;min-width:0;">
                <span style="font-size:13.5px;">${n}</span>
                <span style="font-size:10.5px;color:${C.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sub}</span>
              </div>
              <span style="font-size:10.5px;color:${st === "pending" ? C.penalty : C.muted};flex:none;">${st}</span>
            </div>`,
        )
        .join("")}
    </div>
    ${note("A user's activities and evidence are never visible here. Admin sees that they exist, not what they contain.", C.muted)}`,
  ),
);

const toggleRow = (title, sub, on, pending = false) =>
  `<div style="display:flex;align-items:center;gap:11px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:13.5px;color:${on ? C.fg : C.muted};">${title}</span>
        ${pending ? `<span style="font-size:9.5px;letter-spacing:0.1em;color:${C.penalty};border:1px solid ${C.penalty};padding:1px 5px;">UNSAVED</span>` : ""}
      </div>
      <span style="font-size:10.5px;color:${C.muted};line-height:1.5;">${sub}</span>
    </div>
    ${toggle(on)}
  </div>`;

// Nothing on Controls saves on the flip. The bar appears when something changed.
const saveBar = (n) =>
  `<div style="border-top:1px solid ${C.rule};background:${C.surface};padding:13px 20px;display:flex;align-items:center;gap:10px;">
    <span style="flex:1;font-size:11.5px;color:${C.muted};">${n} unsaved ${n === 1 ? "change" : "changes"}</span>
    <button type="button" style="height:38px;padding:0 15px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:12.5px;cursor:pointer;">Discard</button>
    <button type="button" style="height:38px;padding:0 15px;border:1px solid ${C.penalty};background:${C.penalty};color:${C.bg};font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;">Save</button>
  </div>`;

// Built from whatever is pending: one block a change, its new state, and what
// that change actually does. Nothing here is written for a particular switch.
const confirmOverlay = (changes) =>
  `<div style="position:absolute;inset:0;background:#0b0a09d9;display:flex;align-items:flex-end;">
    <div style="width:100%;max-height:78%;background:${C.bg};border-top:1px solid ${C.penalty};display:flex;flex-direction:column;">
      <div style="padding:20px 20px 6px;">
        <span style="font-size:16px;font-weight:600;">Save ${changes.length} ${changes.length === 1 ? "change" : "changes"}?</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 20px;display:flex;flex-direction:column;">
        ${changes
          .map(
            ([name, state, why]) =>
              `<div style="display:flex;flex-direction:column;gap:8px;padding:14px 0;border-top:1px solid ${C.rule};">
                <div style="display:flex;align-items:center;gap:9px;">
                  <span style="font-size:13.5px;">${name}</span>
                  <span style="font-size:9.5px;letter-spacing:0.1em;color:${state === "on" ? C.pass : C.penalty};border:1px solid ${state === "on" ? C.pass : C.penalty};padding:1px 6px;">${state.toUpperCase()}</span>
                </div>
                ${why
                  .map(
                    (l) =>
                      `<div style="display:flex;gap:9px;"><span style="color:${C.muted};font-size:11px;line-height:1.65;">&#8226;</span><span style="flex:1;font-size:12px;color:${C.muted};line-height:1.6;">${l}</span></div>`,
                  )
                  .join("")}
              </div>`,
          )
          .join("")}
      </div>
      <div style="padding:14px 20px 20px;display:flex;flex-direction:column;gap:12px;border-top:1px solid ${C.rule};">
        ${checkbox(false, "Tell users what changed")}
        <span style="font-size:11px;color:${C.muted};line-height:1.55;">A switch hides a system. Nothing here deletes data, and switching back restores what was hidden.</span>
        <div style="display:flex;gap:10px;">
          <button type="button" style="flex:1;height:46px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:13.5px;cursor:pointer;">Cancel</button>
          <button type="button" style="flex:1;height:46px;border:1px solid ${C.penalty};background:${C.penalty};color:${C.bg};font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;">Save changes</button>
        </div>
      </div>
    </div>
  </div>`;


put(
  "V3AdminControls.dc.html",
  adminPage(
    "Controls",
    `<div style="display:flex;flex-direction:column;gap:10px;">
      ${label("THE APP")}
      <div style="display:flex;flex-direction:column;">
        ${toggleRow("Money", "Off hides money everywhere except groups you switch on by hand under Groups.", false, true)}
        ${toggleRow("Photo evidence", "Off means no type can ask for a photo. Existing photos are untouched.", true)}
        ${toggleRow("New groups", "Off stops anyone creating a group. Existing ones carry on.", true)}
        ${toggleRow("Invites", "Off stops every invite going out. Nobody new can join.", true)}
        ${toggleRow("Sign-ups", "Off means an approved invite is the only way in.", false)}
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">A switch here takes effect at once and never deletes anything. Turning money off hides it; turning it back on brings the same balances back.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("ACTIVITY TYPES")}
      <div style="display:flex;flex-direction:column;">
        ${[
          ["sleep", "Sleep", 96, true],
          ["food", "Food", 74, true],
          ["gym", "Gym", 68, true],
          ["water", "Water", 51, true],
          ["office", "Office", 44, true],
          ["study", "Study", 39, true],
          ["steps", "Steps", 33, true],
          ["supplements", "Supplements", 21, true],
          ["nightfast", "Nightfast", 17, true],
          ["reading", "Reading", 14, true],
          ["sugarfree", "Sugar-free", 9, true],
          ["screen", "Screen", 5, true],
        ]
          .map(
            ([i, n, users, on]) =>
              `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
                <span style="display:flex;flex:none;color:${on ? C.fg : C.muted};">${svg(18, ACT[i])}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                  <span style="font-size:13.5px;color:${on ? C.fg : C.muted};">${n}</span>
                  <span style="font-size:10.5px;color:${C.muted};">${users} tracking</span>
                </div>
                ${toggle(on)}
              </div>`,
          )
          .join("")}
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Off hides a type from the catalog. Anyone already tracking it keeps it. The list is every type the app has: adding one is a code change, not a setting.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("EVIDENCE")}
      ${fieldWrap("Retention", stepper(30, "days"))}
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Shortening this deletes anything already older on the next sweep.</span>
    </div>`,
    saveBar(2),
  ),
);

put(
  "V3AdminControlsConfirm.dc.html",
  adminPage(
    "Controls",
    `<div style="display:flex;flex-direction:column;gap:10px;">
      ${label("THE APP")}
      <div style="display:flex;flex-direction:column;">
        ${toggleRow("Money", "Off means no group can turn on fines and no ledger is written anywhere.", false, true)}
        ${toggleRow("Photo evidence", "Off means no type can ask for a photo. Existing photos are untouched.", true)}
        ${toggleRow("New groups", "Off stops anyone creating a group. Existing ones carry on.", true)}
        ${toggleRow("Invites", "Off stops every invite going out. Nobody new can join.", true)}
        ${toggleRow("Sign-ups", "Off means an approved invite is the only way in.", false)}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("ACTIVITY TYPES")}
      <div style="display:flex;flex-direction:column;">
        ${[
          ["sleep", "Sleep", 96, true],
          ["food", "Food", 74, true],
          ["gym", "Gym", 68, true],
          ["screen", "Screen", 5, true],
        ]
          .map(
            ([i, n, users, on]) =>
              `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
                <span style="display:flex;flex:none;">${svg(18, ACT[i])}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                  <span style="font-size:13.5px;">${n}</span>
                  <span style="font-size:10.5px;color:${C.muted};">${users} tracking</span>
                </div>
                ${toggle(on)}
              </div>`,
          )
          .join("")}
      </div>
    </div>`,
    saveBar(2),
    confirmOverlay([
      [
        "Money",
        "off",
        [
          "9 groups track money right now. All of them stop tonight.",
          "41 members lose sight of what they owe until this is back on.",
          "Balances and every ledger entry stay exactly as they are.",
        ],
      ],
      [
        "Screen",
        "on",
        [
          "Appears in the catalog for all 128 users at once.",
          "The 5 already tracking it are unaffected.",
        ],
      ],
    ]),
  ),
);

put(
  "V3AdminGroups.dc.html",
  adminPage(
    "Groups",
    `<div style="border:1px solid ${C.rule};background:${C.bg};padding:11px 12px;display:flex;align-items:center;gap:10px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${C.muted}" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="M16.5 16.5 21 21"></path></svg>
      <span style="font-size:13.5px;color:${C.muted};">Search groups</span>
    </div>
    <div style="display:flex;gap:7px;">
      ${["All", "Active", "Money on", "Archived"].map((t, i) => `<span style="border:1px solid ${i === 0 ? C.fg : C.rule};background:${i === 0 ? C.fg : "transparent"};color:${i === 0 ? C.bg : C.muted};padding:6px 11px;font-size:11.5px;">${t}</span>`).join("")}
    </div>

    ${note("Money is off app-wide. A group switched on here keeps it, and its members still see everything about money.", C.penalty)}

    <div style="display:flex;flex-direction:column;">
      ${[
        ["Weekend Club", "4 members &middot; 3 types &middot; owner Sam", true, false],
        ["Morning Crew", "6 members &middot; 2 types &middot; owner Alex", false, false],
        ["Deep Work", "3 members &middot; 3 types &middot; owner Priya", false, false],
        ["Night Shift", "5 members &middot; 1 type &middot; owner Noor", false, true],
      ]
        .map(
          ([n, sub, money, archived]) =>
            `<div style="display:flex;flex-direction:column;gap:10px;padding:14px 0;border-bottom:1px solid ${C.rule};opacity:${archived ? 0.5 : 1};">
              <div style="display:flex;align-items:center;gap:11px;">
                <span style="display:flex;flex:none;color:${C.muted};">${svg(18, NAV_ICON.groups)}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:13.5px;">${n}</span>
                    ${archived ? `<span style="font-size:9.5px;letter-spacing:0.1em;color:${C.muted};border:1px solid ${C.rule};padding:1px 5px;">ARCHIVED</span>` : ""}
                  </div>
                  <span style="font-size:10.5px;color:${C.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sub}</span>
                </div>
                <span style="font-size:11px;color:${C.muted};flex:none;">${archived ? "" : "Archive"}</span>
              </div>
              ${
                archived
                  ? ""
                  : `<div style="display:flex;align-items:center;gap:11px;padding-left:29px;">
                      <span style="flex:1;font-size:11.5px;color:${money ? C.fg : C.muted};">Money${money ? ", on by exception" : ""}</span>
                      ${toggle(money)}
                    </div>`
              }
            </div>`,
        )
        .join("")}
    </div>

    ${note("Archiving freezes a group: no check-ins count toward it, no fines, nobody can join. Nothing is deleted and it can be brought back.", C.muted)}`,
  ),
);

const trend = (vals, color = C.fg) =>
  `<div style="display:flex;align-items:flex-end;gap:3px;height:52px;">${vals
    .map((v) => `<div style="flex:1;height:${v}%;background:${color};"></div>`)
    .join("")}</div>`;

const insightRow = (name, icon, pct, sub) =>
  `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
    <span style="display:flex;flex:none;color:${C.muted};">${svg(17, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:9px;">
        <span style="font-size:13px;">${name}</span>
        <span style="font-size:11.5px;color:${C.muted};">${sub}</span>
      </div>
      <div style="height:3px;background:${C.rule};"><div style="height:3px;width:${pct}%;background:${C.fg};"></div></div>
    </div>
  </div>`;

put(
  "V3AdminInsights.dc.html",
  adminPage(
    "Insights",
    `<div style="display:flex;gap:10px;">
      ${kpi("74", "CHECKED IN TODAY")}
      ${kpi("58%", "OF ALL USERS")}
      ${kpi("11", "SILENT 7 DAYS", C.penalty)}
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("CHECK-INS A DAY, 30 DAYS")}
      ${trend([48, 55, 61, 44, 70, 66, 52, 74, 68, 59, 77, 71, 63, 80, 75, 58, 69, 84, 72, 66, 88, 79, 61, 74, 90, 82, 70, 76, 93, 85])}
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Rising. Weekends are the dips.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("WHAT PEOPLE ACTUALLY HOLD")}
      <div style="display:flex;flex-direction:column;">
        ${insightRow("Supplements", "supplements", 92, "92% pass")}
        ${insightRow("Sleep", "sleep", 81, "81% pass")}
        ${insightRow("Water", "water", 77, "77% pass")}
        ${insightRow("Office", "office", 74, "74% pass")}
        ${insightRow("Gym", "gym", 55, "55% pass")}
        ${insightRow("Nightfast", "nightfast", 49, "49% pass")}
        ${insightRow("Study", "study", 41, "41% pass")}
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Study is the type people add and then stop hitting. Worth asking whether its defaults are wrong.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("ABANDONED WITHIN 14 DAYS")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Study", "38% stop tracking it", "38%")}
        ${adminRow("Screen", "31% stop tracking it", "31%")}
        ${adminRow("Gym", "22% stop tracking it", "22%")}
        ${adminRow("Sleep", "6% stop tracking it", "6%")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("GROUPS")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Active this week", "at least one shared check-in", "24 of 31")}
        ${adminRow("Dormant a month", "no check-ins from anyone", "4")}
        ${adminRow("Tracking money", "the rest are reputation only", "9 of 31")}
        ${adminRow("Median size", "members per group", "4")}
      </div>
    </div>

    ${note("Everything here is counted, never read. No screen in admin shows what a check-in contained or what a photo is of.", C.muted)}`,
  ),
);

put(
  "V3AdminOps.dc.html",
  adminPage(
    "Ops",
    `<div style="display:flex;flex-direction:column;gap:10px;">
      ${label("RECOMPUTE")}
      ${fieldWrap("Range", timeRange("1 Aug", "3 Sep"))}
      <div style="display:flex;gap:10px;">
        ${btn("Verify", { wide: false })}
        ${btn("Rebuild", { wide: false })}
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Verify recomputes and reports what differs. Rebuild writes the result.</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("DRIFT, LAST RUN")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("28 Aug &middot; Sam &middot; Gym", "stored pass, recomputed fail", "review")}
        ${adminRow("24 Aug &middot; Alex &middot; Sleep", "stored fail, recomputed pass", "review")}
        ${adminRow("21 Aug &middot; Ravi &middot; Food", "grace applied twice", "review")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("EVIDENCE")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Stored", "2.4 GB across 8,912 photos", "")}
        ${adminRow("Retention", "deleted after 30 days", "")}
        ${adminRow("Last sweep", "318 deleted, 0 failed", "3 Sep")}
        ${adminRow("Orphaned objects", "none", "ok")}
      </div>
    </div>

    ${note("Rebuild rewrites derived tables only. Events and ledger entries are never touched.", C.penalty)}`,
  ),
);

// --- what a check-in looks like once it has landed -------------------------
//
// Until now Send navigated away in silence, which is the worst moment to be
// silent: a photo has just been taken and uploaded, and the person has no idea
// whether any of it counted.
//
// The first answer drawn for this was a receipt on its own screen, and it was
// wrong twice over. It left Home to say something Home already knew, and a
// receipt is a document rather than a moment. Both boards below happen over
// Home instead, because that is where the eye goes next and it already holds
// every number that just moved.
//
// The constraint both work inside: Curfew does not congratulate. The warmth
// comes from the record itself, the streak number and the flame it already
// wears, never from a sentence saying you did well.

// Home the instant after a check-in. Four of five, and Gym has flipped to
// done. `doneCount` of 5 is the complete day.
const homeAfter = (doneCount = 4) =>
  head("CURFEW", { right: adminLink(false) }) +
  scroller(
    `<div style="display:flex;flex-direction:column;gap:6px;">
      ${label("TODAY")}
      <div style="display:flex;align-items:baseline;gap:10px;">
        <span style="font-size:38px;font-weight:600;line-height:1;">${doneCount}</span>
        <span style="font-size:15px;color:${C.muted};">of 5 done</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;">
        ${[1, 1, 1, 1, doneCount === 5 ? 1 : 0].map((v) => `<div style="flex:1;height:3px;background:${v ? C.fg : C.rule};"></div>`).join("")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;">
      ${activityRow({ icon: "gym", name: "Gym", days: 13, status: "3 of 3 this week", done: true })}
      ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: doneCount === 5 ? "Logged 7:02 AM" : "Window opens 10:00 PM", action: doneCount === 5 ? null : { t: "Check in" }, done: doneCount === 5 })}
      ${activityRow({ icon: "food", name: "Food", days: 41, status: "3 of 3 meals", done: true })}
      ${activityRow({ icon: "study", name: "Study", days: 6, status: "Logged 4:20 PM", done: true })}
      ${activityRow({ icon: "supplements", name: "Supplements", days: 9, status: "Logged 8:12 AM", done: true })}
      ${activityRow({ icon: "office", name: "Office", days: 22, status: "Not scheduled today", off: true })}
    </div>`,
  );

// Home, the bottom nav, and an optional dim over the lot.
const over = (body, dim = 0) =>
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;overflow:hidden;">
    ${body}
    ${nav("home")}
    ${dim ? `<div style="position:absolute;inset:0;background:rgba(11,10,9,${dim});"></div>` : ""}`;

// A partial day gets nothing over the top. The row is the feedback: the count
// rolls 3 to 4, the fourth segment fills, the row flips to done and the flame
// ticks up, all inside about 400ms, with a mark down the left of the row that
// changed so the eye finds it.
//
// It costs no screen and interrupts nothing, which is the only reason it still
// holds up when someone logs four glasses of water in a minute. Anything that
// takes the screen would be wallpaper by the third glass.
put(
  "V3Recorded.dc.html",
  over(
    head("CURFEW", { right: adminLink(false) }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <!-- One slot, two numbers: the old one lifts out of it as the new
                 one rises into it. Side by side the number that stays would sit
                 a digit right of where it belongs. -->
            <span style="position:relative;display:flex;line-height:1;">
              <span style="position:absolute;left:0;top:0;font-size:38px;font-weight:600;line-height:1;color:${C.muted};opacity:0.3;transform:translateY(-6px);">3</span>
              <span style="font-size:38px;font-weight:600;line-height:1;">4</span>
            </span>
            <span style="font-size:15px;color:${C.muted};">of 5 done</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <div style="flex:1;height:3px;background:${C.fg};"></div>
            <div style="flex:1;height:3px;background:${C.fg};"></div>
            <div style="flex:1;height:3px;background:${C.fg};"></div>
            <div style="flex:1;height:3px;background:${C.rule};display:flex;"><div style="width:55%;background:${C.pass};"></div></div>
            <div style="flex:1;height:3px;background:${C.rule};"></div>
          </div>
          <span style="font-size:11px;color:${C.muted};margin-top:5px;">the count rolls and the fourth segment fills, left to right</span>
        </div>

        <div style="display:flex;flex-direction:column;">
          <div style="border-left:2px solid ${C.pass};padding-left:11px;">
            ${activityRow({ icon: "gym", name: "Gym", days: 13, status: "Recorded 6:48 PM &middot; 3 of 3 this week", done: true })}
          </div>
          ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: "Window opens 10:00 PM", action: { t: "Check in" } })}
          ${activityRow({ icon: "food", name: "Food", days: 41, status: "3 of 3 meals", done: true })}
          ${activityRow({ icon: "study", name: "Study", days: 6, status: "Logged 4:20 PM", done: true })}
          ${activityRow({ icon: "supplements", name: "Supplements", days: 9, status: "Logged 8:12 AM", done: true })}
          ${activityRow({ icon: "office", name: "Office", days: 22, status: "Not scheduled today", off: true })}
        </div>`,
      ),
  ) + `</div>`,
);

// The complete day is the one moment that earns a screen, and it fires when
// the last scheduled activity closes: once a day at most, and on a bad day
// never. That scarcity is what stops it becoming wallpaper.
//
// A clerk stamps the form, not the line item, so the stamp lands on the date.
// The five icons under it are the day's list compressed to one line, because a
// table of ticks and tiles is a report and this is not a report. Holds a beat,
// fades, no button to press.
//
// Home is dimmed to 93% rather than blacked out: the rows stay faintly legible
// behind the stamp, so it reads as something that happened to the screen you
// were on instead of a place you were sent to.
put(
  "V3DayComplete.dc.html",
  over(homeAfter(5), 0.93) +
    `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;">
      <div style="transform:rotate(-7deg);border:3px solid ${C.pass};padding:16px 30px;display:flex;flex-direction:column;align-items:center;gap:6px;">
        <span style="font-size:38px;font-weight:600;letter-spacing:0.08em;color:${C.pass};">COMPLETE</span>
        <span style="font-size:12px;letter-spacing:0.24em;color:${C.pass};opacity:0.75;">3 SEPTEMBER</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        ${["gym", "sleep", "food", "study", "supplements"]
          .map((i) => `<span style="display:flex;color:${C.pass};opacity:0.85;">${svg(17, ACT[i])}</span>`)
          .join("")}
      </div>
      <span style="font-size:12.5px;color:${C.muted};">Everything you scheduled, done.</span>
    </div>
  </div>`,
);

// --- the two motions, running --------------------------------------------
//
// These two boards animate. Everything else in this canvas is a still, and a
// still cannot answer the only question worth asking about a stamp, which is
// whether it lands or whether it merely appears. Both loop, with a bar at the
// foot showing where in the cycle you are.
//
// The numbers are the ones in src/app/globals.css. If one moves there and not
// here, the board is lying, so they are named in the caption on both.

const cycleBar = (seconds, color) =>
  `<div style="position:absolute;left:0;right:0;bottom:0;height:2px;background:${C.rule};">
    <div class="sweep" style="height:2px;background:${color};animation-duration:${seconds}s;"></div>
  </div>`;

const motionCaption = (text) =>
  `<div style="position:absolute;left:0;right:0;bottom:74px;display:flex;justify-content:center;">
    <span style="font-size:10px;letter-spacing:0.14em;color:${C.muted};background:${C.bg};padding:3px 9px;border:1px solid ${C.rule};">${text}</span>
  </div>`;

// The stamp, landing. It falls from oversize, overshoots three percent under
// its resting size, settles, holds, and goes. That overshoot is the frame that
// reads as impact: without it the stamp only grows, and a thing that grows
// reads as a thing appearing rather than a thing landing.
put(
  "V3DayCompleteMotion.dc.html",
  over(homeAfter(5)) +
    `<div class="stamp-overlay" style="position:absolute;inset:0;background:rgba(11,10,9,0.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;">
      <div class="stamp" style="border:3px solid ${C.pass};padding:16px 30px;display:flex;flex-direction:column;align-items:center;gap:6px;">
        <span style="font-size:38px;font-weight:600;letter-spacing:0.08em;color:${C.pass};">COMPLETE</span>
        <span style="font-size:12px;letter-spacing:0.24em;color:${C.pass};opacity:0.75;">3 SEPTEMBER</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        ${["gym", "sleep", "food", "study", "supplements"]
          .map((i) => `<span style="display:flex;color:${C.pass};opacity:0.85;">${svg(17, ACT[i])}</span>`)
          .join("")}
      </div>
      <span style="font-size:12.5px;color:${C.muted};">Everything you scheduled, done.</span>
    </div>
    ${motionCaption("340MS IN &middot; 2.6S HOLD &middot; LOOPING")}
    ${cycleBar(5.2, C.pass)}
  </div>`,
  `
    @keyframes stamp-cycle {
      0%   { opacity: 0; transform: rotate(-7deg) scale(1.35); }
      3.9% { opacity: 1; transform: rotate(-7deg) scale(0.97); }
      6.5% { opacity: 1; transform: rotate(-7deg) scale(1); }
      100% { opacity: 1; transform: rotate(-7deg) scale(1); }
    }
    @keyframes overlay-cycle {
      0%     { opacity: 0; }
      4.2%   { opacity: 1; }
      56.5%  { opacity: 1; }
      63.5%  { opacity: 0; }
      100%   { opacity: 0; }
    }
    @keyframes sweep { from { width: 0%; } to { width: 100%; } }
    .stamp { animation: stamp-cycle 5.2s cubic-bezier(0.2, 0.9, 0.3, 1) infinite; }
    .stamp-overlay { animation: overlay-cycle 5.2s linear infinite; }
    .sweep { animation-name: sweep; animation-timing-function: linear; animation-iteration-count: infinite; }
  `,
);

// The partial day, moving. No overlay: the old count lifts away, the new one
// rises into its place, the segment it filled grows left to right, and the row
// that changed carries a rule for four seconds. Then Home is just Home again,
// which is the point of it.
put(
  "V3RecordedMotion.dc.html",
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;overflow:hidden;">
    ${head("CURFEW", { right: adminLink(false) })}
    ${scroller(
      `<div style="display:flex;flex-direction:column;gap:6px;">
        ${label("TODAY")}
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="position:relative;display:flex;line-height:1;">
            <span class="ghost" style="position:absolute;left:0;top:0;font-size:38px;font-weight:600;line-height:1;color:${C.muted};">3</span>
            <span class="fresh" style="font-size:38px;font-weight:600;line-height:1;">4</span>
          </span>
          <span style="font-size:15px;color:${C.muted};">of 5 done</span>
        </div>
        <div style="display:flex;gap:4px;margin-top:6px;">
          <div style="flex:1;height:3px;background:${C.fg};"></div>
          <div style="flex:1;height:3px;background:${C.fg};"></div>
          <div style="flex:1;height:3px;background:${C.fg};"></div>
          <div style="flex:1;height:3px;background:${C.rule};display:flex;"><div class="grow" style="height:3px;background:${C.fg};"></div></div>
          <div style="flex:1;height:3px;background:${C.rule};"></div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;">
        <div class="marked" style="padding-left:11px;margin-left:-11px;">
          ${activityRow({ icon: "gym", name: "Gym", days: 13, status: "Recorded 6:48 PM &middot; 3 of 3 this week", done: true })}
        </div>
        ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: "Window opens 10:00 PM", action: { t: "Check in" } })}
        ${activityRow({ icon: "food", name: "Food", days: 41, status: "3 of 3 meals", done: true })}
        ${activityRow({ icon: "study", name: "Study", days: 6, status: "Logged 4:20 PM", done: true })}
        ${activityRow({ icon: "supplements", name: "Supplements", days: 9, status: "Logged 8:12 AM", done: true })}
        ${activityRow({ icon: "office", name: "Office", days: 22, status: "Not scheduled today", off: true })}
      </div>`,
    )}
    ${nav("home")}
    ${motionCaption("ROLL 400MS &middot; RULE HELD 4.2S &middot; LOOPING")}
    ${cycleBar(6, C.pass)}
  </div>`,
  `
    @keyframes ghost-cycle {
      0%    { opacity: 0.35; transform: translateY(0); }
      23.3% { opacity: 0; transform: translateY(-8px); }
      100%  { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes fresh-cycle {
      0%   { opacity: 0; transform: translateY(9px); }
      6.7% { opacity: 1; transform: translateY(0); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes grow-cycle {
      0%   { width: 0%; }
      7.5% { width: 100%; }
      100% { width: 100%; }
    }
    @keyframes rule-cycle {
      0%   { border-left-color: ${C.pass}; }
      70%  { border-left-color: ${C.pass}; }
      75%  { border-left-color: transparent; }
      100% { border-left-color: transparent; }
    }
    @keyframes sweep { from { width: 0%; } to { width: 100%; } }
    .ghost  { animation: ghost-cycle 6s ease-in infinite; }
    .fresh  { animation: fresh-cycle 6s ease-out infinite; }
    .grow   { animation: grow-cycle 6s ease-out infinite; }
    .marked { border-left: 2px solid ${C.pass}; animation: rule-cycle 6s linear infinite; }
    .sweep  { animation-name: sweep; animation-timing-function: linear; animation-iteration-count: infinite; }
  `,
);

// --- the screens that had no board ------------------------------------------
//
// Nine live routes were reachable and undrawn, which meant nothing in the drift
// harness could tell whether they had drifted, because there was nothing to
// drift from. Two of the nine turned out to be redirects (/checkin and /ledger
// both send you somewhere else and render nothing), so seven screens and two
// signed-out states are drawn here.
//
// Every one of these is drawn from the route as it stands, not redesigned. A
// board is the reference the screen is reviewed against, and inventing a
// different screen here would only move the drift rather than measure it.

// A bulleted policy section, which both the consent screen and the rules use.
const policySection = (heading, lines, strongFirst = false) =>
  `<div style="display:flex;flex-direction:column;gap:10px;">
    ${label(heading)}
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${lines
        .map(
          (l, i) =>
            `<div style="display:flex;gap:9px;">
              <span style="font-size:11px;line-height:1.65;color:${C.muted};">&bull;</span>
              <span style="flex:1;font-size:12.5px;line-height:1.6;color:${strongFirst && i === 0 ? C.fg : C.muted};">${l}</span>
            </div>`,
        )
        .join("")}
    </div>
  </div>`;

// One person's debt in one group, with the settle control under it. Money is
// per person AND per group, because a settlement posts to one group's ledger.
const debtRow = (name, group, amount, color, settle) =>
  `<div style="border:1px solid ${C.rule};padding:14px;display:flex;flex-direction:column;gap:${settle ? 12 : 0}px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="display:flex;flex-direction:column;gap:3px;">
        <span style="font-size:15px;">${name}</span>
        <span style="font-size:12px;color:${C.muted};">${group}</span>
      </div>
      <span style="font-size:17px;color:${color};">&#8377;${amount}</span>
    </div>
    ${
      settle
        ? `<div style="display:flex;gap:10px;">
             <div style="flex:1;border:1px solid ${C.rule};padding:9px 11px;font-size:13px;">${amount}</div>
             ${btn("Mark settled", { wide: false, h: 38, fs: 12.5, pad: 14 })}
           </div>`
        : ""
    }
  </div>`;

put(
  "V3Balances.dc.html",
  page(
    head("BALANCES", { back: true }) +
      scroller(
        `<span style="font-size:14px;line-height:1.6;">Across your groups you owe <span style="color:${C.penalty};">&#8377;250.00</span> and are owed <span style="color:${C.pass};">&#8377;100.00</span>.</span>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("YOU OWE")}
          ${debtRow("Sam Mehta", "Weekend Club", "150.00", C.penalty, true)}
          ${debtRow("Riya Shah", "Morning Crew", "100.00", C.penalty, true)}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("OWED TO YOU")}
          ${debtRow("Alex Rivera", "Weekend Club", "100.00", C.pass, false)}
          ${note("They settle from their own screen. Curfew never moves money, it only keeps the record.", C.muted)}
        </div>`,
      ),
    "home",
  ),
);

// PERSONAL is the timezone, and now nothing else.
//
// It carried a SLEEP WINDOWS half, drawn here for two versions with a red note
// underneath saying two ways to change one thing is one too many. That was the
// right reading and this is the resolution: the windows half was v2's, from
// when sleep was the whole app and its times were as personal as the zone. v3
// gives every type one configure screen drawn from the module's own `fields()`,
// so sleep's windows are at /activities/sleep with the other eleven types'.
//
// The zone stays because it is the one setting that belongs to no module and
// every module reads: it decides when a day starts, when a window opens, and
// which day a check-in lands on.
put(
  "V3SettingsPersonal.dc.html",
  page(
    head("PERSONAL", { back: true }) +
      scroller(
        `${note("Yours only. Changes take effect tomorrow.", C.muted)}

        ${fieldWrap("Timezone", select("Asia/Kolkata"), "IANA name, e.g. Asia/Kolkata")}

        ${note("Every activity is judged in this zone. Each one keeps its own times on its own screen, under Activities.", C.muted)}`,
      ),
    "settings",
  ),
);

put(
  "V3SettingsStored.dc.html",
  page(
    head("WHAT CURFEW STORES", { back: true }) +
      scroller(
        `${policySection("WHAT IS RECORDED", [
          "Every check-in you press, with the time the server saw it. Client clocks are never trusted.",
          "Which activity it was, and the numbers that activity carries.",
          "Nothing about where you were, and nothing you did not press.",
        ])}
        ${policySection("PHOTOS", [
          "Stored in object storage outside this app, and deleted 60 days after the check-in they belong to.",
          "Visible to the groups you share that activity with, and to nobody else.",
          "An admin sees one only when a member reports it.",
        ])}
        ${policySection("WHAT ADMINS SEE", [
          "That you checked in, and how often. Never what you checked in, and never your photos.",
        ])}

        ${note("You accepted version 3 of this on 2026-08-14. This is version 3.", C.muted)}`,
      ),
    "settings",
  ),
);

put(
  "V3SettingsRules.dc.html",
  page(
    head("THE RULES", { back: true }) +
      scroller(
        `${policySection(
          "WHAT YOU MAY NOT POST",
          [
            "No nudity or sexual content. This is grounds for removal without warning.",
            "Nobody else's face or body without their agreement.",
            "Nothing illegal, and nothing that identifies a stranger.",
          ],
          true,
        )}
        ${policySection("REPORTING AND REMOVAL", [
          "Any member can report a photo or a person. Reports go to admins.",
          "An admin can remove a photo, and can remove an account.",
          "A removed account still owes what it owed.",
        ])}
        ${policySection("MONEY IS BETWEEN YOU", [
          "Fines are a record of what members have agreed to owe each other. Curfew never collects, holds or moves money.",
          "A settlement is a row saying it was settled, and nothing more.",
        ])}

        ${note("You agreed to version 3 of this on 2026-08-14. This is version 3.", C.muted)}`,
      ),
    "settings",
  ),
);

// The one place an admin sees a photograph, and only because a member asked
// them to. Everything else in the console counts behaviour and never reads it.
put(
  "V3AdminReports.dc.html",
  adminPage(
    "Reports",
    `<div style="display:flex;flex-direction:column;gap:10px;">
      <span style="font-size:13px;font-weight:600;letter-spacing:0.1em;">OPEN REPORTS</span>

      <div style="border:1px solid ${C.rule};padding:13px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
          <span style="font-size:13.5px;">Someone else is in it</span>
          <span style="font-size:11px;color:${C.muted};">3 Sep, 9:14 PM</span>
        </div>
        <span style="font-size:11.5px;line-height:1.55;color:${C.muted};">Riya Shah reported Sam Mehta in Weekend Club. "That is my flatmate in the background."</span>
        <div style="height:150px;background:linear-gradient(145deg,#2b2620,#14120f);border:1px solid ${C.rule};display:flex;align-items:center;justify-content:center;color:#4a4740;font-size:11px;letter-spacing:0.18em;">REPORTED PHOTO</div>
        <div style="display:flex;gap:10px;">
          ${btn("Delete the photo", { wide: false, h: 38, fs: 12.5, pad: 13, color: C.penalty })}
          ${btn("Dismiss", { wide: false, h: 38, fs: 12.5, pad: 13 })}
        </div>
      </div>

      <div style="border:1px solid ${C.rule};padding:13px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
          <span style="font-size:13.5px;">Not what it claims to be</span>
          <span style="font-size:11px;color:${C.muted};">1 Sep, 7:02 AM</span>
        </div>
        <span style="font-size:11.5px;line-height:1.55;color:${C.muted};">Alex Rivera reported Priya Nair in Morning Crew.</span>
        <span style="font-size:11.5px;color:${C.muted};">The photo is already gone.</span>
        <div style="display:flex;gap:10px;">
          ${btn("Remove the account", { wide: false, h: 38, fs: 12.5, pad: 13, color: C.penalty })}
          ${btn("Dismiss", { wide: false, h: 38, fs: 12.5, pad: 13 })}
        </div>
      </div>
    </div>`,
  ),
);

// One user, everything the console is allowed to know about them. It can see
// THAT they checked in and how often, never what the check-in was and never a
// photo. The counts below are counts for that reason.
put(
  "V3AdminUserOne.dc.html",
  adminPage(
    "Users",
    `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
      <div style="display:flex;flex-direction:column;gap:3px;">
        <span style="font-size:15px;font-weight:600;">Sam Mehta</span>
        <span style="font-size:12px;color:${C.muted};">sam@example.com</span>
      </div>
      <span style="font-size:12px;color:${C.muted};">&#8249; all users</span>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:12px;">
      <span style="font-size:13px;">status: <span style="color:${C.pass};">approved</span></span>
      <span style="font-size:13px;">role: member</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("RECENT CHECK-INS")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("3 Sep", "4 check-ins", "")}
        ${adminRow("2 Sep", "5 check-ins", "")}
        ${adminRow("1 Sep", "2 check-ins", "")}
      </div>
      ${note("How often, never what. The console cannot read a check-in or open a photo.", C.muted)}
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("SCORED PERIODS, LAST 30 DAYS")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Passed", "104", "")}
        ${adminRow("Missed", "11", "")}
        ${adminRow("Grace applied", "3", "")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("BALANCES")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Weekend Club", "owes &#8377;150.00", "")}
        ${adminRow("Morning Crew", "settled", "")}
      </div>
    </div>

    <div style="display:flex;gap:10px;">
      ${btn("Set role", { wide: false, h: 38, fs: 12.5, pad: 13 })}
      ${btn("Remove account", { wide: false, h: 38, fs: 12.5, pad: 13, color: C.penalty })}
    </div>`,
  ),
);

// One group. Archiving is the strongest thing here and it is reversible:
// tracking and scoring stop, and members, balances and history are kept.
put(
  "V3AdminGroupOne.dc.html",
  adminPage(
    "Groups",
    `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
      <span style="font-size:15px;font-weight:600;">Weekend Club</span>
      <span style="font-size:12px;color:${C.muted};">&#8249; all groups</span>
    </div>

    ${btn("Archive group", { wide: false, h: 38, fs: 12.5, pad: 13, color: C.penalty })}

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("MEMBERS &middot; 4")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Sam Mehta", "owner", "812")}
        ${adminRow("Preview Admin", "member", "640")}
        ${adminRow("Alex Rivera", "member", "455")}
        ${adminRow("Riya Shah", "member", "388")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("MONEY")}
      <div style="display:flex;flex-direction:column;">
        ${adminRow("Fines", "on for this group", "&#8377; INR")}
        ${adminRow("Outstanding", "across 3 members", "&#8377;450.00")}
        ${adminRow("Settled this month", "", "&#8377;300.00")}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${label("ACTIVITIES ACCEPTED")}
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        ${chip("sleep", "Sleep")}${chip("gym", "Gym")}${chip("food", "Food")}
      </div>
    </div>

    ${note("Archiving stops tracking and scoring and takes the group off everyone's dashboard. Members, balances and history are kept, and it can be restored.", C.penalty)}`,
  ),
);

// The two signed-out screens. Neither has a bottom nav, because neither is
// inside the app yet.
put(
  "V3Signin.dc.html",
  `<div style="width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;justify-content:center;padding:28px 20px;gap:26px;">
    <div style="display:flex;align-items:center;gap:12px;font-size:30px;font-weight:600;letter-spacing:0.2em;">${mark(26)}CURFEW</div>
    <span style="font-size:14px;line-height:1.6;color:${C.muted};max-width:40ch;">A group accountability contract for nightly sleep. Invite only.</span>
    <button type="button" style="width:100%;height:50px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;">Sign in with Google</button>
    <span style="font-size:12px;color:${C.muted};">New accounts wait for an admin to approve before anything works.</span>
  </div>`,
);

put(
  "V3Pending.dc.html",
  `<div style="width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;justify-content:center;padding:28px 20px;gap:22px;">
    <div style="display:flex;align-items:center;gap:12px;font-size:30px;font-weight:600;letter-spacing:0.2em;">${mark(26)}CURFEW</div>
    <span style="font-size:14px;line-height:1.6;">Your account is waiting for an admin to approve it. You will get an email when the decision is made.</span>
    <span style="font-size:12px;color:${C.muted};">Signed in as preview@curfew.local</span>
    ${btn("Sign out", { wide: false, h: 42, fs: 13, pad: 16 })}
  </div>`,
);

// --- canvas ----------------------------------------------------------------


// ---------------------------------------------------------------------------
// v3.1: the IMMACULATE rule, and the join grace period
//
// Two changes that needed drawing before they were built.
//
// IMMACULATE was "950 or more". The engine simulation showed a steady 87.5%
// completion settles at 969 and holds the glow, so the title meant "misses
// about forty-five days a year". It is now the top band plus sixty days with
// nothing missed, and UNBROKEN moved from 850 to 900 so the top band stops
// covering a one-miss-a-week habit.
//
// The grace period is new: a member joining a group is not scored or fined by
// that group on the day they join. Their own streak and their own reputation
// carry on untouched. It has to be visible to the whole group, or the rest of
// them see a member sitting at nothing and draw the wrong conclusion.
// ---------------------------------------------------------------------------

const cleanBar = (done, need) => `
  <div style="display:flex;flex-direction:column;gap:7px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;">
      <span style="font-size:11.5px;color:${C.muted};">${done} of ${need} clean days</span>
      <span style="font-size:11px;color:${C.muted};">${need - done} to go</span>
    </div>
    <div style="height:5px;background:${C.rule};position:relative;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:${Math.round((done / need) * 100)}%;background:${C.gold};"></div>
    </div>
  </div>`;

// --- the ranks page, rewritten ---------------------------------------------

const RANKS_31 = [
  { n: "DOUBT", r: "0-99", m: "Your record does not back you" },
  { n: "INTENT", r: "100-349", m: "You have said what you will do" },
  { n: "PRACTICE", r: "350-599", m: "You are doing it, most of the time" },
  { n: "DISCIPLINE", r: "600-899", m: "It holds when it is inconvenient" },
  { n: "UNBROKEN", r: "900-1000", m: "The record has no meaningful gaps" },
];

put(
  "V31Ranks.dc.html",
  page(
    head("HOW REPUTATION WORKS", { back: true }) +
      scroller(
        `<div style="border:1px solid ${C.rule};padding:14px;display:flex;align-items:center;gap:13px;">
          <span style="color:${rc(3)};display:flex;flex:none;">${rank(3, 30, rc(3))}</span>
          <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:20px;font-weight:600;color:${rc(3)};">640</span><span style="font-size:10.5px;letter-spacing:0.14em;color:${rc(3)};">DISCIPLINE</span></div>
            <span style="font-size:10.5px;color:${C.muted};">In Weekend Club. 260 to UNBROKEN.</span>
          </div>
        </div>
        <div style="font-size:12.5px;color:${C.muted};line-height:1.6;">Reputation runs 0 to 1000 in each group. Everyone starts at 200. It moves a little every day: up when the day is clean, down when it is not. Sharing more of what a group accepts raises how high you can climb.</div>
        <div style="display:flex;flex-direction:column;">
          ${[4, 3, 2, 1, 0]
            .map((i) => {
              const r = RANKS_31[i];
              return `<div style="display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid ${C.rule};">
                <span style="color:${rc(i)};display:flex;flex:none;">${rank(i, 26, rc(i))}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                  <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:13.5px;letter-spacing:0.12em;color:${rc(i)};">${r.n}</span><span style="font-size:11px;color:${C.muted};">${r.r}</span></div>
                  <span style="font-size:11px;color:${C.muted};">${r.m}</span>
                </div>
              </div>`;
            })
            .join("")}
          <div style="display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid ${C.rule};">
            <span style="color:${C.gold};display:flex;flex:none;${glow(C.gold)}">${rank(5, 26, C.gold)}</span>
            <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
              <div style="display:flex;align-items:baseline;gap:9px;"><span style="font-size:13.5px;letter-spacing:0.12em;color:${C.gold};">IMMACULATE</span><span style="font-size:11px;color:${C.muted};">UNBROKEN, 60 clean days</span></div>
              <span style="font-size:11px;color:${C.muted};">Not a score. A record with nothing missed in it.</span>
            </div>
          </div>
        </div>
        <div style="border:1px solid ${C.rule};padding:14px;display:flex;flex-direction:column;gap:11px;">
          ${label("YOUR CLEAN RUN")}
          ${cleanBar(41, 60)}
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">A missed day sets this back to nothing. A day with nothing scheduled does not.</span>
        </div>
        ${note("1000 is approached, not reached. Grace saves a streak. It never saves this number, and it never saves a clean run.", C.muted)}`,
      ),
    "groups",
  ),
);

// --- standing, at IMMACULATE and on the way to it --------------------------

put(
  "V31StandingImmaculate.dc.html",
  page(
    groupHead("Standing") +
      scroller(
        `<div style="display:flex;align-items:center;gap:15px;">
          <span style="color:${C.gold};display:flex;flex:none;${glow(C.gold)}">${rank(5, 42, C.gold)}</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:32px;font-weight:600;line-height:1;color:${C.gold};">964</span>
            <span style="font-size:10.5px;letter-spacing:0.14em;color:${C.gold};">IMMACULATE</span>
          </div>
          <span style="margin-left:auto;font-size:11px;color:${C.accent};">How it works &#8250;</span>
        </div>
        <div style="border:1px solid ${C.gold};padding:13px;display:flex;flex-direction:column;gap:5px;">
          <span style="font-size:12.5px;color:${C.gold};">73 days, nothing missed.</span>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">One missed day ends the run and the title with it. The score stays where it is.</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("LAST 7 DAYS")}
          ${movements([
            ["2 Sep", "All shared activities done", "+1", C.pass],
            ["1 Sep", "All shared activities done", "+1", C.pass],
            ["31 Aug", "All shared activities done", "+1", C.pass],
            ["30 Aug", "Nothing scheduled", "0", C.muted],
            ["29 Aug", "All shared activities done", "+1", C.pass],
          ])}
        </div>
        ${note("Near the top a clean day is worth less than one point. The record is what carries the title, not the climb.", C.muted)}`,
      ),
    "groups",
  ),
);

put(
  "V31StandingClimbing.dc.html",
  page(
    groupHead("Standing") +
      scroller(
        `<div style="display:flex;align-items:center;gap:15px;">
          <span style="color:${rc(4)};display:flex;flex:none;">${rank(4, 42, rc(4))}</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:32px;font-weight:600;line-height:1;color:${rc(4)};">921</span>
            <span style="font-size:10.5px;letter-spacing:0.14em;color:${rc(4)};">UNBROKEN</span>
          </div>
          <span style="margin-left:auto;font-size:11px;color:${C.accent};">How it works &#8250;</span>
        </div>
        <div style="border:1px solid ${C.rule};padding:13px;display:flex;flex-direction:column;gap:11px;">
          ${label("TOWARD IMMACULATE")}
          ${cleanBar(41, 60)}
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">UNBROKEN already. Nineteen more days with nothing missed.</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("LAST 7 DAYS")}
          ${movements([
            ["2 Sep", "All shared activities done", "+2", C.pass],
            ["1 Sep", "All shared activities done", "+2", C.pass],
            ["31 Aug", "All shared activities done", "+2", C.pass],
            ["30 Aug", "All shared activities done", "+2", C.pass],
            ["29 Aug", "All shared activities done", "+2", C.pass],
          ])}
        </div>`,
      ),
    "groups",
  ),
);

// --- the grace period, seen by the group and by the member ------------------

// A member the group is not counting yet. Same anatomy as memberRow above:
// no avatar, the name with a small tag beside it, streaks underneath, and the
// right-hand slot that normally carries the rank icon and the score. In grace
// there is no score to carry, so the slot says so.
const graceMemberRow = (name, joined) => `
  <div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid ${C.rule};">
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
      <div style="display:flex;align-items:baseline;gap:7px;"><span style="font-size:14px;color:${C.muted};">${name}</span><span style="font-size:10px;color:${C.accent};">joined today</span></div>
      <span style="font-size:11px;color:${C.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${joined}</span>
    </div>
    <span style="flex:none;font-size:10px;letter-spacing:0.12em;color:${C.accent};border:1px solid ${C.accent};padding:3px 7px;">GRACE</span>
  </div>`;

put(
  "V31GroupGrace.dc.html",
  page(
    groupHead("Overview") +
      scroller(
        `<div style="display:flex;flex-wrap:wrap;gap:7px;">
          ${chip("sleep", "Sleep")}${chip("gym", "Gym")}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MEMBERS")}
          <div style="display:flex;flex-direction:column;">
            ${memberRow("Riya", "948", 4, "Sleep 44 &middot; Gym 18")}
            ${memberRow("You", "640", 3, "Sleep 18 &middot; Gym 12", true)}
            ${memberRow("Alex", "412", 2, "Sleep 9 &middot; Gym 6")}
            ${graceMemberRow("Sam", "Counted from midnight, 7 hours")}
          </div>
        </div>
        ${note("A member is not scored or fined by this group on the day they join. Their own streak and their own record carry on as normal.", C.muted)}`,
      ),
    "groups",
  ),
);

put(
  "V31GraceOwn.dc.html",
  page(
    groupHead("Standing") +
      scroller(
        `<div style="border:1px solid ${C.accent};padding:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
            <span style="font-size:10px;letter-spacing:0.16em;color:${C.accent};">GRACE PERIOD</span>
            <span style="font-size:12px;color:${C.accent};">7 hours left</span>
          </div>
          <span style="font-size:13px;line-height:1.55;">This group starts counting you at midnight.</span>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Nothing you do or miss today can move your score here or cost you money here. Everyone in the group can see you are in grace.</span>
        </div>
        <div style="display:flex;align-items:center;gap:15px;opacity:0.55;">
          <span style="color:${rc(1)};display:flex;flex:none;">${rank(1, 42, rc(1))}</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:32px;font-weight:600;line-height:1;color:${rc(1)};">200</span>
            <span style="font-size:10.5px;letter-spacing:0.14em;color:${C.muted};">STARTS TOMORROW</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("STILL COUNTING")}
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid ${C.rule};">
            <div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:12.5px;">Your streaks</span><span style="font-size:10.5px;color:${C.muted};">Yours, not the group's. Unaffected.</span></div>
            <span style="font-size:13px;color:${C.pass};">Running</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid ${C.rule};">
            <div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:12.5px;">Your own record</span><span style="font-size:10.5px;color:${C.muted};">The score only you can see.</span></div>
            <span style="font-size:13px;color:${C.pass};">Running</span>
          </div>
        </div>
        ${note("One day, each time you join. Anything you owed here comes back with you.", C.muted)}`,
      ),
    "groups",
  ),
);

// --- home, for a member in grace -------------------------------------------

put(
  "V31HomeGrace.dc.html",
  page(
    head("CURFEW") +
      scroller(
        `<section style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:10px;letter-spacing:0.16em;color:${C.muted};">TODAY</span>
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">3</span>
            <span style="font-size:15px;color:${C.muted};">of 5 done</span>
          </div>
          <div style="margin-top:6px;display:flex;gap:4px;">
            ${[1, 1, 1, 0, 0].map((f) => `<div style="height:3px;flex:1;background:${f ? C.fg : C.rule};"></div>`).join("")}
          </div>
        </section>
        <div style="border:1px solid ${C.accent};padding:13px;display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
            <span style="font-size:12.5px;color:${C.accent};">Early Risers starts counting you at midnight.</span>
            <span style="font-size:11px;color:${C.accent};">7h</span>
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Today is yours. Nothing there can cost you money or reputation yet.</span>
        </div>
        ${note("Your streaks and your own record are counting today, the same as any other day.", C.muted)}`,
      ),
    "home",
  ),
);


// --- pause, for a trip -----------------------------------------------------
//
// A paused day is a day with NOTHING SCHEDULED. That is the whole feature, and
// every screen here says the same three things in the same order: your streaks
// end, the days are not misses, and after a week the score settles anyway.
//
// It costs the streak outright, which is why it needs no quota: a streak is
// consecutive days and a pause is a gap, so pausing repeatedly is visibly
// self-defeating and there is nothing left to game.

const kv = (k, v, sub = "") =>
  `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid ${C.rule};">
    <div style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:13px;">${k}</span>${sub ? `<span style="font-size:10.5px;color:${C.muted};">${sub}</span>` : ""}</div>
    <span style="font-size:13px;color:${C.muted};text-align:right;">${v}</span>
  </div>`;

const settingsRow = (k, v) =>
  `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <span style="font-size:14px;">${k}</span>
    <span style="display:flex;align-items:center;gap:8px;font-size:12px;color:${C.muted};">${v}<span>&#8250;</span></span>
  </div>`;

const dateField = (l, v) =>
  `<div style="flex:1;display:flex;flex-direction:column;gap:6px;">
    <span style="font-size:10px;letter-spacing:0.14em;color:${C.muted};">${l}</span>
    <div style="border:1px solid ${C.fg};padding:10px 11px;font-size:14px;">${v}</div>
  </div>`;

// Where it lives. Rare, deliberate and global, so it belongs beside the other
// things you set once, not on Home.
put(
  "V31PauseSettings.dc.html",
  page(
    head("SETTINGS", { right: adminLink(false) }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:10px;">
          ${label("PERSONAL")}
          <div style="display:flex;flex-direction:column;">
            ${settingsRow("Timezone", "Asia/Kolkata")}
            ${settingsRow("Activities", "5 tracked")}
            ${settingsRow("Sleep windows", "10:00 PM to 7:45 AM")}
            ${settingsRow("Pause", "Not paused")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("GROUPS")}
          <div style="display:flex;flex-direction:column;">
            ${settingsRow("What you share", "3 groups")}
            ${settingsRow("Your photos", "18 stored")}
          </div>
        </div>
        ${note("A pause is one declaration and it covers every group and your own record. It is not per group.", C.muted)}`,
      ),
    "settings",
  ),
);

// Declaring one. The cost is stated before the button, not after it.
put(
  "V31PauseDeclare.dc.html",
  bare(
    head("PAUSE", { back: true }) +
      scroller(
        `<span style="font-size:13px;line-height:1.6;">Tell Curfew you are away. The days are not counted, in any group or on your own record.</span>

        <div style="display:flex;gap:11px;">
          ${dateField("FROM", "Tue 15 Sep")}
          ${dateField("TO", "Fri 18 Sep")}
        </div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:-8px;">
          <span style="font-size:11.5px;color:${C.muted};">Starts tomorrow at the earliest.</span>
          <span style="font-size:12px;">4 days</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WHAT IT COSTS")}
          <div style="border:1px solid ${C.penalty};padding:13px;display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:13px;color:${C.penalty};">Every streak ends at 0.</span>
            <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">A streak is consecutive days. A pause is a gap, and grace does not cover one. They end when the first paused day closes, the same as any day you miss, not the moment you declare.</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WHAT IT SAVES")}
          <div style="display:flex;flex-direction:column;">
            ${kv("Reputation", "Not marked down", "The days are not misses")}
            ${kv("Money", "Nothing owed", "Nothing scheduled, nothing to fine")}
            ${kv("After 7 days away", "Settles", "The same as any quiet week")}
          </div>
        </div>

        ${btn("Declare", { filled: true })}
        ${note("Three days minimum. Your groups see the dates.", C.muted)}`,
      ),
  ),
);

// While it runs. Two ways out, and both are stated in terms of what they change.
put(
  "V31PauseActive.dc.html",
  bare(
    head("PAUSE", { back: true }) +
      scroller(
        `<div style="border:1px solid ${C.accent};padding:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
            <span style="font-size:10px;letter-spacing:0.16em;color:${C.accent};">PAUSED</span>
            <span style="font-size:12px;color:${C.accent};">2 days left</span>
          </div>
          <span style="font-size:13px;line-height:1.55;">Back on Fri 18 Sep.</span>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Nothing is scheduled and nothing counts, in any group.</span>
        </div>

        <div style="display:flex;flex-direction:column;">
          ${kv("Declared", "Sun 13 Sep")}
          ${kv("From", "Tue 15 Sep")}
          ${kv("To", "Fri 18 Sep")}
          ${kv("Streaks", "Ended Tue 15 Sep", "When the day closed, not when you declared")}
          ${kv("Score", "684, settling from Tue 22")}
        </div>

        <div style="display:flex;gap:10px;">
          ${btn("Extend", { wide: false, h: 40, fs: 13 })}
          ${btn("Come back early", { wide: false, h: 40, fs: 13 })}
        </div>
        ${note("Coming back early takes effect tomorrow. The days already passed stay paused, and the streak that ended does not come back.", C.muted)}`,
      ),
  ),
);

// Home, while paused. Day one, on purpose: the streak has not gone yet, because
// it goes when the day closes like any other day. The rest of Home stays where
// it was, because money and standing do not stop existing while somebody is
// away, and a screen that drops them reads as the account being suspended.
put(
  "V31HomePaused.dc.html",
  page(
    head("CURFEW", { right: adminLink(false) }) +
      scroller(
        `<section style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;color:${C.muted};">Paused</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:4px;">
            ${[0, 0, 0, 0, 0].map(() => `<div style="height:3px;flex:1;border-top:1px dashed ${C.dash};"></div>`).join("")}
          </div>
        </section>

        <div style="border:1px solid ${C.accent};padding:13px;display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
            <span style="font-size:12.5px;color:${C.accent};">Back on Fri 18 Sep.</span>
            <span style="font-size:11px;color:${C.accent};">4 days</span>
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Nothing is scheduled and nothing counts.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WHILE YOU ARE AWAY")}
          <div style="display:flex;flex-direction:column;">
            ${kv("Streaks", "Running until tonight", "They end when today closes, like any missed day")}
            ${kv("Reputation", "Not marked down", "Settles after a week away")}
            ${kv("Money", "Nothing owed", "")}
          </div>
          <div style="display:flex;gap:10px;">
            ${btn("Extend", { wide: false, h: 38, fs: 12.5, pad: 14 })}
            ${btn("Come back early", { wide: false, h: 38, fs: 12.5, pad: 14 })}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Coming back early takes effect tomorrow.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("BALANCES")}
          <div style="display:flex;gap:10px;">
            <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;color:${C.muted};">YOU OWE</span>
              <span style="font-size:19px;color:${C.penalty};">&#8377;150</span>
            </div>
            <div style="flex:1;border:1px solid ${C.rule};padding:12px;display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;color:${C.muted};">OWED TO YOU</span>
              <span style="font-size:19px;color:${C.pass};">&#8377;300</span>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("GROUPS")}
          <div style="display:flex;flex-direction:column;">
            ${groupSummaryRow("Weekend Club", "640", 3)}
            ${groupSummaryRow("Morning Crew", "412", 2)}
          </div>
        </div>`,
      ),
    "home",
  ),
);

// The group's side. A member sitting at nothing reads as somebody who does not
// turn up unless the list says otherwise, which is decision 123's reasoning.
// Being away replaces the streaks line, never the score. The number is what
// the list is FOR: a member who is away still has a standing, and hiding it
// behind a tag reads as though they had been removed from the group.
const awayMemberRow = (name, until, score, ri) => `
  <div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid ${C.rule};">
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
      <div style="display:flex;align-items:baseline;gap:7px;"><span style="font-size:14px;">${name}</span></div>
      <span style="font-size:11px;color:${C.accent};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${until}</span>
    </div>
    <span style="display:flex;align-items:center;gap:8px;color:${rc(ri)};flex:none;">${rank(ri, 17, rc(ri))}<span style="font-size:15px;">${score}</span></span>
  </div>`;

put(
  "V31GroupPaused.dc.html",
  page(
    groupHead("Overview") +
      scroller(
        `<div style="display:flex;flex-wrap:wrap;gap:7px;">
          ${chip("sleep", "Sleep")}${chip("gym", "Gym")}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MEMBERS")}
          <div style="display:flex;flex-direction:column;">
            ${memberRow("Riya", "948", 4, "Sleep 44 &middot; Gym 18")}
            ${awayMemberRow("Sam", "Away until Fri 18 Sep", "702", 3)}
            ${memberRow("You", "640", 3, "Sleep 18 &middot; Gym 12", true)}
            ${memberRow("Alex", "412", 2, "Sleep 9 &middot; Gym 6")}
          </div>
        </div>
        ${note("A member who declared they are away is not scored or fined for those days. Their standing stays where it was, and their streaks ended when the first of those days closed.", C.muted)}`,
      ),
    "groups",
  ),
);

// Your own standing in a group, mid-pause. The score is not marked down, and
// the screen is honest that it is not frozen either.
put(
  "V31StandingPaused.dc.html",
  page(
    groupHead("Standing") +
      scroller(
        `<div style="border:1px solid ${C.accent};padding:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
            <span style="font-size:10px;letter-spacing:0.16em;color:${C.accent};">PAUSED</span>
            <span style="font-size:12px;color:${C.accent};">2 days left</span>
          </div>
          <span style="font-size:13px;line-height:1.55;">This group is not counting these days.</span>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Nothing here can be a miss or a fine until Fri 18 Sep.</span>
        </div>

        <div style="display:flex;align-items:center;gap:15px;">
          <span style="color:${rc(3)};display:flex;flex:none;">${rank(3, 42, rc(3))}</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span style="font-size:32px;font-weight:600;line-height:1;color:${rc(3)};">684</span>
            <span style="font-size:10.5px;letter-spacing:0.14em;color:${C.muted};">HELD, NOT FROZEN</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("WHAT MOVES, AND WHEN")}
          <div style="display:flex;flex-direction:column;">
            ${kv("A miss", "Cannot happen", "Nothing is scheduled")}
            ${kv("A fine", "Cannot happen", "Nothing to fine")}
            ${kv("Settling", "From Tue 22 Sep", "Seven quiet days, then 1% a day")}
            ${kv("Your streaks", "Ended", "When Tue 15 Sep closed. A pause is a gap, not a grace")}
          </div>
        </div>
        ${note("Away four days costs nothing. Away four weeks costs what any four quiet weeks cost.", C.muted)}`,
      ),
    "groups",
  ),
);

// The rules page, rewritten for the two things that changed: what a quiet day
// does now, and where a pause sits beside grace.
const ruleBlock = (t, lines) =>
  `<div style="display:flex;flex-direction:column;gap:7px;">
    <span style="font-size:13px;">${t}</span>
    ${lines.map((l) => `<span style="font-size:11.5px;color:${C.muted};line-height:1.6;">${l}</span>`).join("")}
  </div>`;

put(
  "V31RanksQuiet.dc.html",
  bare(
    head("HOW IT WORKS", { back: true }) +
      scroller(
        `${label("A DAY WITH NOTHING DUE")}
        ${ruleBlock("Nothing happens, for a week.", [
          "A day with nothing scheduled is not a miss and never costs you anything.",
        ])}
        ${ruleBlock("Then it settles, 1% a day.", [
          "A score is a claim about recent conduct, so it fades when there is nothing recent. It is a share of the number rather than a flat amount, so 900 falls faster than 300 does, and it never quite reaches zero.",
          "Two months away takes 900 to 523. A year takes it to 24.",
        ])}

        <div style="height:1px;background:${C.rule};"></div>

        ${label("GRACE, AND A PAUSE")}
        ${ruleBlock("Grace protects a streak.", [
          "A set number of misses a month, per activity. It holds the streak where it is. It never protects reputation and it never waives a fine.",
        ])}
        ${ruleBlock("A pause does not.", [
          "Declaring you are away means those days are not scheduled, so they cannot be a miss and cannot be fined, in any group.",
          "Every streak ends. A streak is consecutive days and a pause is a gap. That is the price, and it is why there is no limit on how often you take one.",
          "They end when the first paused day closes, the same as any day you miss. Declaring a pause never ends one early.",
          "Three days minimum, declared in advance, and your groups see the dates.",
        ])}
        ${note("Away four days costs nothing but your streaks. Away four weeks costs what any four quiet weeks cost.", C.muted)}`,
      ),
  ),
);

// Stats, with a trip in it.
//
// A paused day produces no period, so before this the away stretch was a hole
// in the heatmap identical to a hole caused by not turning up. The two mean
// opposite things and the screen could not tell them apart. An away cell is
// drawn rather than left blank: a dashed accent outline, in the legend, and
// named with its dates underneath, so the gap explains itself.
const AWAY_CELL = `<div style="width:100%;aspect-ratio:1;border:1px dashed ${C.accent};background:transparent;"></div>`;

function heatmapAway(weeks) {
  return `<div style="display:flex;flex-direction:column;gap:9px;">
    <div style="display:flex;gap:3px;">${weeks
      .map(
        (w) =>
          `<div style="flex:1;display:flex;flex-direction:column;gap:3px;">${w
            .map((v) =>
              v === -2
                ? AWAY_CELL
                : `<div style="width:100%;aspect-ratio:1;background:${v < 0 ? "transparent" : HEAT[v]};${v < 0 ? `border:1px solid ${C.rule};` : ""}"></div>`,
            )
            .join("")}</div>`,
      )
      .join("")}</div>
    <div style="display:flex;align-items:center;gap:7px;">
      <span style="font-size:10px;color:${C.muted};">none</span>
      ${HEAT.map((c) => `<div style="width:14px;height:8px;background:${c};"></div>`).join("")}
      <span style="font-size:10px;color:${C.muted};">all</span>
      <span style="display:flex;align-items:center;gap:5px;margin-left:10px;">
        <span style="width:8px;height:8px;border:1px dashed ${C.accent};display:block;"></span>
        <span style="font-size:10px;color:${C.accent};">away</span>
      </span>
      <span style="margin-left:auto;font-size:10px;color:${C.muted};">8 weeks</span>
    </div>
  </div>`;
}

put(
  "V31StatsPaused.dc.html",
  page(
    head("STATS") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("PERFECT DAYS THIS MONTH")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">11</span>
            <span style="font-size:15px;color:${C.muted};">of 23</span>
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Seven days away are not counted, either way.</span>
        </div>

        <div style="display:flex;gap:10px;">
          ${statTile("81%", "PERIODS PASSED, 30 DAYS")}
          ${statTile("4", "LONGEST RUNNING STREAK", C.flame)}
          ${statTile("2", "GRACE LEFT THIS MONTH")}
        </div>

        <div style="display:flex;flex-direction:column;gap:11px;">
          ${label("EVERY DAY, HOW MUCH OF IT")}
          ${heatmapAway([
            [2, 4, 4, 3, 4, 1, 2],
            [4, 4, 3, 4, 4, 2, 3],
            [3, 2, 4, 4, 1, 0, 2],
            [4, 4, 4, 4, 4, 3, 4],
            [2, 3, 4, 3, 4, 4, 2],
            [-2, -2, -2, -2, -2, -2, -2],
            [3, 4, 4, 4, 4, 4, 4],
            [4, 4, 3, -1, -1, -1, -1],
          ])}
          <span style="font-size:11.5px;color:${C.accent};line-height:1.55;">Away Mon 15 Sep to Sun 21 Sep. Those days were not scheduled.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${labelHint("BY ACTIVITY, LAST 30 DAYS", "TAP FOR THE CHART")}
          <div style="display:flex;flex-direction:column;">
            ${passBar("Food", "food", 96, 4)}
            ${passBar("Water", "water", 91, 4)}
            ${passBar("Sleep", "sleep", 78, 3)}
            ${passBar("Gym", "gym", 70, 2)}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Out of the days that were scheduled. A trip lowers the count, never the share.</span>
        </div>`,
      ),
    "stats",
  ),
);

// The group's own version. It does not draw a member's days, so the honest
// thing is a line naming who is away and until when, above the numbers those
// days are missing from.
put(
  "V31GroupStatsPaused.dc.html",
  page(
    head("GROUP STATS", { back: true, right: `<span style="font-size:11px;color:${C.muted};">Weekend Club</span>` }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("THIS WEEK")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">28</span>
            <span style="font-size:15px;color:${C.muted};">of 33 done</span>
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Every shared activity, every member, counted across the week.</span>
        </div>

        <div style="border:1px solid ${C.accent};padding:12px;display:flex;flex-direction:column;gap:4px;">
          <span style="font-size:12.5px;color:${C.accent};">Sam is away until Fri 18 Sep.</span>
          <span style="font-size:11px;color:${C.muted};line-height:1.55;">Their days are not scheduled, so they are in neither number below.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("DAY BY DAY")}
          <div style="display:flex;gap:5px;">
            ${[6, 6, 4, 4, 4, 3, 4]
              .map(
                (v, i) =>
                  `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
                    <div style="width:100%;height:44px;display:flex;flex-direction:column;justify-content:flex-end;background:${C.rule};${i >= 2 && i <= 4 ? `border-top:1px dashed ${C.accent};` : ""}">
                      <div style="width:100%;height:${(v / 6) * 100}%;background:${C.fg};"></div>
                    </div>
                    <span style="font-size:10px;color:${i >= 2 && i <= 4 ? C.accent : C.muted};">${v}</span>
                  </div>`,
              )
              .join("")}
          </div>
          <div style="display:flex;gap:5px;">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span style="flex:1;text-align:center;font-size:10px;color:${C.muted};">${d}</span>`).join("")}</div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">The dashed days had one fewer member to count. Out of 6 a day, then 4.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("MEMBERS THIS WEEK")}
          <div style="display:flex;flex-direction:column;">
            ${[
              ["Riya", 12, 12, null],
              ["You", 9, 12, null],
              ["Alex", 7, 9, null],
              ["Sam", 0, 0, "Away until Fri 18 Sep"],
            ]
              .map(([n, did, of, away]) => {
                const pct = of === 0 ? 0 : Math.round((did / of) * 100);
                return `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${C.rule};">
                  <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:9px;">
                      <span style="font-size:13px;">${n}</span>
                      <span style="font-size:11.5px;color:${away ? C.accent : C.muted};">${away ?? `${did} of ${of}`}</span>
                    </div>
                    <div style="height:3px;background:${C.rule};">${away ? "" : `<div style="height:3px;width:${pct}%;background:${C.fg};"></div>`}</div>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Nothing was scheduled for Sam, so a bar at nothing would read as a week of failures.</span>
        </div>`,
      ),
    "groups",
  ),
);

// --- v3.2: the fixes ---------------------------------------------------------

// A decision that needs a yes, over whatever it is about. Unlike the notice
// overlay this one can be refused, so it has two buttons and the destructive
// one is not the filled one.
const sheet = (title, body, confirmLabel, { danger = false, cancel = "Cancel" } = {}) =>
  `<div style="position:absolute;inset:0;background:#0b0a09e6;display:flex;align-items:flex-end;">
    <div style="width:100%;border-top:1px solid ${C.rule};background:${C.bg};display:flex;flex-direction:column;gap:14px;padding:18px 20px 22px;">
      <span style="font-size:16px;line-height:1.45;">${title}</span>
      ${body}
      <div style="display:flex;flex-direction:column;gap:9px;margin-top:2px;">
        <button type="button" style="width:100%;height:46px;border:1px solid ${danger ? C.penalty : C.fg};background:${danger ? "transparent" : C.fg};color:${danger ? C.penalty : C.bg};font-family:inherit;font-size:14px;font-weight:${danger ? 400 : 600};cursor:pointer;">${confirmLabel}</button>
        <button type="button" style="width:100%;height:46px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:14px;cursor:pointer;">${cancel}</button>
      </div>
    </div>
  </div>`;

// A consequence of pressing the thing. Stated, never softened.
const consequence = (what, detail) =>
  `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid ${C.rule};">
    <span style="flex:none;color:${C.penalty};font-size:12px;line-height:1.5;">&mdash;</span>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:12.5px;line-height:1.5;">${what}</span>
      <span style="font-size:10.5px;color:${C.muted};line-height:1.5;">${detail}</span>
    </div>
  </div>`;

// Which groups a photograph reaches. Tagged when the check-in is sent and never
// afterwards, so this is a statement of fact rather than a setting.
const groupTag = (name, gone = false) =>
  `<span style="border:1px solid ${gone ? C.rule : C.dash};padding:3px 8px;font-size:10px;color:${gone ? C.muted : C.fg};${gone ? "text-decoration:line-through;" : ""}">${name}</span>`;

const setRowFixed = (k, v, why) =>
  `<div style="display:flex;flex-direction:column;gap:4px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <div style="display:flex;align-items:baseline;gap:10px;">
      <span style="flex:1;font-size:13px;color:${C.muted};">${k}</span>
      <span style="font-size:13px;">${v}</span>
    </div>
    <span style="font-size:10.5px;color:${C.dash};line-height:1.5;">${why}</span>
  </div>`;

// 17. Sleep, with the windows you asked for and a confirm that is no longer a
// setting. It opens 30 minutes after the wake press and stays open 30 minutes,
// which is a window anchored to an EVENT rather than to the clock. Nothing else
// in the app has one of those, which is the part that makes this a redesign
// rather than six new default strings.
put(
  "V32SleepSetup.dc.html",
  bare(
    head("SLEEP", { back: true }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:10px;border-bottom:1px solid ${C.rule};padding-bottom:14px;">
          <span style="font-size:11px;letter-spacing:0.06em;color:${C.muted};">THE RULE</span>
          <p style="font-size:15px;line-height:1.5;margin:0;">In bed between 9:30 PM and 11:00 PM. Up between 5:30 AM and 7:00 AM. Then a photograph, 30 minutes after you say you are up.</p>
          <p style="font-size:11.5px;color:${C.muted};line-height:1.55;margin:0;">All three, or the night does not count.</p>
        </div>

        <div style="display:flex;flex-direction:column;">
          ${setRow("Night window", "9:30 PM to 11:00 PM")}
          ${setRow("Wake window", "5:30 AM to 7:00 AM")}
          ${setRowFixed(
            "Confirm window",
            "30 min after wake",
            "Open for 30 minutes. Not a setting, or you could place it where you are already up.",
          )}
          ${setRow("Day starts", "Noon")}
        </div>

        ${note("The photograph is on the confirm only. Night and wake are the time you pressed, and nothing else.", C.muted)}
        ${note("Changes start tomorrow.", C.muted)}`,
        "18px 20px 24px",
        20,
      ),
  ),
);

// The 3.2.0 release note, arriving for somebody who was already here.
//
// The words are READ FROM `release-notes.json`, the file the publish script
// reads, rather than typed again here. An artboard that paraphrases what ships
// is an artboard that disagrees with it by the second edit, and this one exists
// precisely to show what people will be made to read before they can use the
// app again. Change the notes and this board changes with them.
//
// It is the overlay that already exists and already blocks. Nothing new is
// built: a release note is just a notice whose body came from a file instead of
// from a controls change, and the app cannot tell the difference.
const RELEASE = "3.2.0";
const releaseNotes = JSON.parse(readFileSync(join(DIR, "..", "release-notes.json"), "utf8"));

put(
  "V32SleepNotice.dc.html",
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">
    ${head("CURFEW", { right: adminLink(false) })}
    ${scroller(
      `<div style="display:flex;flex-direction:column;">
        ${activityRow({ icon: "sleep", name: "Sleep", days: 18, status: "Wake window closes 7:00 AM", action: { t: "Check in" } })}
        ${activityRow({ icon: "gym", name: "Gym", days: 12, status: "2 of 3 this week", action: { t: "Check in" } })}
      </div>`,
    )}
    ${nav("home")}
    ${noticeOverlay(releaseNotes[RELEASE].map((n) => [n.headline, n.detail]))}
  </div>`,
);

// 19 and 20. Grace becomes one pool for the account, spent by hand.
//
// Two a month for each activity tracked, so it scales with how much somebody
// takes on and nobody can widen it from a config screen. One grace covers one
// missed DAY, which is what makes a weekly activity cost what it actually
// missed rather than a flat one per bad week.
//
// Four boards because the question was never the arithmetic, it was WHERE.
// Home carries the action, because that is the screen looked at daily and the
// offer expires. Settings carries the count, because that is where everything
// about how the app treats you already lives, beside retention and reputation.
// Nothing blocks and nothing pops up on open: an offer that hijacks the screen
// on the morning after a bad week is the app nagging, and this is a clerk.

// An activity whose streak has ended, in ONE row the same height as every
// other. The first draft hung a dashed strip underneath with a sentence and a
// second button, which made the one row that needed the least attention the
// tallest thing on the screen.
//
// The streak it would give back is the control. The flame is grey and the
// number is grey, because that run is not yours at the moment; pressing it is
// what makes it yours again. Nothing else is needed: the number IS the offer,
// and the sheet carries the detail for anyone who presses.
const greyFlame = (size = 13) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;"><path d="M12 2c2.5 3.5 4.6 5.6 4.6 9.1a4.6 4.6 0 0 1-9.2 0c0-1.5.5-2.6 1.5-3.7C10.4 8.6 12 6.1 12 2Z" fill="${C.dash}"></path></svg>`;

// The dead streak: the same flame in the same place, gone out. Static, not a
// control. Snapchat does exactly this and it is why a broken streak reads
// instantly there without anything being said.
const deadStreak = (n) =>
  `<span style="display:flex;align-items:center;gap:4px;">${greyFlame(13)}<span style="font-size:12px;color:${C.muted};">${n}</span></span>`;

// A row whose streak has ended. Identical to every other row, with one part of
// it changed rather than anything added.
//
// Five drafts, and this one changes the least. The status line is left ALONE:
// it still says what the week is doing, because that is still true and a row
// that rewrites itself to talk about grace has stopped being a row about the
// activity. Nothing states the price here either. The price belongs in the
// sheet, where the decision is.
//
// So exactly two things differ from a normal row. The flame is out, which is
// the whole message and needs no words. And a Restore sits beside Check in,
// outlined in the flame colour so it reads as the secondary thing it is, while
// Check in keeps the filled treatment it has on every other row.
//
// What the earlier drafts got wrong, kept here so nobody walks them again: a
// dashed strip underneath made the quietest row the tallest; Restore in place
// of the action button removed Check in, and the week ended but the activity
// did not; a grey pressable chip was too quiet to find; a flame pressable chip
// was loud but put the offer in the streak slot, where a streak that is gone
// still looked live.
//
// Snapchat is the reference for the extinguished flame. Its rounded pill and
// orange glow are named in CLAUDE.md as things not to drift toward, so the
// structure is taken and the styling is not.
const endedRow = ({ icon, name, status, n, action, restorable = true }) =>
  `<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <span style="color:${C.fg};display:flex;flex:none;">${svg(20, ACT[icon])}</span>
    <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;">
      <div style="display:flex;align-items:center;gap:9px;"><span style="font-size:14px;">${name}</span>${deadStreak(n)}</div>
      <span style="font-size:11.5px;color:${C.muted};">${status}</span>
    </div>
    ${
      // No button when it cannot be afforded. A disabled control is a thing to
      // wonder about on the screen looked at most, and there is nothing to do
      // about it here: the grace screen is where it says how short you are.
      // The grey flame alone is then the whole story, which is what a broken
      // streak looked like before any of this existed.
      restorable === false
        ? ""
        : `<button type="button" style="height:34px;padding:0 10px;border:1px solid ${C.flame};background:transparent;color:${C.flame};font-family:inherit;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;flex:none;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.flame}" stroke-width="2.4" stroke-linecap="square"><path d="M20 12a8 8 0 1 1-2.6-5.9"></path><path d="M20 4v4h-4"></path></svg>Restore
    </button>`
    }
    <button type="button" style="height:34px;padding:0 13px;border:1px solid ${C.fg};background:${C.fg};color:${C.bg};font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;flex:none;">${action.cam ? svg(14, CAM, C.bg, 1.5) : ""}${action.t}</button>
  </div>`;

// WHERE THE ACTION IS. Home, on the row it belongs to, under the check-in
// button rather than instead of it: the activity is still live today and
// checking in is still the thing to do.
put(
  "V32GraceHome.dc.html",
  page(
    head("CURFEW", { right: adminLink(false) }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">2</span>
            <span style="font-size:15px;color:${C.muted};">of 4 done</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            ${[1, 1, 0, 0].map((v) => `<div style="flex:1;height:3px;background:${v ? C.fg : C.rule};"></div>`).join("")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;">
          ${activityRow({ icon: "sleep", name: "Sleep", days: 19, status: "Done", done: true })}
          ${activityRow({ icon: "water", name: "Water", days: 31, status: "8 of 8", done: true })}
          ${endedRow({ icon: "gym", name: "Gym", status: "1 of 3 this week", n: 24, action: { t: "Check in" } })}
          ${endedRow({ icon: "study", name: "Study", status: "Not logged yet", n: 63, action: { t: "Log", cam: true }, restorable: false })}
          ${activityRow({ icon: "food", name: "Food", days: 41, status: "2 of 3 meals", action: { t: "Log", cam: true } })}
        </div>`,
        "18px 20px 24px",
        22,
      ),
    "home",
  ),
);

// The press. Same sheet whether it came from Home or from the grace screen.
put(
  "V32GraceOffer.dc.html",
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">
    ${head("CURFEW", { right: adminLink(false) })}
    ${scroller(
      `<div style="display:flex;flex-direction:column;">
        ${activityRow({ icon: "sleep", name: "Sleep", days: 19, status: "Done", done: true })}
        ${endedRow({ icon: "gym", name: "Gym", status: "1 of 3 this week", n: 24, action: { t: "Check in" } })}
      </div>`,
    )}
    ${nav("home")}
    ${sheet(
      "Restore Gym streak",
      // Four facts, and nothing that is not one. The previous draft wrote "a
      // fortnight at most" and "your standing stays where it fell", which are
      // sentences enjoying themselves in front of somebody who wants to press a
      // button. A clerk states the number, the price, the deadline and the
      // thing you might otherwise get wrong.
      //
      // The flame relights, which is the whole proposition in one image and the
      // only gradient on the screen.
      `<div style="display:flex;align-items:center;gap:9px;">
        ${svg(17, ACT.gym, C.fg)}<span style="font-size:13.5px;">Gym</span>
        <span style="margin-left:auto;font-size:11px;color:${C.muted};">week ending 14 Sept</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px;padding:2px 0 14px;border-bottom:1px solid ${C.rule};">
        ${streak(24, { big: true })}
        <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
          <span style="font-size:12.5px;">Two days short last week</span>
          <span style="font-size:11px;color:${C.muted};">2 of your 6 grace</span>
        </div>
      </div>
      <span style="border:1px solid ${C.flame};color:${C.flame};font-size:9.5px;letter-spacing:0.1em;padding:2px 6px;align-self:flex-start;">OPEN UNTIL YOU NEXT GO</span>
      <span style="font-size:11.5px;color:${C.muted};">Fine and standing do not change.</span>`,
      "Use 2 grace",
      { cancel: "Let it go" },
    )}
  </div>`,
);

// WHERE THE COUNT IS. Settings, beside retention and how reputation works,
// because it is the same kind of fact: a rule the app applies to you.
put(
  "V32GraceSettings.dc.html",
  page(
    head("SETTINGS") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:8px;">
          ${label("PERSONAL")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Timezone", "Asia/Kolkata")}
            ${setRow("Activities", "4 tracked")}
            ${setRow("Grace", "6 of 8 left")}
            ${setRow("What you share", "2 groups")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${label("YOUR DATA")}
          <div style="display:flex;flex-direction:column;">
            ${setRow("Photo retention", "30 days")}
            ${setRow("How reputation works", "")}
            ${setRow("Your photos", "")}
            ${setRow("Delete data", "")}
          </div>
        </div>
        ${btn("Sign out")}`,
      ),
    "settings",
  ),
);

// The screen behind that row. Two offers open at once, one of them out of
// reach, because that is the state the first draft had no answer for.
//
// An offer is a card with the activity, the number coming back, the price and
// the deadline. Four facts on two lines. The first draft wrote a sentence about
// each and the screen read as an essay about grace rather than a list of things
// you can do.
//
// An offer you cannot afford keeps its place in the list and loses its button.
// It says what it needs and what you have, and that is the only screen in the
// app that explains why Home has no Restore on that row.
const offerCard = (icon, what, when, n, cost, left) => {
  const can = cost <= left;
  return `<div style="border:1px solid ${can ? C.rule : C.rule};padding:13px;display:flex;flex-direction:column;gap:11px;${can ? "" : "opacity:0.72;"}">
    <div style="display:flex;align-items:center;gap:9px;">
      ${svg(16, ACT[icon], can ? C.fg : C.muted)}
      <span style="flex:1;font-size:13px;color:${can ? C.fg : C.muted};">${what}</span>
      <span style="font-size:10.5px;color:${C.muted};">${when}</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="display:flex;align-items:center;gap:5px;">${greyFlame(15)}<span style="font-size:15px;color:${C.muted};">${n}</span></span>
      <span style="flex:1;font-size:11px;color:${C.muted};">${can ? `${cost} grace` : `needs ${cost}, you have ${left}`}</span>
      ${
        can
          ? `<button type="button" style="height:32px;padding:0 12px;border:1px solid ${C.flame};background:${C.flame};color:${C.bg};font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;flex:none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.bg}" stroke-width="2.4" stroke-linecap="square"><path d="M20 12a8 8 0 1 1-2.6-5.9"></path><path d="M20 4v4h-4"></path></svg>Restore
            </button>`
          : ""
      }
    </div>
  </div>`;
};

put(
  "V32Grace.dc.html",
  bare(
    head("GRACE", { back: true }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:9px;">
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">6</span>
            <span style="font-size:15px;color:${C.muted};">of 8 left</span>
          </div>
          <div style="display:flex;gap:4px;">
            ${[1, 1, 1, 1, 1, 1, 0, 0].map((v) => `<div style="flex:1;height:3px;background:${v ? C.fg : C.rule};"></div>`).join("")}
          </div>
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Two a month per activity. Resets 1 October.</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("OPEN")}
          ${offerCard("gym", "Gym", "until you next go", 24, 2, 6)}
          ${offerCard("study", "Study", "until you next log", 63, 7, 6)}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${label("SPENT")}
          <div style="display:flex;flex-direction:column;">
            ${[
              ["Sleep", "3 Sept", "1"],
              ["Water", "9 Sept", "1"],
            ]
              .map(
                ([what, when, n]) =>
                  `<div style="display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid ${C.rule};">
                    <span style="flex:1;font-size:12.5px;">${what}</span>
                    <span style="font-size:11px;color:${C.muted};">${when}</span>
                    <span style="font-size:12px;">${n}</span>
                  </div>`,
              )
              .join("")}
          </div>
        </div>

        ${note("Grace holds a streak. Fines and standing are untouched.", C.muted)}`,
        "18px 20px 24px",
        22,
      ),
  ),
);

// 22. Stopping is four separate losses and the screen named none of them. One
// of them is now permanent, which is the reason this cannot stay a bare button:
// the photographs a group has seen go when sharing stops, and re-sharing later
// does not bring them back.
put(
  "V32StopTracking.dc.html",
  `<div style="position:relative;width:390px;height:844px;background:${C.bg};color:${C.fg};font-family:'IBM Plex Mono',ui-monospace,monospace;display:flex;flex-direction:column;">
    ${head("GYM", { back: true })}
    ${scroller(
      `<div style="display:flex;flex-direction:column;">
        ${setRow("How often", "3 a week")}
        ${setRow("Day starts", "Midnight")}
      </div>`,
    )}
    ${sheet(
      "Stop tracking Gym?",
      `<div style="display:flex;flex-direction:column;">
        ${consequence("Your 24 day streak goes to 0.", "Starting again starts at 1. Grace cannot restore a streak you ended yourself.")}
        ${consequence("Gym stops being shared with Morning Crew and Founders.", "They stop seeing whether you went.")}
        ${consequence("The 18 photographs they have seen leave both groups.", "Permanent. Tracking Gym again, or sharing it again, does not bring them back.")}
        ${consequence("Your ceiling in both groups drops.", "You share one fewer of what they accept.")}
      </div>
      <span style="font-size:11px;color:${C.muted};line-height:1.55;">Nothing is deleted. Your history stays, your photographs stay in Your Photos, and what you already owe stays owed.</span>`,
      "Stop tracking Gym",
      { danger: true },
    )}
  </div>`,
);

// 15. Check-in says NOTHING about groups. The tagging still happens at the
// press, which is what makes a group added tomorrow unable to reach today's
// photograph, but it is not a decision anybody makes here and a list of group
// names on the camera screen would read as one. Where a photograph went is
// answered afterwards, on the screen below, where the question is actually
// asked.
put(
  "V32Photos.dc.html",
  bare(
    head("YOUR PHOTOS", { back: true }) +
      scroller(
        [
          ["Gym", "gym", "Today &middot; 7:12 AM", [["Morning Crew", false], ["Founders", false]]],
          ["Food", "food", "Yesterday &middot; 1:40 PM", [["Founders", false]]],
          ["Gym", "gym", "12 Sept &middot; 6:58 AM", [["Morning Crew", true]]],
          ["Food", "food", "11 Sept &middot; 9:06 PM", []],
        ]
          .map(
            ([name, icon, when, tags]) =>
              `<div style="display:flex;gap:12px;padding-bottom:14px;border-bottom:1px solid ${C.rule};">
                <div style="flex:none;width:62px;height:62px;background:linear-gradient(145deg,#2b2620,#14120f);border:1px solid ${C.rule};"></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:7px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${svg(14, ACT[icon], C.muted)}
                    <span style="font-size:13px;">${name}</span>
                    <span style="margin-left:auto;font-size:10.5px;color:${C.muted};">${when}</span>
                  </div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${tags.length === 0 ? `<span style="font-size:10.5px;color:${C.dash};">Yours only</span>` : tags.map(([n, gone]) => groupTag(n, gone)).join("")}
                  </div>
                </div>
              </div>`,
          )
          .join("") +
          note(
            "A struck-through group saw this once and no longer can, because sharing stopped or you left. It does not come back.",
            C.muted,
          ),
        "18px 20px 24px",
        14,
      ),
  ),
);

// 23. Create a group was behind two conditions: not already in one, AND nothing
// tracked at all. Adding a single activity removed the only route to groups
// from Home. It stays until you are in one.
put(
  "V32HomeGroups.dc.html",
  page(
    head("CURFEW", { right: adminLink(false) }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:6px;">
          ${label("TODAY")}
          <div style="display:flex;align-items:baseline;gap:10px;">
            <span style="font-size:38px;font-weight:600;line-height:1;">1</span>
            <span style="font-size:15px;color:${C.muted};">of 2 done</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;">
          ${activityRow({ icon: "sleep", name: "Sleep", days: 3, status: "Done", done: true })}
          ${activityRow({ icon: "gym", name: "Gym", days: 1, status: "1 of 3 this week", action: { t: "Check in" } })}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid ${C.rule};padding-top:18px;">
          ${btn("Create a group", { h: 46 })}
          <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">Groups are invite-only, and they only ever see the activities you choose to share. Make one and invite the people who will notice when you stop.</span>
        </div>`,
        "18px 20px 24px",
        22,
      ),
    "home",
  ),
);

// --- v3.2: AI ---------------------------------------------------------------
//
// Four rules the screens below exist to keep visible, all decided before any of
// this was drawn:
//
//   - Nothing here is an input to scoring, a streak or a balance. Every board
//     that shows a derived number says so on the board.
//   - The app writes every sentence. The model returns fields; these templates
//     render them. There is no paragraph anywhere that a model wrote.
//   - A number read off a photograph is a range, marked estimated, because a
//     clerk states facts and that is the fact.
//   - The whole thing is one switch in Controls and it ships off.

// The estimate, in the one shape it is ever allowed to take.
const est = (lo, hi, unit) =>
  `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
    <span style="font-size:25px;font-weight:600;line-height:1;">${lo}<span style="color:${C.muted};font-weight:400;font-size:17px;"> to </span>${hi}</span>
    <span style="font-size:11.5px;color:${C.muted};">${unit}, estimated</span>
  </div>`;

const macroRow = (n, lo, hi) =>
  `<div style="flex:1;display:flex;flex-direction:column;gap:4px;">
    <span style="font-size:9.5px;letter-spacing:0.1em;color:${C.muted};">${n}</span>
    <span style="font-size:13px;">${lo}<span style="color:${C.muted};">&#8211;</span>${hi}<span style="font-size:10px;color:${C.muted};margin-left:3px;">g</span></span>
  </div>`;

// One line of the breakdown. THIS IS THE REASONING, and it is numbers rather
// than a paragraph: it is how a person tells whether the total is nonsense,
// and it leaves every sentence on the screen written by the app.
const sawRow = (item, lo, hi) =>
  `<div style="display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid ${C.rule};">
    <span style="flex:1;font-size:12.5px;">${item}</span>
    <span style="font-size:12px;color:${C.muted};">${lo} to ${hi}</span>
  </div>`;

// Every board carrying a derived number carries this. It is the whole safety
// argument in one line, and it is on the screen rather than in a doc.
const notScored = (extra = "") =>
  `<div style="border-top:1px solid ${C.rule};padding-top:11px;font-size:11px;color:${C.muted};line-height:1.55;">Estimated from the photograph${extra}. Not used for scoring, streaks or money.</div>`;

const aiThumb = (lbl, sel = false) =>
  `<div style="flex:none;width:76px;display:flex;flex-direction:column;gap:5px;">
    <div style="height:76px;background:linear-gradient(145deg,#2b2620,#14120f);border:${sel ? `2px solid ${C.fg}` : `1px solid ${C.rule}`};"></div>
    <span style="font-size:9.5px;color:${sel ? C.fg : C.muted};">${lbl}</span>
  </div>`;

// A report on the ask page. Dated, because a read is stored and kept.
const reportRow = (name, what, last) =>
  `<div style="display:flex;align-items:center;gap:11px;padding:13px 0;border-bottom:1px solid ${C.rule};">
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
      <span style="font-size:13.5px;">${name}</span>
      <span style="font-size:10.5px;color:${C.muted};line-height:1.5;">${what}</span>
      <span style="font-size:10px;color:${C.dash};">${last}</span>
    </div>
    <button type="button" style="flex:none;height:34px;padding:0 14px;border:1px solid ${C.rule};background:transparent;color:${C.fg};font-family:inherit;font-size:12px;cursor:pointer;">Run</button>
  </div>`;

// A finding. The model returns the parts; this writes the sentence.
const finding = (claim, evidence) =>
  `<div style="display:flex;flex-direction:column;gap:6px;padding:14px 0;border-bottom:1px solid ${C.rule};">
    <span style="font-size:14px;line-height:1.5;">${claim}</span>
    <span style="font-size:11px;color:${C.muted};line-height:1.55;">${evidence}</span>
  </div>`;

// --- the food check-in, with its optional note ------------------------------
// The note box belongs to the food module, not to the check-in screen, so the
// engine still does not know what a meal is. It is the person's own words, it
// goes in the event like any other entered value, and it is worth having with
// the switch off entirely.
put(
  "V32CheckinFood.dc.html",
  checkinPage({
    meta: "Food &middot; meal 3 &middot; 9:06 PM",
    required: true,
    shot: true,
    canSend: true,
    fields:
      fieldWrap("Calories", input("520", "cal"), "1700 of 2000 once this is sent.") +
      fieldWrap(
        "What was it",
        input("roti, dal, rice, salad", "", true),
        "Optional. Yours to keep, and it makes the reading better. You can add it later instead.",
      ),
  }),
);

// --- a meal, in its three states --------------------------------------------
function mealBoard(state) {
  const shot = `<div style="height:170px;background:linear-gradient(145deg,#2b2620,#14120f);border:1px solid ${C.rule};"></div>`;
  const yours = `<div style="display:flex;flex-direction:column;gap:6px;">
      ${label("RECORDED")}
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span style="font-size:19px;font-weight:600;line-height:1;">520</span>
        <span style="font-size:11.5px;color:${C.muted};">cal, entered by you. This is what counts.</span>
      </div>
    </div>`;

  let derived;
  if (state === "reading") {
    derived = `<div style="display:flex;flex-direction:column;gap:9px;">
        ${label("ESTIMATE")}
        <div style="border:1px dashed ${C.dash};background:${C.surface};padding:16px;display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:13px;color:${C.muted};">Reading the photograph.</span>
          <span style="font-size:11px;color:${C.dash};line-height:1.5;">Your check-in is already recorded. This does not hold it up and it cannot change it.</span>
        </div>
      </div>`;
  } else if (state === "unread") {
    derived = `<div style="display:flex;flex-direction:column;gap:9px;">
        ${label("ESTIMATE")}
        <div style="border:1px solid ${C.rule};background:${C.surface};padding:16px;display:flex;flex-direction:column;gap:9px;">
          <span style="font-size:13px;">Could not read this one.</span>
          <span style="font-size:11px;color:${C.muted};line-height:1.55;">The meal is recorded and counts exactly as it did. Adding what it was usually fixes the reading.</span>
          ${btn("Add what it was, and try again", { wide: true, h: 40, fs: 12.5 })}
        </div>
      </div>`;
  } else {
    derived = `<div style="display:flex;flex-direction:column;gap:13px;">
        ${label("ESTIMATE")}
        ${est("620", "780", "kcal")}
        <div style="display:flex;gap:10px;">
          ${macroRow("PROTEIN", 28, 34)}${macroRow("CARBS", 72, 88)}${macroRow("FAT", 22, 28)}
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:2px;">
          ${label("WHAT IT SAW")}
          <div style="display:flex;flex-direction:column;margin-top:7px;">
            ${sawRow("2 rotis", 240, 280)}${sawRow("Dal", 150, 190)}${sawRow("Rice", 180, 220)}${sawRow("Salad", 50, 90)}
          </div>
        </div>
        ${notScored(" and from your note")}
      </div>`;
  }

  return bare(
    head("MEAL", {
      back: true,
      right: `<span style="font-size:11px;color:${C.muted};">Meal 3 &middot; 9:06 PM</span>`,
    }) +
      scroller(
        shot +
          yours +
          `<div style="display:flex;flex-direction:column;gap:6px;">
            ${label("YOUR NOTE")}
            <span style="font-size:12.5px;line-height:1.55;color:${state === "unread" ? C.muted : C.fg};">${state === "unread" ? "Nothing written." : "roti, dal, rice, salad"}</span>
          </div>` +
          derived,
        "18px 20px 24px",
        20,
      ),
  );
}

put("V32MealReading.dc.html", mealBoard("reading"));
put("V32MealRead.dc.html", mealBoard("read"));
put("V32MealUnread.dc.html", mealBoard("unread"));

// --- the other placement, for comparison ------------------------------------
// Both numbers, side by side and never added together. What you entered is what
// the day is judged on; the estimate sits beside it and says it is not.
put(
  "V32FoodDay.dc.html",
  page(
    head("FOOD", { back: true, right: `<span style="font-size:11px;color:${C.muted};">Today</span>` }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:8px;">
          ${label("RECORDED, AND WHAT COUNTS")}
          <div style="display:flex;align-items:baseline;gap:9px;">
            <span style="font-size:27px;font-weight:600;line-height:1;">1700</span>
            <span style="font-size:12px;color:${C.muted};">of 2000 cal</span>
          </div>
          <div style="height:6px;background:${C.surface};border:1px solid ${C.rule};">
            <div style="width:85%;height:100%;background:${C.fg};"></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:11px;">
          ${label("ESTIMATED FROM THE PHOTOGRAPHS")}
          ${est("1740", "2110", "kcal")}
          <div style="display:flex;gap:10px;">
            ${macroRow("PROTEIN", 84, 102)}${macroRow("CARBS", 210, 250)}${macroRow("FAT", 62, 78)}
          </div>
          ${notScored("")}
        </div>

        <div style="display:flex;flex-direction:column;gap:2px;">
          ${label("TODAY'S MEALS")}
          <div style="display:flex;flex-direction:column;margin-top:7px;">
            ${sawRow("Meal 1 &middot; 8:12 AM", 380, 460)}${sawRow("Meal 2 &middot; 1:40 PM", 740, 870)}${sawRow("Meal 3 &middot; 9:06 PM", 620, 780)}
          </div>
        </div>`,
        "18px 20px 24px",
        22,
      ),
    "activities",
  ),
);

// --- the page for asking ----------------------------------------------------
// The only place anybody waits for a model, because they pressed the thing that
// starts it. Single-shot in both directions: a fixed set of reports, and one
// photograph with one prompt. Never a conversation, which is what keeps it from
// becoming the chat bot this was explicitly not.
put(
  "V32Ai.dc.html",
  bare(
    head("ASK", { back: true }) +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:2px;">
          ${label("REPORTS")}
          <div style="display:flex;flex-direction:column;margin-top:7px;">
            ${reportRow("This week", "What you did, what you missed, and what it cost.", "Last run 8 Sept")}
            ${reportRow("Patterns", "What tends to come before a miss, across every activity.", "Last run 1 Sept")}
            ${reportRow("Your targets", "Whether the numbers you set are the numbers you hit.", "Never run")}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:11px;">
          ${label("A MEAL")}
          <span style="font-size:12px;color:${C.muted};line-height:1.55;">Pick a photograph and say what it was. This is the same reading the app does on its own, run again with better words.</span>
          <div style="display:flex;gap:9px;overflow-x:auto;">
            ${aiThumb("Today &middot; 9:06 PM", true)}${aiThumb("Today &middot; 1:40 PM")}${aiThumb("Yest &middot; 8:30 PM")}${aiThumb("Yest &middot; 2:10 PM")}
          </div>
          ${input("roti, dal, rice, salad", "", true)}
          ${btn("Read this meal", { filled: true, h: 44 })}
          <span style="font-size:11px;color:${C.muted};line-height:1.55;">Photographs are deleted after 30 days, so meals older than that are not here to ask about.</span>
        </div>

        ${notScored("")}`,
        "18px 20px 24px",
        24,
      ),
  ),
);

// A read, rendered from fields. Every sentence on this board is written by the
// app from numbers the model returned. That is what keeps the Voice section
// applying to the surface people read most, and it is what makes the wording
// testable, which a sentence nobody wrote is not.
put(
  "V32AiRead.dc.html",
  bare(
    head("THIS WEEK", { back: true, right: `<span style="font-size:11px;color:${C.muted};">Run 7:02 AM</span>` }) +
      scroller(
        `<div style="display:flex;flex-direction:column;">
          ${finding("Gym missed 3 of its 4 days.", "4 scheduled, 1 done. Every miss was a Thursday.")}
          ${finding("Four of your five gym misses followed a night under 6 hours.", "5 misses. 4 came after a short night. 11 short nights in total.")}
          ${finding("Water finished every day.", "7 of 7. Longest run to date.")}
          ${finding("Missed days cost 300 this week.", "Two fines, both in Morning Crew, both on Thursday.")}
        </div>
        <div style="display:flex;gap:10px;">
          ${btn("Run again", { wide: false, h: 40, fs: 12.5, pad: 14 })}
          <span style="flex:1;"></span>
        </div>
        <div style="border-top:1px solid ${C.rule};padding-top:11px;font-size:11px;color:${C.muted};line-height:1.55;">Read from your own records on 15 Sept. Kept, so you can compare it with the next one. Nothing here changed a score, a streak or a balance.</div>`,
        "18px 20px 24px",
        20,
      ),
  ),
);

// --- the switch -------------------------------------------------------------
put(
  "V32Controls.dc.html",
  adminPage(
    "Controls",
    `<div style="display:flex;flex-direction:column;gap:10px;">
      ${label("THE APP")}
      <div style="display:flex;flex-direction:column;">
        ${toggleRow("Money", "Off hides money everywhere except groups you switch on by hand under Groups.", true)}
        ${toggleRow("Photo evidence", "Off means no type can ask for a photo. Existing photos are untouched.", true)}
        ${toggleRow("AI", "Off stops every photograph leaving and hides Ask. Readings already made are kept and come back with it.", false, true)}
        ${toggleRow("New groups", "Off stops anyone creating a group. Existing ones carry on.", true)}
        ${toggleRow("Invites", "Off stops every invite going out. Nobody new can join.", true)}
        ${toggleRow("Sign-ups", "Off means an approved invite is the only way in.", false)}
      </div>
      <span style="font-size:11.5px;color:${C.muted};line-height:1.55;">A switch here takes effect at once and never deletes anything. AI is off until somebody turns it on: no reading has ever been worth a fine, so nothing that is scored changes either way.</span>
    </div>`,
    saveBar(1),
  ),
);

// --- where it is reached from ------------------------------------------------
// Two boards for one decision. The header link is the house pattern already:
// Admin is reached exactly this way, from exactly this corner. The icon is what
// was asked for, and CLAUDE.md lists generic line icons as section markers among
// the visual tells to avoid, so it is drawn rather than argued about.
function homeAsk(kind) {
  const ask =
    kind === "icon"
      ? `<span style="display:flex;align-items:center;gap:6px;">${svg(17, `<path d="M4 5h16"></path><path d="M4 12h10"></path><path d="M4 19h13"></path><circle cx="19" cy="12" r="2.2"></circle>`, C.muted, 1.6)}<span style="font-size:11px;color:${C.muted};">&#8250;</span></span>`
      : `<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:${C.muted};">Ask<span>&#8250;</span></span>`;
  return page(
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 11px;border-bottom:1px solid ${C.rule};">
      <div style="display:flex;align-items:center;gap:9px;">${mark()}<span style="font-size:14px;font-weight:600;letter-spacing:0.16em;">CURFEW</span></div>
      <div style="display:flex;align-items:center;gap:14px;">${ask}${adminLink(false)}</div>
    </div>` +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:2px;">
          ${label("TODAY")}
          <div style="display:flex;flex-direction:column;margin-top:8px;">
            ${activityRow({ icon: "sleep", name: "Sleep", days: "Every day", status: "Window closed 7:45 AM", done: true })}
            ${activityRow({ icon: "food", name: "Food", days: "Every day", status: "1700 of 2000 cal", action: { t: "Log", cam: true } })}
            ${activityRow({ icon: "gym", name: "Gym", days: "3 a week", status: "2 of 3 this week", action: { t: "Check in" } })}
          </div>
        </div>`,
        "18px 20px 24px",
        22,
      ),
    "home",
  );
}

put("V32HomeLink.dc.html", homeAsk("link"));
put("V32HomeIcon.dc.html", homeAsk("icon"));

// Stats is the other entry, and the one that needs no new furniture: it is
// already where a person goes to ask about their own history.
put(
  "V32Stats.dc.html",
  page(
    head("STATS") +
      scroller(
        `<div style="display:flex;flex-direction:column;gap:11px;">
          ${label("ASK")}
          <div style="border:1px solid ${C.rule};padding:15px;display:flex;flex-direction:column;gap:10px;">
            <span style="font-size:13.5px;line-height:1.5;">A read of this week, from your own records.</span>
            <span style="font-size:11px;color:${C.muted};line-height:1.55;">Last run 8 Sept. It found that every gym miss that week was a Thursday.</span>
            ${btn("Open", { wide: false, h: 38, fs: 12.5, pad: 14 })}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:11px;">
          ${label("THIS MONTH")}
          <div style="display:flex;gap:10px;">
            ${kpi("87%", "DAYS COMPLETED")}${kpi("21", "LONGEST RUN")}${kpi("300", "FINES", C.penalty)}
          </div>
        </div>`,
        "18px 20px 24px",
        22,
      ),
    "stats",
  ),
);

const PAGES = [
  {
    id: "page-3",
    name: "v3 Home",
    files: [
      ["V3Home.dc.html", "Home (today)"],
      ["V3HomeDone.dc.html", "Home (all done)"],
      ["V3HomeNoMoney.dc.html", "Home (no money anywhere)"],
      ["V3Notice.dc.html", "Notice, over Home"],
      ["V3NoticeGroups.dc.html", "Notice, over a group"],
      ["V3HomeEmpty.dc.html", "Home (new user)"],
      ["V3HomeStart.dc.html", "Home (new user, redesigned)"],
      ["V3HomeStartInvite.dc.html", "Home (new user, invite waiting)"],
    ],
    note: "When an admin changes something and chooses to tell people, it arrives as a blocking overlay on whatever route the user is on, and nothing in the app works until it is acknowledged. Two boards show the same notice over Home and over a group. One notice at a time, and once acknowledged it never returns. Balances only appear when at least one of your groups tracks money. Turn money off everywhere and Curfew stops being a money app. Home is today at a glance. It leads with completion, not one streak, because every activity keeps its own streak on its own period. Each row carries its own flame and count, every streak number in the app wearing the flame gradient. One tap checks in. What that tap opens depends on the activity's evidence rule: nothing, a check-in page, or the camera. The two new-user boards lead with the catalog rather than a paragraph: someone who has just arrived is asking what this tracks and what happens if they miss, and four real activities naming what they measure answer that better than prose. An invite sits above that list and never instead of it, because accepting one while tracking nothing lands on the join screen with nothing to share.",
  },
  {
    id: "page-4",
    name: "v3 Activities",
    files: [
      ["V3Activities.dc.html", "Your activities"],
      ["V3Catalog.dc.html", "Add activity"],
    ],
    note: "Activities opens with your own record across everything, the global score, visible to you and nobody else. The catalog gives every type a one-word name and a line saying what it is, and adds with a plus. Both lists lead to the same configure screen on the next page.",
  },
  {
    id: "page-5",
    name: "v3 Configure",
    files: [
      ["V3CfgSleep.dc.html", "Sleep"],
      ["V3CfgGym.dc.html", "Gym"],
      ["V3CfgFood.dc.html", "Food"],
      ["V3CfgSupplements.dc.html", "Supplements"],
      ["V3CfgOffice.dc.html", "Office"],
      ["V3CfgStudy.dc.html", "Study"],
      ["V3CfgSteps.dc.html", "Steps"],
      ["V3CfgWater.dc.html", "Water"],
      ["V3CfgReading.dc.html", "Reading"],
      ["V3CfgScreen.dc.html", "Screen"],
      ["V3CfgNightfast.dc.html", "Nightfast"],
      ["V3CfgSugarfree.dc.html", "Sugar-free"],
      ["V3CfgNew.dc.html", "Steps (not tracked yet)"],
      ["V3CfgErrors.dc.html", "Validation errors"],
    ],
    note: "All twelve configure screens, so the whole catalog can be reviewed at once. Real controls: steppers for counts, segmented switches for period, day pickers, time ranges, plain number fields. Evidence is not a control, it is a property of the type, stated and not offered. A tracked activity ends with stop tracking, an untracked one with a single add button. The last board shows the validation states: bad values are marked in place, and Save stays dead until they clear.",
  },
  {
    id: "page-6",
    name: "v3 Evidence",
    files: [
      ["V3Checkin.dc.html", "Check-in (photo optional)"],
      ["V3CheckinAbstain.dc.html", "Check-in (abstinence)"],
      ["V3CheckinRequired.dc.html", "Check-in (photo required, blocked)"],
      ["V3Camera.dc.html", "Camera"],
      ["V3CaptureConfirm.dc.html", "Confirm the frame"],
      ["V3CheckinReady.dc.html", "Ready to send"],
      ["V3Recorded.dc.html", "Recorded, partial day"],
      ["V3DayComplete.dc.html", "The day is complete"],
      ["V3RecordedMotion.dc.html", "Partial day, running"],
      ["V3DayCompleteMotion.dc.html", "The stamp, running"],
    ],
    note: "An abstinence type has its own two-answer screen, because there is nothing to attach and nothing to measure. A step that asks for a photo AND NOTHING ELSE has no screen at all: the camera is the check-in, it opens straight from Home, and the frame it takes confirms with Retake, Discard and Save. Three steps work that way today, sleep's confirm, gym's session and supplements' dose, and the condition is what qualifies them rather than a list: photo required on that step, no fields, no question. Everything that also asks for a number keeps the check-in page, always the same shape: a photo slot above the activity's own fields. Optional means Send works without one. Required means Send stays dead until a photo is attached. An attached photo carries a red cross to remove it. There is no note field anywhere: it was optional, never scored, never read by anybody, and it sat on every check-in asking to be filled in. Nothing is recorded until Send. The last two boards are what Send lands on, and neither is a screen of its own: both happen over Home, because that is where the eye goes next and Home already holds every number that just moved. A partial day gets nothing over the top at all. The count rolls, the fourth segment fills, the row flips to done and the flame ticks up, inside about 400ms, with a mark down the left of the row that changed so the eye finds it. It costs no screen and interrupts nothing, which is the only reason it still holds when someone logs four glasses of water in a minute. The complete day is the one moment that earns the screen, and it fires when the last scheduled activity closes: once a day at most, and on a bad day never. A clerk stamps the form and not the line item, so the stamp lands on the date, with the day's list under it compressed to five icons in one line. Home is dimmed to 93% rather than blacked out, so the rows stay faintly legible and it reads as something that happened to the screen you were on. Curfew does not congratulate on either board: the warmth is the record itself, the streak number and the flame it already wears.",
  },
  {
    id: "page-7",
    name: "v3 Groups",
    files: [
      ["V3Groups.dc.html", "Groups"],
      ["V3GroupOverview.dc.html", "Group: overview"],
      ["V3GroupStats.dc.html", "Group: stats"],
      ["V3GroupEvidence.dc.html", "Group: evidence"],
      ["V3GroupStanding.dc.html", "Group: standing (money on)"],
      ["V3GroupStandingNoMoney.dc.html", "Group: standing (money off)"],
      ["V3GroupSettings.dc.html", "Group: settings"],
      ["V3GroupLedgerFull.dc.html", "Group: full ledger"],
      ["V3JoinShare.dc.html", "Join and choose sharing"],
      ["V3JoinSetup.dc.html", "Join: set up first"],
    ],
    note: "Group stats hang off Overview rather than taking a fifth tab: how the week went, which day was worst, how much of their own list each member hit, and what the whole group finds hard. The header is one line and the tabs sit under it with nothing competing: no chips, no counts, no second colour. Four tabs in every group. Standing puts money right after the rank, then the full ledger, which opens every fine, settlement and correction ever recorded. Sharing is one toggle per activity, with photos as a text choice underneath rather than a second toggle.",
  },
  {
    id: "page-8",
    name: "v3 Ranks",
    files: [["V3Ranks.dc.html", "How reputation works"]],
    note: "Reached from Settings and from the 'How it works' link on a group's Standing tab. DOUBT to IMMACULATE, a band on a 0 to 1000 number. IMMACULATE carries the only glow in the app.",
  },
  {
    id: "page-9",
    name: "v3 Stats",
    files: [
      ["V3Stats.dc.html", "Overview"],
      ["V3StatsSleep.dc.html", "Sleep (windowed)"],
      ["V3StatsSteps.dc.html", "Steps (numeric)"],
      ["V3StatsGym.dc.html", "Gym (weekly)"],
      ["V3StatsAbstain.dc.html", "Nightfast (abstinence)"],
    ],
    note: "Overview first: perfect days this month, three figures worth knowing, eight weeks of days shaded by how much of each you did, then every activity's pass rate side by side. Under it a picker opens one activity at a time, and the chart follows the type. A windowed type plots when it happened against the window it had to land in. A numeric one plots the value against its target. A weekly one counts sessions against the minimum. An abstinence one is held or slipped, with a mark in every cell, because that green and red pair is not safe to read on colour alone.",
  },
  {
    id: "page-10",
    name: "v3 Admin",
    files: [
      ["V3AdminOverview.dc.html", "Overview"],
      ["V3AdminUsers.dc.html", "Users"],
      ["V3AdminGroups.dc.html", "Groups"],
      ["V3AdminInsights.dc.html", "Insights"],
      ["V3AdminControls.dc.html", "Controls"],
      ["V3AdminControlsConfirm.dc.html", "Controls: confirm"],
      ["V3AdminOps.dc.html", "Ops"],
    ],
    note: "Reached from the header link, admins only, never a bottom tab. Overview is the numbers, last night's run, and the pending approvals with Approve and Reject inline. Users is a directory and nothing more: admin can see that a user has six activities, never what they are or what the photos show. Groups is the directory of every group, where money can be switched on for one group even when it is off everywhere else, and where a group is archived rather than deleted. Insights counts behaviour without reading it, including which types people add and then abandon. Controls regulates the whole app, money and photo evidence included, each switch hiding a system rather than deleting it. Nothing there saves on the flip: a flipped switch is marked unsaved, a bar offers Discard or Save, and Save asks again with the actual damage spelled out, one block a change. Telling users is a choice on that sheet, unticked by default. Ops keeps the v1 tools, recompute and drift, and adds the retention sweep.",
  },
  {
    id: "page-13",
    name: "v3 Gaps",
    files: [
      ["V3Signin.dc.html", "Sign in"],
      ["V3Pending.dc.html", "Waiting for approval"],
      ["V3Balances.dc.html", "Balances"],
      ["V3SettingsStored.dc.html", "What Curfew stores"],
      ["V3SettingsRules.dc.html", "The rules"],
      ["V3SettingsPersonal.dc.html", "Personal (unresolved)"],
      ["V3AdminReports.dc.html", "Admin: reports"],
      ["V3AdminUserOne.dc.html", "Admin: one user"],
      ["V3AdminGroupOne.dc.html", "Admin: one group"],
    ],
    note: "Nine live routes were reachable and undrawn, so nothing could tell whether they had drifted: there was nothing to drift from. Two of the nine turned out to render nothing at all, /checkin and /ledger both being redirects left over from v2.5, which leaves the seven screens here plus the two signed-out states. Every board is drawn from the route as it stands rather than redesigned, because a board is what a screen is reviewed against and inventing a different one would move the drift instead of measuring it. Balances is per person AND per group, because a settlement posts to one group's ledger, and the person owed settles from their own screen since Curfew never moves money. What Curfew stores and The rules are the consent text and the terms, readable at any time rather than only at the gate. Reports is the one place an admin sees a photograph, and only because a member asked them to. The user inspector counts behaviour and never reads it: how often somebody checked in, never what. Personal is the odd one and is marked so: its timezone half belongs there, and its sleep-windows half sets the same three windows the Sleep activity screen sets, through a different control. Two ways to change one thing is one too many, and that is a decision v3 has not made yet.",
  },
  {
    id: "page-11",
    name: "v3 Settings",
    files: [
      ["V3Settings.dc.html", "Settings"],
      ["V3SettingsSharing.dc.html", "What you share"],
      ["V3SettingsPhotos.dc.html", "Your photos"],
      ["V3Data.dc.html", "Delete data"],
    ],
    note: "Everything a user consented to is visible again here: retention, how reputation works, what is stored, what is never deleted, and every sharing toggle across every group in one place.",
  },
  {
    id: "page-31",
    name: "v3.1 Ranks and grace",
    files: [
      ["V31Ranks.dc.html", "How reputation works"],
      ["V31StandingImmaculate.dc.html", "Standing (IMMACULATE)"],
      ["V31StandingClimbing.dc.html", "Standing (UNBROKEN, climbing)"],
      ["V31GroupGrace.dc.html", "Members (someone in grace)"],
      ["V31GraceOwn.dc.html", "Standing (your own grace period)"],
      ["V31HomeGrace.dc.html", "Home (in grace somewhere)"],
    ],
    note: "Two changes. IMMACULATE was a score of 950 or more; the engine simulation showed a steady 87.5% completion settles at 969 and holds it, so the only glow in the app was being worn by a record with forty-five gaps a year. It is now the top band plus sixty days with nothing missed, and UNBROKEN moved from 850 to 900 so the top band stops covering a one-miss-a-week habit. A clean run is shown as a bar, because it is the one number a person can act on directly. The grace period is new: a member is not scored or fined by a group on the day they join, since joining at 11pm and being fined at midnight for a day you did not know you were being judged on is not accountability. Their own streak and their own record carry on untouched, which the member's own screen says in as many words. The group sees it too, on the members list, or the rest of them read a member sitting at nothing as someone who does not turn up.",
  },
  {
    id: "page-32",
    name: "v3.1 Pause",
    files: [
      ["V31PauseSettings.dc.html", "Settings (where it lives)"],
      ["V31PauseDeclare.dc.html", "Declaring a pause"],
      ["V31PauseActive.dc.html", "While it runs"],
      ["V31HomePaused.dc.html", "Home (paused)"],
      ["V31GroupPaused.dc.html", "Members (someone away)"],
      ["V31StandingPaused.dc.html", "Standing (paused)"],
      ["V31StatsPaused.dc.html", "Stats (a trip in it)"],
      ["V31GroupStatsPaused.dc.html", "Group stats (someone away)"],
      ["V31RanksQuiet.dc.html", "How it works (quiet days)"],
    ],
    note: "Reached from Settings, the same place the timezone and the sleep windows are set: a pause is rare, deliberate and global, so it is not on Home. How it works is the existing /ranks screen, reached from Settings, from the How it works link on a group Standing tab, and from Activities. A pause is a declared absence, and the design rests on one sentence: a paused day is a day with NOTHING SCHEDULED. Not a miss. That is why no fine can arise from it and why reputation is not marked down for it, both of which fall out of the engine rather than needing a rule. What it costs is the streak, outright: a streak is consecutive days and a pause is a gap, so grace does not cover one. That single decision is what removes the need for a quota. An earlier draft protected the streak too, which made a pause strictly better than being present and needed a monthly allowance, a reset date and an argument about the member stranded abroad on day 31. With the streak gone there is nothing left to game: pausing every weekend would reset the streak every weekend, and a weekday-only schedule already does the honest version of the same thing. The streak goes when the first paused day CLOSES, exactly the way a missed day takes one, not the moment the pause is declared: declaring is not itself a failure and must not read as one. Three days minimum so it is not a one-night excuse, declared in advance because declaring afterwards would convert a miss that already happened into a day that was never scheduled, and visible to the group with its dates, beside the score rather than instead of it. A member who is away still has a standing, and replacing the number with a tag reads as though they had been removed. Reputation still settles after seven quiet days, which is the second change here: that decay is now 1% of the score a day rather than a flat 3, so a 900 falls faster than a 300 and two months of silence reads as 523 rather than 738. Away four days costs nothing. Away four weeks costs what any four quiet weeks cost. The two stats boards close the last hole in it: a paused day produces no period, so before them a declared trip and a fortnight of not turning up drew the identical hole in the heatmap, and the screen could not tell a member which one they were looking at. An away day is now drawn rather than left blank, dashed and in the accent, in the legend and named with its dates underneath. Group stats cannot draw a member's days at all, so it says who is away and until when, above the two numbers those days are missing from, and shows the member with their dates rather than a bar at nothing, which would read as a week of failures."
  },
  // --- recovered 2026-09-15 ------------------------------------------------
  // These four pages and their thirteen boards were on the published canvas and
  // in NO generator. Nothing here builds them: the code that drew them is gone,
  // and the rendered .dc.html in .design/ is the only copy that exists. They are
  // listed so the layout keeps them and so a re-seed cannot quietly delete them,
  // which is exactly what was about to happen. Do not run a clean of .design/
  // expecting this file to put them back, because it cannot.
  {
    id: "page-33",
    name: "v3.1 Item 1 Capture",
    files: [
      ["V31CaptureE.dc.html", "Photo + one field (Food)", 0, 0],
      ["V31CaptureE2.dc.html", "Photo + no fields (Gym)", 470, 0],
      ["V31CaptureE3.dc.html", "Fields + no photo (Study)", 940, 0],
      ["V31HomeDeclare.dc.html", "Declared on Home, no screen at all", 1410, 0],
    ],
    note: "Item 1, settled on E. The photograph takes every pixel that is left and the sheet under it is exactly as tall as its contents, which is one rule rather than one picture: Food has a field, Gym has none and so gets an enormous photograph, Study has no photograph at all and the sheet becomes the whole screen. Adding an activity type never touches this.\n\nThe cross and Discard were the same action wearing two labels, which is why neither read as anything. There is one of each now: the cross LEAVES and nothing is recorded, Retake sits on the photograph because it is about the photograph, and Send is the only thing on the bottom edge. A photograph you do not want is one you retake or one you leave, and there was never a third thing for Discard to mean.\n\nThe fourth board is the other half of the ask: an abstinence type has no fields and no photograph, so it needs no screen at all. The row opens on Home, you answer there, and the line underneath says which answer stands.",
  },
  {
    id: "page-34",
    name: "v3.1 Item 2 Sign in",
    files: [
      ["V31SigninE.dc.html", "The landing page", 0, 0],
    ],
    note: "Item 2. The wordmark was the thing that was off: cutting the page to nine words had shrunk CURFEW to 12px and the brand disappeared off its own landing page. It is back at 30px, anchored at the top where it belongs, and one real sentence sits under the headline saying what the app does, since nine words turned out to be fewer than a stranger needs.\n\nStill one screen and no scrolling. Three photographs, because the fastest way to explain an app about evidence is to show evidence, and a line under them saying what happens to those photographs, which is the question anybody sensible asks next. One call to action.\n\nNo testimonials, no user count, no logos. There are three users, and an invented number would be the one dishonest thing on a page whose whole pitch is honesty.",
  },
  {
    id: "page-35",
    name: "v3.1 Item 5 Configure",
    files: [
      ["V31ConfigureD.dc.html", "Setting up: Gym", 0, 0],
      ["V31ConfigureDSleep.dc.html", "Setting up: Sleep", 470, 0],
      ["V31ConfigureC.dc.html", "Editing: Gym", 0, 1000],
      ["V31ConfigureCSleep.dc.html", "Editing: Sleep, the hard one", 470, 1000],
      ["V31ConfigureCFood.dc.html", "Editing: Food", 940, 1000],
      ["V31ConfigureCSugar.dc.html", "Editing: Sugar-free, the easy one", 1410, 1000],
    ],
    note: "Item 5, one screen with two presentations rather than two screens. Setting up on the top row, editing on the bottom. Same field list, same validation, one code path: two implementations of a screen that twelve modules feed is how drift starts.\n\nText is cut to what a person cannot work out for themselves. The \"Next: ...\" line under the wizard is gone, because a progress rule at the top already says how far along you are and naming the next question does not help you answer this one. \"Changes start tomorrow\" lost the clause explaining why, which the person has either already understood or does not need at the moment they are changing a number.\n\nThe bottom row is the part worth checking, because it is one design meeting three shapes. Sleep is the hard one: three time ranges, six times, which as a form is the screen everybody complained about and as a list is five rows. Food carries the sentence about both conditions holding, which is exactly the thing nobody could see in item 8. Sugar-free has almost nothing and says so, rather than leaving somebody hunting for settings they assume they have missed.\n\nThe prose at the top is the module writing its own rule, the way it already writes the line under a row on Home. The engine never assembles that sentence, so nothing here learns what a night or a meal is.",
  },
  {
    id: "page-36",
    name: "v3.1 Item 12 Group settings",
    files: [
      ["V31GroupSettings.dc.html", "Yours", 0, 0],
      ["V31GroupOwner.dc.html", "The group, owner only", 470, 0],
    ],
    note: "Item 12. The same brief as item 5, on a screen that was 581 lines and five labelled sections in one scroll, mixing what only you can change with what only an owner can. One switch at the top splits them. Yours carries the two sharing toggles per activity, the ceiling they buy you stated as a number rather than left to be worked out, and what the group costs you. The group carries what an owner decides, four rows deep rather than four sections long, and says in one line that nothing in it touches what you personally share. A member who is not an owner sees the switch with the right half absent, not greyed. The ceiling box is written the way item 11 now behaves: a number you can raise by sharing more, and stopping tracking an activity un-shares it and settles you at the lower one.",
  },
  {
    id: "page-38",
    name: "v3.2 Fixes",
    files: [
      ["V32SleepSetup.dc.html", "Sleep, with the confirm fixed"],
      ["V32SleepNotice.dc.html", "The 3.2.0 release note"],
      ["V32GraceHome.dc.html", "Grace: the action, on Home"],
      ["V32GraceOffer.dc.html", "Grace: the press"],
      ["V32GraceSettings.dc.html", "Grace: where the count lives"],
      ["V32Grace.dc.html", "Grace: the screen behind it"],
      ["V32StopTracking.dc.html", "Stopping, with what it costs"],
      ["V32Photos.dc.html", "Your photos, and who saw them"],
      ["V32HomeGroups.dc.html", "Home keeps Create a group"],
    ],
    note: "Items 15, 17, 19, 20, 22 and 23. SLEEP is the redesign here, not the strings: a confirm window that opens 30 minutes after the WAKE PRESS is anchored to an event, and every window until now has been a clock time in config. It stops being a setting because a confirm you place yourself can be placed where you are already up, and it carries the only photograph sleep asks for, which is why it survives at all. Existing members meet the change through the notice overlay that already exists and already blocks. Nothing new is built for it: a release note is a notice whose body came from release-notes.json instead of from a controls change, and the app cannot tell the difference. The words on that board are READ from that file rather than typed again here, because an artboard that paraphrases what ships disagrees with it by the second edit. It carries every change in the release, not only sleep, since that is what one person is made to read before they can use the app again. Two entries, not three: photographs stopped reaching groups joined after they were taken, which is real and is a privacy improvement, and it was cut because nobody was relying on the old behaviour and nobody has to act on the new one. The overlay blocks the whole app, so an entry that did not need reading spends something that only runs out once. It reaches only accounts that existed when it was published, which is decision 80 and exactly right here, and it starts tomorrow because config is insert-only with a future effective date. GRACE becomes one pool for the account: two a month per activity tracked, spent by hand, one grace per missed DAY so a weekly activity costs what it actually missed. It is fungible on purpose. Putting all of it on one activity is allowed, because grace holds a STREAK and nothing else, so doing that costs a fine and a dip in standing every time and needs no rule to discourage it. A per-activity cap would collapse the pool back into today's allowance with a button on it. The question was never the arithmetic, it was WHERE. Home carries the action and changes as little as possible: the status line still says what the week is doing, nothing states the price, and exactly two things differ from a normal row. The flame is out, which is the whole message and needs no words, and a Restore sits beside Check in, outlined so it reads as secondary while Check in keeps the filled treatment it has everywhere. Snapchat is the reference for the extinguished flame and only for that; its rounded pill and glow are both named in CLAUDE.md as things not to drift toward. Settings carries the count, beside retention and how reputation works, because it is the same kind of fact: a rule the app applies to you. A streak can break by more than you can afford. A week away from a daily activity costs seven grace and somebody holding six cannot take it, so Home shows no Restore on that row at all: a disabled control is a thing to wonder about on the screen looked at most, and the grey flame alone is what a broken streak looked like before any of this. The grace screen keeps the offer, drops its button and says what it needs against what you have, which makes it the one place that explains the row. CHECK-IN says nothing about groups. The tagging still happens at that press, which is what stops a group added tomorrow reaching today's photograph, but it is not a decision made there and a list of group names on the camera screen would read as one. Where a photograph went is answered on Your Photos, and a struck-through group saw it once and cannot any more. STOPPING an activity was a bare button and is four separate losses, one of them permanent: the photographs a group has seen leave when sharing stops and re-sharing does not bring them back. Home keeps Create a group until somebody is actually in one.",
  },
  {
    id: "page-37",
    name: "v3.2 AI",
    files: [
      ["V32CheckinFood.dc.html", "Check in (food, with the note)"],
      ["V32MealReading.dc.html", "A meal, being read"],
      ["V32MealRead.dc.html", "A meal, read"],
      ["V32MealUnread.dc.html", "A meal it could not read"],
      ["V32FoodDay.dc.html", "The day (the other placement)"],
      ["V32Ai.dc.html", "Ask"],
      ["V32AiRead.dc.html", "A read of this week"],
      ["V32Controls.dc.html", "Controls (the switch)"],
      ["V32HomeLink.dc.html", "Home (Ask as a link)"],
      ["V32HomeIcon.dc.html", "Home (Ask as an icon)"],
      ["V32Stats.dc.html", "Stats (the other entry)"],
    ],
    note: "AI, and the rules it is drawn to keep visible. Nothing on any of these boards is an input to scoring, a streak or a balance, and every board carrying a derived number says so on the board rather than in a document. That single decision is what makes the rest cheap: no period is ever judged against a reading, so the Controls switch needs no as-of resolution, and a wrong answer is a disappointing feature rather than a false fine. The app writes every sentence. The model returns fields and these templates render them, which is what keeps the Voice section applying to the surface people read most and what makes the wording testable, because a sentence nobody wrote cannot be. Asked for the model's reasoning too, which contradicts that, since reasoning is prose. WHAT IT SAW answers the same need better: each thing the model says it saw with its own numbers, adding to the total, which is how a person tells whether 620 is nonsense. A number read off a photograph is a range and marked estimated, because a clerk states facts and that is the fact about it; a single number would claim a precision the photograph cannot carry. Food is the only activity. Deriving numbers from photographs for the other eleven was dropped: it only ever paid for itself by filling the field and saving the typing, and since a model's number never reaches scoring, what was left was a record nobody asked for. The note box is the person's own words, goes in the check-in event like any other entered value, and stays when the switch is off, because the switch governs the call and not the person. Three meal states are drawn, not two: a meal between the press and the answer, and a meal that could not be read, are states the screen has whether or not anybody designed them, and the first of them is the whole latency argument made visible, since the check-in is already recorded before the reading starts. Ask is the only place anybody waits for a model, because they pressed the thing that starts it, and it is single-shot in both directions so it cannot drift into the chat bot this was explicitly not. Two open questions are drawn rather than argued: whether the reading belongs on the meal or on the day, and whether Home reaches Ask by a link or an icon. The link is the house pattern, since Admin is reached exactly that way from exactly that corner, and CLAUDE.md lists generic line icons as section markers among the visual tells to avoid.",
  },
];

const KEEP_PAGES = [
  { id: "page-1", name: "v2.5 App" },
  { id: "page-2", name: "v2.5 Admin" },
];

const V25 = [
  ["Main.dc.html", 0, 0, "Home", "page-1"],
  ["Loading.dc.html", 470, 0, "Loading", "page-1"],
  ["Groups.dc.html", 940, 0, "Groups", "page-1"],
  ["GroupHub.dc.html", 1410, 0, "Group hub", "page-1"],
  ["Ledger.dc.html", 1880, 0, "Group ledger", "page-1"],
  ["GroupWake.dc.html", 2350, 0, "Group wake", "page-1"],
  ["Balances.dc.html", 2820, 0, "Balances", "page-1"],
  ["GroupHubOwner.dc.html", 3290, 0, "Group hub (make owner)", "page-1"],
  ["Rules.dc.html", 0, 1000, "Group rules", "page-1"],
  ["Stats.dc.html", 470, 1000, "Stats", "page-1"],
  ["Settings.dc.html", 940, 1000, "Settings", "page-1"],
  ["Signin.dc.html", 1410, 1000, "Sign in", "page-1"],
  ["Pending.dc.html", 1880, 1000, "Pending", "page-1"],
  ["HomeNew.dc.html", 2350, 1000, "Home (new user)", "page-1"],
  ["HomeNewInvite.dc.html", 2820, 1000, "Home (new + invite)", "page-1"],
  ["AdminOverview.dc.html", 0, 0, "Admin overview", "page-2"],
  ["AdminUsers.dc.html", 470, 0, "Admin users", "page-2"],
  ["AdminInsights.dc.html", 940, 0, "Admin insights", "page-2"],
  ["AdminOps.dc.html", 1410, 0, "Admin ops", "page-2"],
];

const artboards = V25.map(([file, x, y, title, pg]) => ({ file, x, y, w: 390, h: 844, title, page: pg }));
const annotations = [
  { id: "app", x: 0, y: -140, w: 900, text: "v2.5, shipped. One bottom nav, Home as the command center, a tabbed group hub.", page: "page-1" },
  { id: "admin", x: 0, y: -140, w: 900, text: "Admin console, reached from the header for admins only. Never a bottom tab.", page: "page-2" },
];

for (const p of PAGES) {
  // A fourth and fifth element pin a board where it already sits. The recovered
  // v3.1 item pages below are laid out by hand (page-35 is 2 over 4, not 5 in a
  // row), and auto-laying them out again would move somebody's work.
  p.files.forEach(([file, title, x, y], i) => {
    artboards.push({
      file,
      x: x === undefined ? (i % 5) * 470 : x,
      y: y === undefined ? Math.floor(i / 5) * 1000 : y,
      w: 390,
      h: 844,
      title,
      page: p.id,
    });
  });
  annotations.push({
    id: p.id,
    x: 0,
    y: -150,
    w: Math.max(900, Math.min(p.files.length, 5) * 470 - 80),
    text: p.note,
    page: p.id,
  });
}

files["canvas.json"] = JSON.stringify(
  {
    pages: [...KEEP_PAGES, ...PAGES.map((p) => ({ id: p.id, name: p.name }))],
    artboards,
    annotations,
    launch: { view: "canvas", page: "page-38" },
  },
  null,
  2,
);

for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(DIR, name), content);
}
console.log(`wrote ${Object.keys(files).length} files`);
