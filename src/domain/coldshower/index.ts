import { abstinenceActivity } from "../abstinence";

// Cold shower. Not an abstinence: it is a thing you do, sharing the declare
// shape because the record is a yes or a no and nothing can photograph it
// (3.1). Its words are its own, which is what `answers` and `said` are for.
//
// CONFIRMED IN THE MORNING, changed 2026-09-23 by the activities review.
//
// It shipped confirming at 8 PM, on the reasoning that a 6 AM window would
// mean a notification before anybody is up. That was reasoning about the
// PUSH and not about the habit. A cold shower happens at 7 AM, so a press at
// 8 PM records when somebody remembered to log it, and C1 would have read
// that spread as the cue.
//
// The window opens at 7 and runs to 11, which is late enough not to wake
// anybody and close enough to the act for the timestamp to mean something.
export const coldshowerActivity = abstinenceActivity({
  key: "coldshower",
  name: "Cold shower",
  description: "Cold, once a day",
  icon: "coldshower",
  category: "body",
  measure: "consistency",
  label: "Confirm",
  window: { open: "07:00", close: "11:00" },
  cutoff: null,
  // C6. The reminder time is the CUE: it is when you do this, it is when
  // Curfew asks, and it is what C1 measures a press against. Declared here
  // because without one the engine works backwards from the window, which
  // for a wide one is a guess.
  reminderCues: ["07:30"],
  answers: { yes: "I did", no: "I did not" },
  said: { yes: "You said you did.", no: "You said you did not." },
  rule: () => "a cold shower",
  prompt: () => "A cold shower today. Did you take one?",
  chartHeading: "DAYS YOU TOOK ONE",
  windowHint: "Next morning you say whether you took one.",
  evidenceDetail: "Nothing can prove a shower. This one runs on your word.",
  note: "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
});
