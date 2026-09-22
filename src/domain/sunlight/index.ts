import { abstinenceActivity } from "../abstinence";

// Morning sunlight. Like Cold shower, a thing you do in the declare shape.
//
// The cutoff is the hour it stops counting as morning, and it is the one
// control on this type that is worth setting: what counts as morning is
// nine o'clock to one person and eleven to another, and the app has no
// business deciding.
export const sunlightActivity = abstinenceActivity({
  key: "sunlight",
  name: "Morning sunlight",
  description: "Outside, early",
  icon: "sunlight",
  category: "body",
  label: "Confirm",
  window: { open: "20:00", close: "23:59" },
  cutoff: { label: "Counts as morning until", default: "10:00" },
  answers: { yes: "I got out", no: "I did not" },
  said: { yes: "You said you got out.", no: "You said you did not." },
  rule: (config) =>
    config.cutoff === null ? "sunlight in the morning" : "sunlight before the hour you set",
  prompt: () => "Sunlight this morning. Did you get out in it?",
  chartHeading: "MORNINGS YOU GOT OUT",
  windowHint: "End of the day you say whether you got out.",
  evidenceDetail: "A photograph cannot say when you were outside. This one runs on your word.",
  note: "You still check in once a day. Saying nothing is not a pass, or the app would reward never opening it.",
});
