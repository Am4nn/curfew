import { abstinenceActivity } from "../abstinence";
import { clockLabel } from "../windows";

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
  cutoff: { label: "Nothing after", default: "20:00" },
  prompt: (config) =>
    `Nothing after ${clockLabel(config.cutoff ?? "20:00")} last night. Did it hold?`,
  windowHint: "Next morning you say whether it held.",
});
