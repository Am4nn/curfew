import type { Schedule, DayBoundary, ScheduleConfig } from "./schedule";
import { getActivityType } from "./registry";

/**
 * The rule for one activity, written out as a person would say it.
 *
 * The configure screen used to ask six questions and never once say what the
 * answers added up to. You could set a schedule, a day boundary, grace, and
 * three windows, and nothing on the screen told you what you had just decided.
 * This says it, so the screen can state the rule before it offers to change
 * any of it.
 *
 * Two halves, and the split matters. The module writes its own clause, because
 * "3 meals a day, under 2,000 calories" is a sentence only Food can write
 * (invariant 6). Everything here is the ENGINE'S half: how often, when the day
 * starts, how many misses are forgiven. Those read the same for all twelve
 * types, so they are written once, here, rather than twelve times over with
 * twelve chances to word them differently.
 */

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Monday, Wednesday and Friday". Oxford comma deliberately absent. */
export function listOfDays(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d] ?? "");
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * How often, in words.
 *
 * "every day", "any 3 days a week", "weekdays", "Monday, Wednesday and
 * Friday". The named shorthands are worth having: "Monday, Tuesday,
 * Wednesday, Thursday and Friday" is the same fact and nobody reads it.
 */
export function howOften(schedule: Schedule): string {
  if (schedule.kind === "minimum") {
    return schedule.perWeek === 1 ? "any 1 day a week" : `any ${schedule.perWeek} days a week`;
  }
  const days = [...schedule.days].sort((a, b) => a - b);
  const key = days.join(",");
  if (key === "1,2,3,4,5,6,7") return "every day";
  if (key === "1,2,3,4,5") return "every weekday";
  if (key === "6,7") return "weekends";
  if (days.length === 1) return `every ${DAY_NAMES[days[0]]}`;
  return listOfDays(days);
}

/**
 * When the day starts, when that is worth saying.
 *
 * Only Sleep runs noon to noon, and it has to: a 12:30 AM check-in belongs to
 * the night that just ended, not the one about to start. Midnight is what
 * everybody already assumes, so saying it is noise.
 */
export function dayStarts(boundary: DayBoundary): string | null {
  return boundary === "noon" ? "A day runs noon to noon, so a night after midnight counts for the night before." : null;
}

/** Misses forgiven a month, when there are any. */
export function forgiven(grace: number): string | null {
  if (grace <= 0) return null;
  return grace === 1
    ? "One miss a month is forgiven and does not break the streak."
    : `${grace} misses a month are forgiven and do not break the streak.`;
}

export interface RuleText {
  /** The one-line rule. "Every day: 8 glasses of water a day." */
  headline: string;
  /** The engine's own footnotes, each a whole sentence. May be empty. */
  notes: string[];
}

/**
 * The whole rule for one activity: the module's clause, the schedule, and the
 * engine's footnotes.
 */
export function ruleFor(typeKey: string, schedule: ScheduleConfig, config: unknown): RuleText {
  const type = getActivityType(typeKey);
  const clause = type.summary(config);
  const often = howOften(schedule.schedule);

  // Capitalised here rather than by the module, so no module has to remember.
  const headline = `${often.charAt(0).toUpperCase()}${often.slice(1)}: ${clause}.`;

  const notes: string[] = [];
  const boundary = dayStarts(schedule.dayBoundary);
  if (boundary) notes.push(boundary);
  const grace = forgiven(schedule.grace);
  if (grace) notes.push(grace);
  if (schedule.minGap > 0) {
    notes.push(
      schedule.minGap === 1
        ? "A minute has to pass between one press and the next."
        : `${schedule.minGap} minutes have to pass between one press and the next.`,
    );
  }
  return { headline, notes };
}
