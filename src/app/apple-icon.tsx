import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The iOS home-screen icon: a full-bleed near-black ground with three paper
// squares, the bottom-right seat left empty. iOS masks the corners itself, so
// the tile stays square with zero radius (house style).
//
// The mark takes 58% of the tile, centred, and that number is the whole point
// of this file. It used to be drawn with a 2/32 margin, so the squares reached
// 87% of the width and the icon read as a full-bleed checkerboard with its
// corners clipped off, sitting on a home screen where every other app keeps
// its glyph well inside the tile. iOS applies no padding of its own: an icon
// is exactly as tight as it is drawn, and 58% is roughly where Apple's own
// apps sit.
const GROUND = "#0b0a09";
const MARK = "#f2f2f2";
const SCALE = 0.58;

export default function AppleIcon() {
  // The mark is two squares and one gutter across, 28 units on the 32 grid the
  // rest of the brand is authored on.
  const art = size.width * SCALE;
  const unit = art / 28;
  const square = Math.round(13 * unit);
  const gutter = Math.round(2 * unit);

  const cell = (filled: boolean) => ({
    width: square,
    height: square,
    display: "flex",
    background: filled ? MARK : GROUND,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          background: GROUND,
          display: "flex",
          // Centred rather than padded, so the margin cannot drift out of
          // agreement with the scale above.
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: gutter }}>
          <div style={{ display: "flex", gap: gutter }}>
            <div style={cell(true)} />
            <div style={cell(true)} />
          </div>
          <div style={{ display: "flex", gap: gutter }}>
            <div style={cell(true)} />
            <div style={cell(false)} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
