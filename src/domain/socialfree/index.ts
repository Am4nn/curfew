import { abstinenceActivity } from "../abstinence";

// No social media. NOT Screen, and 3.1 says why: Screen is total device time,
// and somebody can be under two hours having spent all of it scrolling. They
// are different conditions and they were kept apart deliberately.
//
// The cutoff is the hour the day's allowance ends, for somebody who allows
// themselves a window rather than none at all.
export const socialfreeActivity = abstinenceActivity({
  key: "socialfree",
  name: "No social media",
  description: "A day off the feeds",
  icon: "socialfree",
  category: "mind",
  measure: "streak",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: { label: "Nothing after", default: "18:00" },
  answers: { yes: "It held", no: "I scrolled" },
  said: { yes: "You said it held.", no: "You said you scrolled." },
  rule: (config) =>
    config.cutoff === null ? "no social media" : "no social media after the time you set",
  prompt: () => "Social media today. Did it hold?",
  chartHeading: "DAYS THAT HELD",
  windowHint: "End of the day you say whether it held.",
  evidenceDetail: "Nothing can prove absence. This one runs on your word.",
  note: "Which apps count is yours to decide, and the app never asks. It only records the answer you give.",
});
