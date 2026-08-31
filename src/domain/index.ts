// Domain core barrel. Importing this registers every v1 activity type.
import { register } from "./registry";
import { sleepActivity } from "./sleep";

register(sleepActivity);

export { periodStart } from "./period";
export { resolveConfig, type EffectiveRow } from "./config";
export { splitFine, type Share } from "./money";
export { getActivityType, registeredKeys, register } from "./registry";
export type {
  ActivityType,
  CheckinStep,
  Checkin,
  EvaluateInput,
  EvaluateResult,
  Period,
} from "./types";
export {
  sleepActivity,
  sleepConfigSchema,
  sleepEvidenceSchema,
  type SleepConfig,
  type SleepEvidence,
} from "./sleep";
