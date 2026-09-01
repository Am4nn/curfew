// Pure streak arithmetic, no DB. A streak is a run of consecutive passes over a
// person's nights, ordered oldest to newest. `current` is the trailing run (0
// when the latest scored night was a miss); `best` is the longest run ever.

export interface Streak {
  current: number;
  best: number;
}

export function runsFrom(passed: boolean[]): Streak {
  let best = 0;
  let run = 0;
  for (const p of passed) {
    run = p ? run + 1 : 0;
    if (run > best) best = run;
  }
  let current = 0;
  for (let i = passed.length - 1; i >= 0 && passed[i]; i--) current += 1;
  return { current, best };
}
