// Domain core barrel. Importing this registers every activity type.
import { register } from "./registry";
import { sleepActivity } from "./sleep";
import { gymActivity } from "./gym";
import { foodActivity } from "./food";
import { supplementsActivity } from "./supplements";
import { officeActivity } from "./office";
import { studyActivity } from "./study";
import { stepsActivity } from "./steps";
import { waterActivity } from "./water";
import { readingActivity } from "./reading";
import { screenActivity } from "./screen";
import { nightfastActivity } from "./nightfast";
import { sugarfreeActivity } from "./sugarfree";

// The twelve. Order here is only the order they were written; the catalog
// sorts them itself.
register(sleepActivity);
register(gymActivity);
register(foodActivity);
register(supplementsActivity);
register(officeActivity);
register(studyActivity);
register(stepsActivity);
register(waterActivity);
register(readingActivity);
register(screenActivity);
register(nightfastActivity);
register(sugarfreeActivity);

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
export {
  resolveConfig,
  resolveAt,
  resolveMoney,
  type EffectiveRow,
  type EffectiveAtRow,
} from "./config";
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
export {
  windowSchema,
  windowInstants,
  oneWindow,
  within,
  ALL_DAY,
  HHMM,
  type Window,
} from "./windows";
export {
  abstinenceActivity,
  abstinenceConfigSchema,
  abstinenceEvidenceSchema,
  DECLARE_STEP,
  type AbstinenceConfig,
  type AbstinenceEvidence,
} from "./abstinence";
export { foodActivity, foodConfigSchema, FOOD_STEP, type FoodConfig } from "./food";
export {
  supplementsActivity,
  supplementsConfigSchema,
  SUPPLEMENTS_STEP,
  type SupplementsConfig,
} from "./supplements";
export { officeActivity, officeConfigSchema, OFFICE_STEP, type OfficeConfig } from "./office";
export { studyActivity, studyConfigSchema, STUDY_STEP, type StudyConfig } from "./study";
export { stepsActivity, stepsConfigSchema, STEPS_STEP, type StepsConfig } from "./steps";
export { waterActivity, waterConfigSchema, WATER_STEP, type WaterConfig } from "./water";
export {
  readingActivity,
  readingConfigSchema,
  READING_STEP,
  type ReadingConfig,
  type ReadingUnit,
} from "./reading";
export { screenActivity, screenConfigSchema, SCREEN_STEP, type ScreenConfig } from "./screen";
export { nightfastActivity } from "./nightfast";
export { sugarfreeActivity } from "./sugarfree";
