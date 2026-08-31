import type { ActivityType } from "./types";

// key -> implementation. Adding a type is a register() call and nothing else.
// The engine looks a module up by key and consumes { passed, detail }; it never
// branches on the key.
const modules = new Map<string, ActivityType<unknown, unknown>>();

export function register<C, E>(module: ActivityType<C, E>): void {
  if (modules.has(module.key)) {
    throw new Error(`activity type '${module.key}' is already registered`);
  }
  modules.set(module.key, module as ActivityType<unknown, unknown>);
}

export function getActivityType(key: string): ActivityType<unknown, unknown> {
  const module = modules.get(key);
  if (!module) throw new Error(`no activity type registered for '${key}'`);
  return module;
}

export function registeredKeys(): string[] {
  return [...modules.keys()];
}
