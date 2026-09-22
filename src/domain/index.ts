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
import { coldshowerActivity } from "./coldshower";
import { sunlightActivity } from "./sunlight";
import { junkfreeActivity } from "./junkfree";
import { alcoholfreeActivity } from "./alcoholfree";
import { socialfreeActivity } from "./socialfree";

// Seventeen since v4 (3.1). Order here is only the order they were written;
// the catalog sorts them itself.
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

// The five v4 adds, all of them declare types drawn under one Home row
// (1.19). Adding them edits this file and nothing in the engine.
register(coldshowerActivity);
register(sunlightActivity);
register(junkfreeActivity);
register(alcoholfreeActivity);
register(socialfreeActivity);

export { periodStart, daysInPeriod, weekdayOf, graceMonth } from "./period";
export {
  periodUnit,
  isScheduledDay,
  scheduleConfigSchema,
  EVERY_DAY,
  WEEKDAYS,
  type Schedule,
  type ScheduleConfig,
  type DayBoundary,
  type PeriodUnit,
} from "./schedule";
export {
  streakOver,
  restoreOffer,
  coveredDays,
  EMPTY as EMPTY_STREAK,
  type StreakDay,
  type StreakState,
  type RestoreOffer,
  STREAK_LOGIC_VERSION,
} from "./streak";
export { graceBalance, offerOpen, resetsOn, type GraceBalance } from "./grace";
export { resolveConfig, resolveAt, resolveMoney } from "./config";
export { splitFine, formatMoney, minorUnitExponent } from "./money";
export { fineFor } from "./scoring";
export {
  applyDay,
  ceilingFor,
  joiningScore,
  CONSTANTS,
  START_SCORE,
  LOGIC_VERSION,
  MAX_SCORE,
  type DayReason,
} from "./reputation";
export {
  RANKS,
  IMMACULATE_CLEAN_DAYS,
  rankFor,
  isImmaculate,
  daysToImmaculate,
  nextRank,
  type RankKey,
} from "./ranks";
export { getActivityType, registeredKeys, daysDoneIn } from "./registry";
export { ruleFor, howOften, dayStarts } from "./rule";
export { consequencesOf, STOP_FOOTNOTE, type StopCost, type Consequence } from "./stop-cost";
export type {
  Category,
  DeclareAnswers,
  CheckinStep,
  CheckinWindow,
  Checkin,
  EvidenceRule,
  ConfigField,
  FieldIssue,
  CheckinKind,
  ChartSpec,
} from "./types";
export { DEFAULT_ANSWERS } from "./types";
export { sleepConfigSchema } from "./sleep";
export { WATER_STEP } from "./water";
