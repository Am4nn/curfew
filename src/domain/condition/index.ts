import { z } from "zod";
import { abstinenceActivity, type AbstinenceEvidence } from "../abstinence";
import { windowSchema, HHMM } from "../windows";
import type { ActivityType } from "../types";

/**
 * How long a label may be. The Home row draws it at 16px beside the streak
 * pill, which is the same budget `registry.test.ts` holds the seventeen names
 * to. Twenty is what fits on the narrowest phone.
 */
export const LABEL_MAX = 20;

const conditionConfigSchema = z
  .object({
    /**
     * The name this person gave it.
     *
     * It is written into the config blob when the condition is created AND it
     * is merged in from `user_conditions` on every read, which looks like two
     * sources for one fact and is not: the merge always wins, so the copy in
     * the blob can never be read stale. `user_conditions` is the source of
     * truth, and what the blob's copy buys is that a raw config row parses on
     * its own, without a join, anywhere that has one in hand.
     *
     * Required rather than defaulted, because a Zod default makes the schema's
     * input type differ from its output type and `ActivityType` declares one
     * type for both. A config with no label is a bug, not a blank to fill in.
     */
    label: z.string().min(1).max(LABEL_MAX),
    window: windowSchema,
    cutoff: HHMM.nullable(),
  })
  .strict();

export type ConditionConfig = z.infer<typeof conditionConfigSchema>;

// The shared held-or-slipped module behind every condition somebody writes
// themselves (1.19).
//
// ONE module, MANY keys: a condition is tracked as `condition:<uuid>`, and
// `getActivityType` resolves that prefix back to this. The alternative was a
// fixed set of slots, which caps how many you can have and puts an empty
// `condition4` in the catalog meaning nothing.
//
// It is registered like any other type, so `sync:activities` gives it a row in
// `activity_types` and an admin can switch the whole feature off in one place.
// The CATALOG leaves it out, because it is a template rather than something to
// track: what the catalog draws instead is "Write your own".
//
// It declares NO CATEGORY, which is the rule and not an omission (1.19).
const base = abstinenceActivity({
  key: "condition",
  name: "Your own",
  description: "A condition you write yourself",
  icon: "condition",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: null,
  rule: () => "the condition you set",
  prompt: () => "Did it hold today?",
  chartHeading: "DAYS THAT HELD",
  windowHint: "End of the day you say whether it held.",
  evidenceDetail: "Nothing can prove absence. This one runs on your word.",
  note: "You wrote this one, so only you know what it means. The app records the answer you give and never asks what it was.",
});

export const conditionActivity: ActivityType<ConditionConfig, AbstinenceEvidence> = {
  ...base,
  configSchema: conditionConfigSchema,
  // The label here is a placeholder and is never drawn: creating a condition
  // supplies a real one, and every read merges the row's own over the top.
  // What these defaults are FOR is the configure screen's starting values,
  // which for this module is the confirm window and nothing else.
  defaults: {
    ...base.defaults,
    config: conditionConfigSchema.parse({ ...base.defaults.config, label: "Your condition" }),
  },

  // The one thing this module has that no other does. Every screen that draws
  // a type's name asks here first, and the engine never reads what comes back.
  displayName: (config) => config.label,

  // The prompt says the label rather than "the condition you set", because a
  // check-in screen that does not name what it is asking about is the digest
  // problem in miniature.
  steps(config, periodStart) {
    return base.steps(config, periodStart).map((step) => ({
      ...step,
      prompt: `${config.label} today. Did it hold?`,
    }));
  },

  summary(config) {
    return base.summary(config);
  },
};

/** `condition:<uuid>` is one of these; `condition` is the module itself. */
export const CONDITION_PREFIX = "condition:";

export function isConditionKey(key: string): boolean {
  return key.startsWith(CONDITION_PREFIX);
}

export function conditionIdOf(key: string): string | null {
  return isConditionKey(key) ? key.slice(CONDITION_PREFIX.length) : null;
}
