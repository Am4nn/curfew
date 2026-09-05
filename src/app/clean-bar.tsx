import { IMMACULATE_CLEAN_DAYS, daysToImmaculate } from "@/domain";

// How far a record is from IMMACULATE, counted in days with nothing missed.
//
// Gold, because it measures the one thing gold means here. It is the only bar
// in the app that is not a score: the score says how you have been doing, this
// says how long since you last let a day go.
export function CleanBar({ cleanDays }: { cleanDays: number }) {
  const need = IMMACULATE_CLEAN_DAYS;
  const left = daysToImmaculate(cleanDays);
  const done = Math.min(cleanDays, need);

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11.5px] text-muted">
          {done} of {need} clean days
        </span>
        <span className="text-[11px] text-muted">
          {left === 0 ? "held" : `${left} to go`}
        </span>
      </div>
      <div className="relative h-[5px] bg-rule">
        <div
          className="absolute inset-y-0 left-0 bg-gold"
          style={{ width: `${Math.round((done / need) * 100)}%` }}
        />
      </div>
    </div>
  );
}
