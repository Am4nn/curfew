// Domain core barrel. Importing this registers every activity type.
import { register } from "./registry";
import { sleepActivity } from "./sleep";
import { gymActivity } from "./gym";

register(sleepActivity);
register(gymActivity);

export {
  periodStart,
  daysInPeriod,
  weekdayOf,
  graceMonth,
  type PeriodSpec,
} from "./period";
export {
  periodUnit,
  isScheduledDay,
  scheduleSchema,
  scheduleConfigSchema,
  EVERY_DAY,
  WEEKDAYS,
  type Schedule,
  type ScheduleConfig,
  type DayBoundary,
  type PeriodUnit,
  type Weekday,
} from "./schedule";
export {
  streakOver,
  graceLeft,
  EMPTY as EMPTY_STREAK,
  type StreakDay,
  type StreakState,
  type StreakResult,
} from "./streak";
export {
  countPass,
  thresholdPass,
  sumField,
  latestField,
  type Direction,
  type CountRule,
  type ThresholdRule,
} from "./pass";
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
  EvidenceRule,
  CheckinKind,
  ChartKind,
  ScheduleDefaults,
} from "./types";
export {
  sleepActivity,
  sleepConfigSchema,
  sleepEvidenceSchema,
  validateSleepWindows,
  type SleepConfig,
  type SleepEvidence,
} from "./sleep";
export {
  gymActivity,
  gymConfigSchema,
  gymEvidenceSchema,
  GYM_STEP,
  type GymConfig,
  type GymEvidence,
} from "./gym";
