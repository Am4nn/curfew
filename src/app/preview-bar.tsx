"use client";

import { useEffect, useState } from "react";

// A dev-only overlay to drive the mock clock. It writes the `mock_now` cookie
// (an ISO instant) that src/lib/clock.ts reads, then reloads so the server
// re-renders as of that instant. Only mounted when preview mode is on.
const COOKIE = "mock_now";

// The seeded preview user is in Asia/Kolkata, which has no DST, so the window
// presets build an exact IST instant with a fixed +05:30 offset regardless of
// the tester's own timezone.
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
  const [value, setValue] = useState("");
  const [mocking, setMocking] = useState(false);

  useEffect(() => {
    const iso = readCookie(COOKIE);
    setMocking(!!iso);
    setValue(toLocalInput(iso ? new Date(iso) : new Date()));
  }, []);

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
  // Jump to a wall-clock time (IST) on the currently selected date.
  function jump(h: number, m: number) {
    const date = (value || toLocalInput(new Date())).slice(0, 10);
    applyInstant(new Date(`${date}T${pad(h)}:${pad(m)}:00${IST}`));
  }

  const box: React.CSSProperties = {
    font: "12px ui-monospace, monospace",
    border: "1px solid var(--rule)",
    background: "var(--surface)",
    color: "var(--fg)",
    padding: "4px 8px",
    borderRadius: 0,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "var(--bg)",
        borderTop: "1px solid var(--fg)",
        font: "12px ui-monospace, monospace",
        color: "var(--fg)",
      }}
    >
      <strong style={{ letterSpacing: "0.12em" }}>PREVIEW</strong>
      <span style={{ color: mocking ? "var(--penalty)" : "var(--muted)" }}>
        {mocking ? "mock clock" : "live clock"}
      </span>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ ...box, cursor: "text" }}
      />
      <button style={box} onClick={apply}>set</button>
      <button style={box} onClick={() => jump(22, 30)}>night 22:30</button>
      <button style={box} onClick={() => jump(6, 30)}>wake 06:30</button>
      <button style={box} onClick={() => jump(7, 35)}>confirm 07:35</button>
      <button style={box} onClick={reset}>real now</button>
      <span style={{ color: "var(--muted)" }}>windows are IST</span>
    </div>
  );
}
