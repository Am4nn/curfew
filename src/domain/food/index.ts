import { z } from "zod";
import type { ActivityType } from "../types";
import { EVERY_DAY } from "../schedule";
import { oneWindow, ALL_DAY } from "../windows";
import { countPass, thresholdPass, sumField } from "../pass";

// Food. One check-in is a MEAL: a photo and its calorie figure, sent together
// (decision 85). Three of them make the day. The count is simply how many
// check-ins exist, so there is no separate counter and the photo and the number
// can never disagree.
//
// The only type in the catalog that needs both pass shapes at once: a count at
// or above three, and calories at or below the limit.

export const FOOD_STEP = "meal";

const foodConfigSchema = z
  .object({
    meals: z.number().int().min(1).max(10),
    /**
     * C9. The number below which the day is a miss.
     *
     * `meals` is what you AIM for. This is the bar. Eating two of three is a
     * normal day and used to score exactly like eating none, because the
     * target was being used as the bar.
     *
     * NULL means the old behaviour, the bar and the aim being the same number,
     * and it is the default in the schema so that every config row written
     * before this existed parses unchanged and is judged exactly as it was
     * (invariants 4 and 5). There is no migration.
     */
    mealsFloor: z.number().int().min(1).max(10).nullish(),
    // Null means the user tracks meals but not calories. The photo is still
    // required; the number simply stops binding anything.
    calorieLimit: z.number().int().min(1).max(20000).nullable(),
  })
  .strict();
export type FoodConfig = z.infer<typeof foodConfigSchema>;

// One MEAL's calories, not a day's. Nought is not a meal and four digits is
// more than any plate, so the range says so rather than accepting a number
// nobody meant and scoring the day on it.
const foodEvidenceSchema = z
  .object({ calories: z.number().int().min(1).max(9999) })
  .strict();
export type FoodEvidence = z.infer<typeof foodEvidenceSchema>;

