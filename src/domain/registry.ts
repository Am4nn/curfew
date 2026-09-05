import type { ActivityType, EvaluateInput } from "./types";

// key -> implementation. Adding a type is a register() call and nothing else.
// The engine looks a module up by key and consumes { passed, detail }; it never
// branches on the key.
const modules = new Map<string, ActivityType<unknown, unknown>>();

export function register<C, E>(activity: ActivityType<C, E>): void {
  if (modules.has(activity.key)) {
    throw new Error(`activity type '${activity.key}' is already registered`);
  }
  modules.set(activity.key, activity);
}

export function getActivityType(key: string): ActivityType<unknown, unknown> {
  const activity = modules.get(key);
  if (!activity) throw new Error(`no activity type registered for '${key}'`);
  return activity;
}

export function registeredKeys(): string[] {
  return [...modules.keys()];
}

/**
 * Which calendar days of this period count toward a streak.
 *
 * The module answers when it has something to say, and for eleven of the twelve
 * it has nothing: a period is a day, so the day counts when the period passed.
 * Gym's period is a week and its streak counts sessions, so it declares its own
 * (decision 77).
 *
 * One place, so the default lives beside the question rather than at each of
 * the four callers. The engine still never inspects a module's detail or
 * branches on its key (invariant 6): it asks, and takes the answer.
 */
export function daysDoneIn(
  key: string,
  input: EvaluateInput<unknown, unknown>,
): string[] {
  const activity = getActivityType(key);
  if (activity.daysDone) return [...activity.daysDone(input)].sort();
  return activity.evaluate(input).passed ? [input.periodStart] : [];
}
