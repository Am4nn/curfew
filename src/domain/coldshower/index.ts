import { abstinenceActivity } from "../abstinence";

// Cold shower. Not an abstinence: it is a thing you do, sharing the declare
// shape because the record is a yes or a no and nothing can photograph it
// (3.1). Its words are its own, which is what `answers` and `said` are for.
//
// Confirmed in the evening rather than the morning. A cold shower is usually
// the first thing in the day and a window that opens at 6 AM would be a
// notification before anybody is up; the day's other declares all land after
// eight, so this one joins them.
export const coldshowerActivity = abstinenceActivity({
  key: "coldshower",
  name: "Cold shower",
  description: "Cold, once a day",
  icon: "coldshower",
  category: "body",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: null,
  answers: { yes: "I did", no: "I did not" },
  said: { yes: "You said you did.", no: "You said you did not." },
  rule: () => "a cold shower",
  prompt: () => "A cold shower today. Did you take one?",
  chartHeading: "DAYS YOU TOOK ONE",
  windowHint: "End of the day you say whether you took one.",
  evidenceDetail: "Nothing can prove a shower. This one runs on your word.",
  note: "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
});
