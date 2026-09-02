import { abstinenceActivity } from "../abstinence";

// Nightfast. Nothing after a set time, declared clean the next morning. The
// morning window is deliberate: you cannot honestly declare a night you are
// still in.
export const nightfastActivity = abstinenceActivity({
  key: "nightfast",
  name: "Nightfast",
  description: "Nothing after your cut-off",
  icon: "nightfast",
  label: "Confirm",
  window: { open: "06:00", close: "11:00" },
});
