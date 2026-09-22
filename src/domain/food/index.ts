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
    config: { meals: 3, calorieLimit: 2000 },
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
    return config.calorieLimit === null
      ? meals
      : `${meals}, under ${config.calorieLimit.toLocaleString("en-US")} calories`;
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

    const left = input.config.meals - meals.length;
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
    const count = countPass(meals, { min: input.config.meals });
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
        required: input.config.meals,
        calories,
        limit,
      },
    };
  },
};
