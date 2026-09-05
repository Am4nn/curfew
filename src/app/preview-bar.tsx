"use client";

import { useState } from "react";
import { useClientValue } from "./use-client-value";

// A dev-only floating control for the mock clock. Collapsed it is a small dot in
// the corner (like a dev indicator) so it never covers the UI; click to expand
// the controls. It writes the `mock_now` cookie that src/lib/clock.ts reads,
// then reloads so the server re-renders as of that instant. Only mounted in
// preview mode.
const COOKIE = "mock_now";

// The seeded preview user is in Asia/Kolkata (no DST), so window presets build an
// exact IST instant with a fixed +05:30 offset regardless of the tester's zone.
const IST = "+05:30";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PreviewBar() {
  // The cookie is the browser's to answer, and it does not change under us: the
  // only things that write it reload the page straight afterwards.
  const iso = useClientValue(() => readCookie(COOKIE), null);
  const mocking = iso !== null;
  const [open, setOpen] = useState(false);

  // The field shows the mocked instant until somebody types, and then it is
  // theirs. Seeded with "now" on first focus rather than at render, because a
  // snapshot built from the clock would differ on every pass.
  const [typed, setTyped] = useState<string | null>(null);
  const value = typed ?? (iso ? toLocalInput(new Date(iso)) : "");

  function applyInstant(d: Date) {
    if (Number.isNaN(d.getTime())) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(d.toISOString())}; path=/; max-age=31536000`;
    location.reload();
  }
  function apply() {
    applyInstant(new Date(value));
  }
  function reset() {
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    location.reload();
  }
  function jump(h: number, m: number) {
    const date = (value || toLocalInput(new Date())).slice(0, 10);
    applyInstant(new Date(`${date}T${pad(h)}:${pad(m)}:00${IST}`));
  }

  const dot = mocking ? "#e4574b" : "#6ba17f";
  const btn: React.CSSProperties = {
    font: "12px ui-monospace, monospace",
    border: "1px solid var(--rule)",
    background: "var(--surface)",
    color: "var(--fg)",
    padding: "5px 9px",
    borderRadius: 0,
    cursor: "pointer",
  };

  return (
    <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 9999, font: "12px ui-monospace, monospace" }}>
      {open ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: 232,
            padding: 12,
            marginBottom: 10,
            background: "var(--bg)",
            border: "1px solid var(--fg)",
            color: "var(--fg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ letterSpacing: "0.12em" }}>PREVIEW CLOCK</strong>
            <span style={{ color: mocking ? "#e4574b" : "var(--muted)" }}>{mocking ? "mock" : "live"}</span>
          </div>
          <input
            type="datetime-local"
            value={value}
            onFocus={() => {
              if (value === "") setTyped(toLocalInput(new Date()));
            }}
            onChange={(e) => setTyped(e.target.value)}
            style={{ ...btn, cursor: "text", width: "100%" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btn, flex: 1 }} onClick={apply}>set</button>
            <button style={{ ...btn, flex: 1 }} onClick={reset}>real now</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btn, flex: 1 }} onClick={() => jump(22, 30)}>night</button>
            <button style={{ ...btn, flex: 1 }} onClick={() => jump(6, 30)}>wake</button>
            <button style={{ ...btn, flex: 1 }} onClick={() => jump(7, 35)}>confirm</button>
          </div>
          <span style={{ color: "var(--muted)" }}>windows are IST</span>
        </div>
      ) : null}

      <button
        aria-label="Preview clock"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid var(--rule)",
          background: "var(--bg)",
          color: "var(--fg)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot }} />
      </button>
    </div>
  );
}
