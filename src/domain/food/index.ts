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

export const foodConfigSchema = z
  .object({
    meals: z.number().int().min(1).max(10),
    // Null means the user tracks meals but not calories. The photo is still
    // required; the number simply stops binding anything.
    calorieLimit: z.number().int().min(1).max(20000).nullable(),
  })
  .strict();
export type FoodConfig = z.infer<typeof foodConfigSchema>;

export const foodEvidenceSchema = z
  .object({ calories: z.number().int().min(0).max(20000) })
  .strict();
export type FoodEvidence = z.infer<typeof foodEvidenceSchema>;

export const foodActivity: ActivityType<FoodConfig, FoodEvidence> = {
  key: "food",
  name: "Food",
  description: "A photo and the calories, every meal",
  icon: "food",

  defaults: {
    schedule: EVERY_DAY,
    dayBoundary: "midnight",
    grace: 2,
    config: { meals: 3, calorieLimit: 2000 },
  },

  configSchema: foodConfigSchema,
  evidenceSchema: foodEvidenceSchema,

  // Both the photo and the calorie figure are required (decision 45). A meal
  // photo with no number tells a group nothing they can hold you to.
  evidence: { level: "required", source: "live" },
  checkin: { kind: "camera" },
  chart: "numeric",
  fields: [
    { kind: "number", key: "meals", label: "Meals a day", min: 1, max: 10 },
    {
      kind: "number",
      key: "calorieLimit",
      label: "Calorie limit",
      min: 500,
      max: 20000,
      step: 50,
      unit: "kcal",
      nullable: true,
      offLabel: "Not tracked",
    },
  ],

  steps() {
    return [{ key: FOOD_STEP, label: "Meal", open: "00:00", close: "23:59" }];
  },

  windows(_config, periodStart, timezone) {
    return oneWindow(FOOD_STEP, "Meal", periodStart, timezone, ALL_DAY);
  },

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
