import { abstinenceActivity } from "../abstinence";

// Sugar-free. Declared in the evening, once the day is effectively done. The
// only type whose name carries a hyphen, which is why the key does not.
export const sugarfreeActivity = abstinenceActivity({
  key: "sugarfree",
  name: "Sugar-free",
  description: "A day without sugar",
  icon: "sugarfree",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: null,
  prompt: () => "No sugar today. Did it hold?",
  windowHint: "End of the day you say whether it held.",
  evidenceDetail: "Nothing can prove absence. This one runs on your word.",
  note: "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
});
