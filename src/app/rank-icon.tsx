import { rankFor, isImmaculate, type RankKey } from "@/domain";

// The rank icons: shield slashed, sprout, target, shield ticked, summit.
// In a list the icon and the colour carry the rank and the word is dropped
// (decision 40).

const PATHS: Record<RankKey, React.ReactNode> = {
  doubt: (
    <>
      <path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z" />
      <path d="M7 18 17 6.6" />
    </>
  ),
  intent: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13C12 9.2 9.2 7 5.5 7c0 3.8 2.7 6 6.5 6Z" />
      <path d="M12.5 13c0-3.2 2.4-5.2 5.8-5.2 0 3.2-2.4 5.2-5.8 5.2Z" />
    </>
  ),
  practice: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  discipline: (
    <>
      <path d="M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z" />
      <path d="M8.7 11.8 11.2 14.3 15.6 9.8" />
    </>
  ),
  unbroken: (
    <>
      <path d="M2.5 20 9 7.5 12.4 14 15 9.6 21.5 20Z" />
      <path d="M6.6 14.2h4.6" />
    </>
  ),
};

export const RANK_TEXT: Record<RankKey, string> = {
  doubt: "text-rank-doubt",
  intent: "text-rank-intent",
  practice: "text-rank-practice",
  discipline: "text-rank-discipline",
  unbroken: "text-rank-unbroken",
};

// A parallel table, not RANK_TEXT with its prefix swapped at runtime: Tailwind
// only generates a utility for a class name it can find literally in source,
// so a string built with .replace() at runtime (e.g. "text-x".replace("text-",
// "bg-")) never gets its CSS emitted at all. Every consumer that needs a fill
// colour rather than a text colour must use this table instead.
export const RANK_BG: Record<RankKey, string> = {
  doubt: "bg-rank-doubt",
  intent: "bg-rank-intent",
  practice: "bg-rank-practice",
  discipline: "bg-rank-discipline",
  unbroken: "bg-rank-unbroken",
};

export function RankIcon({ score, size = 17 }: { score: number; size?: number }) {
  const rank = rankFor(score);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      // IMMACULATE carries the only glow in the app, which is what makes it
      // mean anything.
      style={isImmaculate(score) ? { filter: "drop-shadow(0 0 6px var(--gold))" } : undefined}
    >
      {PATHS[rank.key]}
    </svg>
  );
}

/** The icon and the number, in the rank's colour. The word is dropped. */
export function RankScore({ score, size = 17 }: { score: number; size?: number }) {
  const rank = rankFor(score);
  return (
    <span className={"flex flex-none items-center gap-2 " + RANK_TEXT[rank.key]}>
      <RankIcon score={score} size={size} />
      <span className="text-[15px] tabular-nums">{Math.round(score)}</span>
    </span>
  );
}
