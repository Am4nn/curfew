import { abstinenceActivity } from "../abstinence";

// Morning sunlight. Like Cold shower, a thing you do in the declare shape.
//
// The cutoff is the hour it stops counting as morning, and it is the one
// control on this type that is worth setting: what counts as morning is
// nine o'clock to one person and eleven to another, and the app has no
// business deciding.
//
// CONFIRMED IN THE MORNING since 2026-09-23. It shipped confirming at 8 PM,
// which recorded when somebody remembered rather than when they went out.
// The confirm now opens at the cutoff and runs two hours past it, so the
// press lands close to the act and C1 can read it.
export const sunlightActivity = abstinenceActivity({
  key: "sunlight",
  name: "Morning sunlight",
  description: "Outside, early",
  icon: "sunlight",
  category: "body",
  label: "Confirm",
  window: { open: "10:00", close: "12:00" },
  cutoff: { label: "Counts as morning until", default: "10:00" },
  // C6. The reminder time is the CUE: it is when you do this, it is when
  // Curfew asks, and it is what C1 measures a press against. Declared here
  // because without one the engine works backwards from the window, which
  // for a wide one is a guess.
  reminderCues: ["08:00"],
  answers: { yes: "I got out", no: "I did not" },
  said: { yes: "You said you got out.", no: "You said you did not." },
  rule: (config) =>
    config.cutoff === null ? "sunlight in the morning" : "sunlight before the hour you set",
  prompt: () => "Sunlight this morning. Did you get out in it?",
  chartHeading: "MORNINGS YOU GOT OUT",
  windowHint: "After the morning is over you say whether you got out.",
  evidenceDetail: "A photograph cannot say when you were outside. This one runs on your word.",
  note: "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
});
