// The 3a Quorum mark: three squares, the fourth seat empty. Fill is the theme
// foreground token, so it follows light and dark without a second asset.
export function QuorumMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="var(--fg)"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="2" y="2" width="13" height="13" />
      <rect x="17" y="2" width="13" height="13" />
      <rect x="2" y="17" width="13" height="13" />
    </svg>
  );
}
