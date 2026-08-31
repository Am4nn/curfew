"use client";

import { useEffect } from "react";

// Catches failures in the root layout itself. It renders in place of the whole
// document, so there is no Tailwind and no theme cookie here. Styles are inline
// and fixed to the dark palette (the app default), IBM Plex Mono with a
// monospace fallback.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#0b0a09",
          color: "#f2f2f2",
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          fontSize: 15,
          lineHeight: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "26px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.2em" }}>
            CURFEW
          </div>
          <div
            style={{
              borderLeft: "3px solid #e4574b",
              background: "#17150f",
              padding: "11px 12px 11px 13px",
            }}
          >
            <p style={{ margin: 0, fontSize: 14 }}>The app failed to load.</p>
            {error.digest ? (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8c8c8c" }}>
                Reference {error.digest}
              </p>
            ) : null}
          </div>
          <div>
            <button
              onClick={reset}
              style={{
                font: "inherit",
                fontSize: 14,
                padding: "15px",
                background: "transparent",
                color: "#f2f2f2",
                border: "1px solid #f2f2f2",
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