export const foodActivity: ActivityType<FoodConfig, FoodEvidence> = {
  key: "food",
  name: "Food",
  description: "A photo and the calories, every meal",
  icon: "food",
  category: "food",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    // An hour and a half between meals. Longer than water's, because two meals
    // inside ninety minutes is one meal photographed twice.
    minGap: 90,
    // C9. The aim, and the bar one under it. A new setup forgives exactly
    // one missed meal; somebody who wants the old behaviour sets them equal.
    config: { meals: 3, mealsFloor: 2, calorieLimit: 2000 },
  },

  configSchema: foodConfigSchema,
  evidenceSchema: foodEvidenceSchema,

  // Both the photo and the calorie figure are required (decision 45). A meal
  // photo with no number tells a group nothing they can hold you to.
  evidence: {
    level: "required",
    source: "live",
    detail: "Live camera, and the calories with it.",
    // A plate carries detail the others do not: what is on it, and how much,
    // and often a label to read. Kept above the 1920/0.85 default.
    maxEdge: 2400,
    quality: 0.9,
  },
  checkin: { kind: "camera" },
  chart: {
    kind: "numeric",
    heading: "CALORIES A DAY",
    valueField: "calories",
    targetField: "limit",
  },

  note: "A photo is not proof. It records that you took one in the app, at a server timestamp.",

  summary(config) {
    const meals = `${config.meals} ${config.meals === 1 ? "meal" : "meals"}`;
    // C9. The aim, then the bar, and only when they differ. Saying "3 meals"
    // alone when two is enough describes a rule the app is not applying.
    const floor = config.mealsFloor ?? config.meals;
    const aimed = floor === config.meals ? meals : `${meals}, a miss under ${floor}`;
    return config.calorieLimit === null
      ? aimed
      : `${aimed}, under ${config.calorieLimit.toLocaleString("en-US")} calories`;
  },

  fields() {
    return [
      {
        kind: "number",
        key: "meals",
        label: "Meals a day",
        min: 1,
        max: 10,
        unit: "meals",
      },
      {
        kind: "number",
        key: "mealsFloor",
        label: "Counts as a miss under",
        min: 1,
        max: 10,
        unit: "meals",
        hint: "Eating fewer than your aim is a normal day. This is the bar.",
      },
      {
        kind: "number",
        key: "calorieLimit",
        label: "Calorie limit",
        min: 500,
        max: 20000,
        step: 50,
        unit: "cal",
        display: "input",
        hint: "Both must hold to pass.",
      },
    ];
  },

  steps() {
    return [
      {
        key: FOOD_STEP,
        label: "Meal",
        open: "00:00",
        close: "23:59",
        repeats: true,
        fields: [
          {
            kind: "number",
            key: "calories",
            label: "Calories",
            // Same range as the evidence schema. They move together or the
            // screen accepts what the server refuses.
            min: 1,
            max: 9999,
            step: 10,
            unit: "cal",
          },
        ],
      },
    ];
  },

  hint(input) {
    const meals = input.checkins.filter((c) => c.step === FOOD_STEP);
    const calories = sumField(meals, "calories");
    const limit = input.config.calorieLimit;
    const pending = input.pending?.calories ?? null;

    if (limit === null) {
      return pending === null
        ? `${calories} so far today. No limit set.`
        : `${calories + pending} today once this is sent. No limit set.`;
    }
    // Over the limit, the day is decided and calories only accumulate, so
    // there is no reading of the rest of the day that passes. Saying the two
    // numbers and leaving the comparison to the reader is not this app's
    // register: it states the consequence.
    if (pending === null && calories > limit) {
      return `${calories} today, over the ${limit} limit. Today does not count.`;
    }
    if (pending !== null && calories + pending > limit) {
      return `${calories + pending} once this is sent, over the ${limit} limit. Today would not count.`;
    }
    return pending === null
      ? `${calories} so far today. The limit is ${limit}.`
      : `${calories + pending} of ${limit} once this is sent.`;
  },

  // Null once the limit is blown, and that is not an oversight. Calories only
  // accumulate, so there is no reading of the rest of the day that passes, and
  // a notification asking for two more meals on a day already lost is asking
  // for a press that changes nothing. The check-in screen still says what
  // happened, because somebody who opens it has asked.
  remind(input) {
    const meals = input.checkins.filter((c) => c.step === FOOD_STEP);
    const limit = input.config.calorieLimit;
    const calories = sumField(meals, "calories");
    if (limit !== null && calories > limit) return null;

    // C9. Down to the FLOOR, not the aim. `remind` is read on a lock screen
    // and counts down to what is needed, and after C9 what is needed is the
    // bar. Counting to the aim would ask for a third meal on a day that
    // already passes: every function correct, the sentence false, which is
    // the shape v3.4 cost a release to.
    const left = (input.config.mealsFloor ?? input.config.meals) - meals.length;
    if (left <= 0) return null;
    const ask = `${left} ${left === 1 ? "meal" : "meals"} to go.`;
    // The calorie budget only once some of it has been spent. "3 meals to go.
    // 2000 calories left." on an empty day states the limit twice over, and
    // the second number is the one the eye lands on.
    if (limit === null || calories === 0) return ask;
    return `${ask} ${limit - calories} calories left.`;
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(FOOD_STEP, "Meal", periodStart, timezone, ALL_DAY);
  },

  // Breakfast, lunch, dinner. The window above is the whole day, so the
  // engine's default would remind at 7:30, 8:45 and 9:20 PM, which is three
  // messages about meals somebody has already not eaten.
  //
  // Three meals is also only the default target, and these times are not
  // derived from it: somebody on two meals gets a reminder they can ignore,
  // which is a better failure than nine o'clock.
  reminderCues: ["09:00", "13:30", "20:00"],

  evaluate(input) {
    const meals = input.checkins.filter((c) => c.step === FOOD_STEP);
    // C9. The FLOOR decides the day. The aim is carried in detail, where the
    // habit measure and Ren can read it, and it moves nothing on its own.
    const aim = input.config.meals;
    const floor = input.config.mealsFloor ?? aim;
    const count = countPass(meals, { min: floor });
    const calories = sumField(meals, "calories");

    // Calories only bind when a limit is set. Both tests combine with AND.
    const limit = input.config.calorieLimit;
    const withinLimit =
      limit === null
        ? { passed: true, value: calories }
        : thresholdPass(calories, { direction: "atMost", target: limit });

    return {
      passed: count.passed && withinLimit.passed,
      detail: {
        meals: count.count,
        required: floor,
        aim,
        calories,
        limit,
      },
    };
  },
};
