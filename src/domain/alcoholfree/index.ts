import { abstinenceActivity } from "../abstinence";

// No alcohol. The plainest of the five: the condition needs no definition and
// the answer needs no qualification.
export const alcoholfreeActivity = abstinenceActivity({
  key: "alcoholfree",
  name: "No alcohol",
  description: "A day without a drink",
  icon: "alcoholfree",
  category: "food",
  measure: "streak",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: null,
  rule: () => "no alcohol",
  prompt: () => "No alcohol today. Did it hold?",
  chartHeading: "DAYS THAT HELD",
  windowHint: "End of the day you say whether it held.",
  note: "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
});
