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

/**
 * One module, many keys (1.19).
 *
 * A condition somebody writes themselves is tracked as `condition:<uuid>`, and
 * every one of them is the same module. The prefix is stripped here so that
 * the other hundred-odd callers of this function never learn there is such a
 * thing: they ask for a key and get a module, as they always have.
 *
 * The id is NOT validated here. The domain has no database, so it cannot know
 * whether a condition exists; a key for one that was deleted resolves to the
 * module and finds no config, which is the same thing that happens to a type
 * somebody has stopped tracking.
 */
function resolve(key: string): string {
  const cut = key.indexOf(":");
  return cut === -1 ? key : key.slice(0, cut);
}

export function getActivityType(key: string): ActivityType<unknown, unknown> {
  const activity = modules.get(resolve(key));
  if (!activity) throw new Error(`no activity type registered for '${key}'`);
  return activity;
}

/**
 * What to call this activity on screen.
 *
 * `type.name` for the seventeen, and the module's own answer for a condition
 * somebody wrote. Everything that draws a name goes through here, so a module
 * that starts answering for itself does not need those sites changed again.
 */
export function displayNameOf(
  activity: ActivityType<unknown, unknown>,
  config: unknown,
): string {
  if (!activity.displayName) return activity.name;
  try {
    return activity.displayName(config);
  } catch {
    // A config that will not parse is not a reason for a page to 500. The
    // module's own name is always a true thing to say.
    return activity.name;
  }
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
