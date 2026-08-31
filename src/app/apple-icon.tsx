import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// 3a Quorum as the iOS home-screen icon: a full-bleed near-black ground with
// three paper squares, the bottom-right seat left empty. iOS masks the corners
// itself, so the tile stays square with zero radius (house style).
export default function AppleIcon() {
  const ground = "#0b0a09";
  const mark = "#f2f2f2";
  const s = 180 / 32; // the marks are authored on a 32 grid
  const square = 13 * s;
  const gutter = 2 * s;
  const margin = 2 * s;
  const cell = (filled: boolean) => ({
    width: square,
    height: square,
    display: "flex",
    background: filled ? mark : ground,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: ground,
          display: "flex",
          flexDirection: "column",
          padding: margin,
          gap: gutter,
        }}
      >
        <div style={{ display: "flex", gap: gutter }}>
          <div style={cell(true)} />
          <div style={cell(true)} />
        </div>
        <div style={{ display: "flex", gap: gutter }}>
          <div style={cell(true)} />
          <div style={cell(false)} />
        </div>
      </div>
    ),
    size,
  );
}
