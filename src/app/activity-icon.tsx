// The twelve activity icons, exactly as drawn in `.design/build-v3.mjs`. One
// 24-box grid, square caps, stroke 1.6, currentColor. No emoji, no icon font.
const PATHS: Record<string, React.ReactNode> = {
  sleep: <path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z" />,
  gym: (
    <>
      <path d="M4 9v6" />
      <path d="M7 6.5v11" />
      <path d="M17 6.5v11" />
      <path d="M20 9v6" />
      <path d="M7 12h10" />
    </>
  ),
  food: (
    <>
      <path d="M3.5 11h11a5.5 5.5 0 0 1-11 0Z" />
      <path d="M3.5 19h11" />
      <path d="M19 4v16" />
      <path d="M19 4c1.6 0 2.5 1.4 2.5 3.2S20.6 10.5 19 10.5" />
    </>
  ),
  supplements: (
    <>
      <path d="M6.5 13.5 13.5 6.5a4 4 0 0 1 5.6 5.6l-7 7a4 4 0 0 1-5.6-5.6Z" />
      <path d="M10 10l5.6 5.6" />
    </>
  ),
  office: (
    <>
      <path d="M4 20V5h10v15" />
      <path d="M14 10h6v10" />
      <path d="M7 8h1.5" />
      <path d="M10 8h1.5" />
      <path d="M7 12h1.5" />
      <path d="M10 12h1.5" />
      <path d="M7 16h4.5" />
    </>
  ),
  study: (
    <>
      <path d="M4 5h7v14H4z" />
      <path d="M13 5h7v14h-7z" />
      <path d="M11 5v14" />
    </>
  ),
  steps: (
    <>
      <path d="M6 4c1.6 0 2.5 1.6 2.5 4S8 12.5 6 12.5 3.5 11 3.5 8.5 4.4 4 6 4Z" />
      <path d="M4 15h4v3.5H4z" />
      <path d="M17 8c1.6 0 2.5 1.6 2.5 4s-.5 4.5-2.5 4.5-2.5-1.5-2.5-4S15.4 8 17 8Z" />
      <path d="M15 19h4v2.5h-4z" />
    </>
  ),
  water: <path d="M12 3.2c3.4 4 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 2.6-6 6-10Z" />,
  reading: (
    <>
      <path d="M12 7.2C10 5.4 7.4 4.6 3.5 4.6V18c3.9 0 6.5.8 8.5 2.6" />
      <path d="M12 7.2c2-1.8 4.6-2.6 8.5-2.6V18c-3.9 0-6.5.8-8.5 2.6" />
      <path d="M12 7.2v13.4" />
    </>
  ),
  screen: (
    <>
      <rect x="6" y="2.6" width="12" height="18.8" />
      <path d="M10 5.6h4" />
      <path d="M12 10v3.2l2.2 1.6" />
    </>
  ),
  nightfast: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3 2" />
      <path d="M6 18 18 6" />
    </>
  ),
  sugarfree: (
    <>
      <path d="M4.6 8.6 12 4.4l7.4 4.2v6.8L12 19.6 4.6 15.4Z" />
      <path d="M6 18.4 18 5.6" />
    </>
  ),
};

export function ActivityIcon({ name, size = 18 }: { name: string; size?: number }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}

// The camera, struck through where a type takes no photo at all.
export function CameraIcon({ size = 17, struck = false }: { size?: number; struck?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="14" />
      <path d="M8 6l1.5-2h5L16 6" />
      <circle cx="12" cy="13" r="3.2" />
      {struck ? <path d="M4 20 20 4" /> : null}
    </svg>
  );
}

// Every streak number in the app wears the flame gradient.
export function Flame({ size = 13 }: { size?: number }) {
  const id = `flame-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="flex-none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ffc24b" />
          <stop offset="55%" stopColor="#ff7a2f" />
          <stop offset="100%" stopColor="#e4574b" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c2.5 3.5 4.6 5.6 4.6 9.1a4.6 4.6 0 0 1-9.2 0c0-1.5.5-2.6 1.5-3.7C10.4 8.6 12 6.1 12 2Z"
        fill={`url(#${id})`}
      />
      <path
        d="M12 12.4c1 .9 1.6 1.7 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-.8.5-1.6 1.6-2.8Z"
        fill="#ffe6a1"
      />
    </svg>
  );
}

export function StreakNumber({ value, size = 30 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-[9px]">
      <Flame size={size} />
      <span
        className="bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text font-semibold leading-none text-transparent tabular-nums"
        style={{ fontSize: size }}
      >
        {value}
      </span>
    </span>
  );
}
