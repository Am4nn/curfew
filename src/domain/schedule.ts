import { z } from "zod";

// The schedule is engine-owned (decision 79). One shape for every activity type,
// so the day picker is drawn once and the engine can decide which days produce
// periods without asking a module anything.

// Luxon's numbering: 1 is Monday, 7 is Sunday. A week runs Monday to Sunday in
// the user's timezone and is judged at week end.
export const weekdaySchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
  z.literal(5), z.literal(6), z.literal(7),
]);
export type Weekday = z.infer<typeof weekdaySchema>;

// One control, two modes (decision 55). A day row with an ANY cell: pick days,
// or turn ANY on and it becomes a minimum a week. There is deliberately no way
// to express both, because "Mondays, at least 3 a week" is not a rule anyone
// means.
export const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("days"),
    days: z.array(weekdaySchema).min(1).max(7),
  }),
  z.object({
    kind: z.literal("minimum"),
    perWeek: z.number().int().min(1).max(7),
  }),
]);
export type Schedule = z.infer<typeof scheduleSchema>;

// When a day starts for this activity. Sleep needs noon to noon so a 00:30
// check-in attaches to the night that just ended; everything else wants
// midnight.
export const dayBoundarySchema = z.enum(["midnight", "noon"]);
export type DayBoundary = z.infer<typeof dayBoundarySchema>;

export type PeriodUnit = "day" | "week";

// Everything the engine needs to know about any activity, whatever its type.
export const scheduleConfigSchema = z.object({
  schedule: scheduleSchema,
  dayBoundary: dayBoundarySchema,
  // Missed periods forgiven per calendar month. Protects the streak only: the
  // fine still applies and reputation still dips (decision 5).
  grace: z.number().int().min(0).max(31),
});
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

// The period unit is DERIVED, never stored (decision 79). Named days are judged
// by the day; a minimum a week is judged at week end. Storing both would allow a
// row that says weekly and Mondays at once.
export function periodUnit(schedule: Schedule): PeriodUnit {
  return schedule.kind === "minimum" ? "week" : "day";
}

// Does this weekday count for this activity? A minimum-a-week schedule has no
// unscheduled days: any day can be a session day, and the week is what is
// judged.
export function isScheduledDay(schedule: Schedule, weekday: Weekday): boolean {
  return schedule.kind === "minimum" || schedule.days.includes(weekday);
}

export const EVERY_DAY: Schedule = { kind: "days", days: [1, 2, 3, 4, 5, 6, 7] };
export const WEEKDAYS: Schedule = { kind: "days", days: [1, 2, 3, 4, 5] };
