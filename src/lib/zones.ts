// Every IANA zone the runtime knows, for the pickers.
//
// `Intl.supportedValuesOf` is not in the TypeScript lib for the target we build
// against and is absent on older runtimes, so it is read defensively. The short
// fallback is a list nobody should ever see; it exists so a missing API degrades
// to a working field rather than an empty one.
export function supportedZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  return intl.supportedValuesOf
    ? intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];
}

/**
 * The same list, with `current` guaranteed to be in it.
 *
 * Runtimes do not agree on what a zone is called. Node builds this list as
 * `Asia/Calcutta` and `Europe/Kiev`; browsers report `Asia/Kolkata` and
 * `Europe/Kyiv` for the same two places, and canonicalising through Intl does
 * not reconcile them, because each runtime canonicalises toward its own
 * spelling. The list is built on the server and the value often comes from a
 * browser, so without this the picker has no row for the zone it is displaying:
 * `Asia/Kolkata` is the app's own default and searching for it returns nothing.
 */
export function zonesIncluding(zones: string[], current: string): string[] {
  return !current || zones.includes(current) ? zones : [current, ...zones];
}

/**
 * Do these two zones read the same clock right now?
 *
 * Zone names are not unique: `Asia/Calcutta` and `Asia/Kolkata` are the same
 * place, and browsers disagree about which one to report. Comparing the strings
 * would tell somebody their device is in the wrong country because it spelled it
 * differently. Comparing the wall clock they produce answers the only question
 * that matters, which is whether the two put a deadline at the same moment.
 *
 * Says true when it cannot tell, so a runtime without the API says nothing
 * rather than nagging.
 */
export function sameClock(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const at = new Date();
    const read = (zone: string) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(at);
    return read(a) === read(b);
  } catch {
    return true;
  }
}

/** What this device says its zone is, or null if it will not say. */
export function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
