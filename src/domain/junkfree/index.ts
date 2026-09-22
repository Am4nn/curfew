import { abstinenceActivity } from "../abstinence";

// No junk food. An abstinence in the Sugar-free shape, and deliberately not
// folded into it: somebody can cut sugar and still eat fried food all week,
// and two conditions that fail independently are two types (1.19).
export const junkfreeActivity = abstinenceActivity({
  key: "junkfree",
  name: "No junk food",
  description: "A day without it",
  icon: "junkfree",
  category: "food",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: null,
  rule: () => "no junk food",
  prompt: () => "No junk food today. Did it hold?",
  chartHeading: "DAYS THAT HELD",
  windowHint: "End of the day you say whether it held.",
  evidenceDetail: "Nothing can prove absence. This one runs on your word.",
  note: "What counts as junk is yours to decide, and the app never asks. It only records the answer you give.",
});
