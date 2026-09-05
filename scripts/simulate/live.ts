// Fast-forward: a year lived a day at a time, through the app's own write path.
//
// The scenarios beside this one insert events and then score them, which is
// fast and proves the ENGINE. This proves the whole thing. Nothing here writes
// an event: a persona presses the button, `performCheckin` validates the
// window, the schedule, the step, the evidence rule and the idempotency key,
// records the event and bumps the streak, and then the cron runs. The clock is
// pinned to the simulated instant throughout, so every window check and every
// period boundary is resolved against the day being lived rather than today.
//
// It is slower than the scenarios by a lot, which is why it is a separate pass:
// what it buys is that a defect in check-in itself cannot hide behind a seeded
// event.
import { DateTime } from "luxon";
import { EVERY_DAY } from "@/domain";
import { setClock } from "@/lib/clock";
import { performCheckin } from "@/server/checkin";
import { scoreAll } from "@/server/scoring";
import {
  wipe,
  person,
  defaultTimezone,
  track,
  streakOf,
  finalScore,
  scoresOf,
  TZ,
  type ScheduleShape,
} from "./world";
import { rankFor } from "@/domain";

const DAILY: ScheduleShape = { schedule: EVERY_DAY, dayBoundary: "midnight", grace: 2 };
const STEPS_CONFIG = { target: 8000, direction: "atLeast" as const };
const WATER_CONFIG = { glasses: 8 };

/**
 * How a person behaves on a given day of the simulation.
 *
 * Returns how much of the day's target they do, 0 to 1. The runner turns that
 * into the right number of presses for the activity: one for a threshold type,
 * a share of the glasses for a counter.
 */
export interface Persona {
  id: string;
  name: string;
  description: string;
  effort(dayIndex: number, date: DateTime): number;
}

export const PERSONAS: Persona[] = [
  {
    id: "flawless",
    name: "Flawless",
    description: "Never misses, not once, for the whole year.",
    effort: () => 1,
  },
  {
    id: "weekday",
    name: "Weekday only",
    description: "Perfect Monday to Friday, nothing at the weekend.",
    effort: (_i, date) => (date.weekday <= 5 ? 1 : 0),
  },
  {
    id: "monthly-slip",
    name: "One slip a month",
    description: "Misses a single day every thirty.",
    effort: (i) => (i % 30 === 29 ? 0 : 1),
  },
  {
    id: "weekly-slip",
    name: "One slip a week",
    description: "Misses a single day every seven.",
    effort: (i) => (i % 7 === 6 ? 0 : 1),
  },
  {
    id: "fader",
    name: "The fader",
    description: "Perfect for two months, then two thirds of the time, then rarely.",
    effort: (i) => (i < 60 ? 1 : i < 150 ? (i % 3 === 0 ? 0 : 1) : i % 4 === 0 ? 1 : 0),
  },
  {
    id: "comeback",
    name: "The comeback",
    description: "Barely shows up for three months, then never misses again.",
    effort: (i) => (i < 90 ? (i % 4 === 0 ? 1 : 0) : 1),
  },
  {
    id: "binger",
    name: "The binger",
    description: "Five days on, three days off, all year.",
    effort: (i) => (i % 8 < 5 ? 1 : 0),
  },
  {
    id: "nearly",
    name: "Nearly",
    description: "Turns up every single day and stops just short of the target.",
    // Effort is a fraction OF THE TARGET, so this is 7000 steps against 8000,
    // or seven glasses of eight. Every day, and none of them count.
    effort: () => 0.875,
  },
];

export interface LiveResult {
  persona: string;
  description: string;
  typeKey: string;
  presses: number;
  refused: number;
  daysScored: number;
  daysPassed: number;
  streak: number;
  best: number;
  score: number;
  rank: string;
  curve: { day: string; value: number }[];
}

/**
 * Live the given number of days. Each day: everyone presses what their persona
 * says, at the hour given, through `performCheckin`. Then the clock moves to
 * 04:00 the next morning and the cron runs, exactly as Vercel schedules it.
 */
export async function runLive(
  days: number,
  typeKey: "steps" | "water",
  onDay?: (index: number) => void,
): Promise<LiveResult[]> {
  const config = typeKey === "steps" ? STEPS_CONFIG : WATER_CONFIG;
  const start = DateTime.now().setZone(TZ).startOf("day").minus({ days });

  await wipe();
  await defaultTimezone();
  for (const p of PERSONAS) {
    await person(`live-${p.id}`, p.name);
    await track(`live-${p.id}`, typeKey, DAILY, config, start.toFormat("yyyy-MM-dd"));
  }

  const presses = new Map<string, number>();
  const refused = new Map<string, number>();

  for (let i = 0; i < days; i += 1) {
    const date = start.plus({ days: i });
    onDay?.(i);

    for (const p of PERSONAS) {
      const userId = `live-${p.id}`;
      const effort = p.effort(i, date);
      // A threshold type is one press carrying a number; a counter is a press
      // per glass. Either way it is the real endpoint doing the deciding.
      const pressCount =
        typeKey === "steps" ? (effort > 0 ? 1 : 0) : Math.round(effort * WATER_CONFIG.glasses);

      for (let n = 0; n < pressCount; n += 1) {
        setClock(date.set({ hour: 9 + n, minute: 15 }).toJSDate());
        const result = await performCheckin(userId, null, {
          typeKey,
          step: typeKey === "steps" ? "count" : "glass",
          idem: `live-${p.id}-${i}-${n}`,
          ...(typeKey === "steps"
            ? { evidence: { steps: Math.round(effort * STEPS_CONFIG.target) } }
            : { evidence: {} }),
        });
        if (result.ok) presses.set(userId, (presses.get(userId) ?? 0) + 1);
        else refused.set(userId, (refused.get(userId) ?? 0) + 1);
      }
    }

    // Four in the morning, the next day. The cron, on the schedule vercel.json
    // actually carries.
    setClock(date.plus({ days: 1 }).set({ hour: 4 }).toJSDate());
    await scoreAll();
  }

  const out: LiveResult[] = [];
  for (const p of PERSONAS) {
    const userId = `live-${p.id}`;
    const streak = await streakOf(userId, typeKey);
    const scored = await scoresOf(userId, typeKey);
    const score = await finalScore(userId, null);
    const { curveOf } = await import("./world");
    const curve = await curveOf(userId, null);
    out.push({
      persona: p.name,
      description: p.description,
      typeKey,
      presses: presses.get(userId) ?? 0,
      refused: refused.get(userId) ?? 0,
      daysScored: scored.length,
      daysPassed: scored.filter((s) => s.passed).length,
      streak: streak?.streak ?? 0,
      best: streak?.best ?? 0,
      score: Math.round(score),
      rank: rankFor(score).name,
      curve: curve.map((c) => ({ day: c.day, value: c.score })),
    });
  }

  setClock(null);
  return out;
}
