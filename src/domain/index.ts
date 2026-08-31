// Domain core barrel. Importing this registers every v1 activity type.
import { register } from "./registry";
import { sleepActivity } from "./sleep";

register(sleepActivity);

export { periodStart } from "./period";
export { resolveConfig, type EffectiveRow } from "./config";
export { splitFine, formatMoney, minorUnitExponent, type Share } from "./money";
export {
  fineFor,
  scoreChain,
  type FineRules,
  type ChainPeriod,
  type ChainOutcome,
} from "./scoring";
export { getActivityType, registeredKeys, register } from "./registry";
export type {
  ActivityType,
  CheckinStep,
  CheckinWindow,
  Checkin,
  EvaluateInput,
  EvaluateResult,
  Period,
} from "./types";
export {
  sleepActivity,
  sleepConfigSchema,
  sleepEvidenceSchema,
  validateSleepWindows,
  type SleepConfig,
  type SleepEvidence,
} from "./sleep";
