import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// The card a link to Curfew draws when it is pasted into a chat.
//
// This is the one piece of "SEO" on an invite-only app that anybody actually
// sees, because an invite reaches somebody as a link in a message. Without it
// the preview is a bare domain and a favicon.
//
// Drawn rather than photographed: it must not show a member's evidence. The
// sign-in page is the one screen served to people who are not signed in, and
// its card is served to more people still.
//
// Satori (behind ImageResponse) supports a subset of CSS: flex only, no grid,
// and every element with more than one child needs an explicit `display`.
export const alt = "Curfew. Track what you said you would do, and prove it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The app's own typeface, for the app's own card.
 *
 * Satori ships no fonts and cannot read woff2, so this is the TTF out of
 * `assets/` rather than the woff2 the browser gets. Without it the card comes
 * out in Satori's default sans, which is the one thing CLAUDE.md names under
 * visual tells to avoid, on the most-shared image the project has.
 */
async function plex(weight: 400 | 600) {
  return readFile(path.join(process.cwd(), "assets", "fonts", `ibm-plex-mono-${weight}.ttf`));
}

export default async function OpengraphImage() {
  const bg = "#0b0a09";
  const fg = "#f2f2f2";
  const muted = "#8c8c8c";
  const rule = "#2e2c28";

  // The quorum mark, on the same 32 grid as the icon.
  const unit = 88 / 32;
  const box = Math.round(13 * unit);
  const cell = {
    width: box,
    height: box,
    background: fg,
    display: "flex",
  } as const;

  const [regular, semibold] = await Promise.all([plex(400), plex(600)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          background: bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          fontFamily: "IBM Plex Mono",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: Math.round(2 * unit) }}>
            <div style={{ display: "flex", gap: Math.round(2 * unit) }}>
              <div style={cell} />
              <div style={cell} />
            </div>
            <div style={{ display: "flex", gap: Math.round(2 * unit) }}>
              <div style={cell} />
              <div style={{ ...cell, background: bg }} />
            </div>
          </div>
          <div
            style={{
              color: fg,
              fontSize: 58,
              letterSpacing: 14,
              display: "flex",
            }}
          >
            CURFEW
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: fg, fontSize: 68, lineHeight: 1.15, display: "flex" }}>
            Prove it, or it didn&apos;t happen.
          </div>
          <div style={{ color: muted, fontSize: 30, lineHeight: 1.4, display: "flex" }}>
            Twelve habits on your own schedule. Photo evidence where one is
            worth having.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `2px solid ${rule}`,
            paddingTop: 26,
            color: muted,
            fontSize: 26,
          }}
        >
          <div style={{ display: "flex" }}>Invite only</div>
          <div style={{ display: "flex" }}>curfew.amanarya.com</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "IBM Plex Mono", data: regular, weight: 400, style: "normal" },
        { name: "IBM Plex Mono", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
