import { describe, expect, it } from "vitest";
import { sameClock, supportedZones, zonesIncluding } from "./zones";

// The mismatch bar on Home is driven entirely by sameClock, and the way it goes
// wrong is by being too eager: an alias or a spelling reported as somebody
// having moved country. These are the pairs that would do it.
describe("sameClock", () => {
  it("is true for the same name", () => {
    expect(sameClock("Asia/Kolkata", "Asia/Kolkata")).toBe(true);
  });

  it("is true for an alias of the same place", () => {
    // Browsers disagree about which of these to report. They are one zone.
    expect(sameClock("Asia/Calcutta", "Asia/Kolkata")).toBe(true);
    expect(sameClock("Europe/Kiev", "Europe/Kyiv")).toBe(true);
  });

  it("is true for two zones that read the same clock right now", () => {
    // Different names, same wall clock, so no deadline moves. Nothing to say.
    expect(sameClock("Etc/UTC", "UTC")).toBe(true);
  });

  it("is false when the day boundary is somewhere else", () => {
    expect(sameClock("Asia/Kolkata", "Europe/London")).toBe(false);
    expect(sameClock("America/New_York", "Asia/Tokyo")).toBe(false);
  });

  it("says nothing rather than nagging when a zone is not recognised", () => {
    // Intl throws on junk. The bar must stay quiet, not accuse.
    expect(sameClock("Not/AZone", "Asia/Kolkata")).toBe(true);
  });
});

describe("supportedZones", () => {
  it("carries the real list, not the fallback", () => {
    const zones = supportedZones();
    expect(zones.length).toBeGreaterThan(100);
    expect(zones).toContain("Europe/London");
  });
});

describe("zonesIncluding", () => {
  // This is the one the picker needs. Node builds the list as Asia/Calcutta,
  // browsers report Asia/Kolkata, and Asia/Kolkata is the app's own default, so
  // without this the Settings picker shows a value that its own list has no row
  // for and searching for it finds nothing.
  it("puts a value the runtime spells differently back in", () => {
    const zones = supportedZones();
    const missing = zones.includes("Asia/Kolkata") ? "Asia/Calcutta" : "Asia/Kolkata";
    expect(zonesIncluding(zones, missing)[0]).toBe(missing);
  });

  it("leaves the list alone when the value is already there", () => {
    const zones = supportedZones();
    expect(zonesIncluding(zones, "Europe/London")).toBe(zones);
    expect(zonesIncluding(zones, "")).toBe(zones);
  });
});
