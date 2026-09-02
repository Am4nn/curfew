import { describe, it, expect } from "vitest";
import { resolveAt, resolveMoney } from "./config";

const row = (id: number, iso: string, value: unknown) => ({
  id,
  effectiveAt: new Date(iso),
  value,
});

describe("resolveAt", () => {
  const rows = [
    row(1, "2026-09-01T00:00Z", "first"),
    row(2, "2026-09-10T15:00Z", "second"),
    row(3, "2026-09-20T09:00Z", "third"),
  ];

  it("takes the latest row at or before the instant", () => {
    expect(resolveAt(rows, new Date("2026-09-15T00:00Z"))?.value).toBe("second");
  });

  it("includes a row written at exactly that instant", () => {
    expect(resolveAt(rows, new Date("2026-09-10T15:00Z"))?.value).toBe("second");
  });

  it("ignores rows from the future", () => {
    expect(resolveAt(rows, new Date("2026-09-05T00:00Z"))?.value).toBe("first");
  });

  it("is null before anything was ever set", () => {
    expect(resolveAt(rows, new Date("2026-08-31T23:59Z"))).toBeNull();
  });

  it("breaks a tie on id, so two writes in one transaction are ordered", () => {
    const same = [
      row(7, "2026-09-10T15:00Z", "earlier write"),
      row(8, "2026-09-10T15:00Z", "later write"),
    ];
    expect(resolveAt(same, new Date("2026-09-11T00:00Z"))?.value).toBe("later write");
  });

  it("does not assume input order", () => {
    expect(resolveAt([...rows].reverse(), new Date("2026-09-15T00:00Z"))?.value).toBe(
      "second",
    );
  });

  it("is empty-safe", () => {
    expect(resolveAt([], new Date())).toBeNull();
  });
});

describe("a period straddling a switch", () => {
  // The Phase 2 done-condition. Money off at 3pm; the day closes at midnight.
  const settings = [
    row(1, "2026-09-01T00:00Z", true),
    row(2, "2026-09-10T09:30Z", false), // 3pm IST
    row(3, "2026-09-11T03:30Z", true), // 9am IST the next day
  ];
  const moneyAt = (iso: string) => resolveAt(settings, new Date(iso))?.value;

  it("the day that closes after the switch carries no fine", () => {
    // 10 Sep closes at midnight IST, which is 18:30Z.
    expect(moneyAt("2026-09-10T18:30Z")).toBe(false);
  });

  it("the day before it is unaffected", () => {
    expect(moneyAt("2026-09-09T18:30Z")).toBe(true);
  });

  it("the day after money returns is fined again", () => {
    expect(moneyAt("2026-09-11T18:30Z")).toBe(true);
  });

  it("what mattered is when the period CLOSED, not when it opened", () => {
    // The 10th opened while money was on and closed while it was off. It is
    // judged by the close, so no fine.
    const opened = moneyAt("2026-09-09T18:30Z");
    const closed = moneyAt("2026-09-10T18:30Z");
    expect(opened).toBe(true);
    expect(closed).toBe(false);
  });
});

describe("resolveMoney order", () => {
  it("an owner cannot turn money on where an admin has it off app-wide", () => {
    expect(resolveMoney({ appWide: false, ownerToggle: true })).toBe(false);
  });

  it("a per-group override beats the app-wide default", () => {
    // The case this exists for: money off everywhere, on for one group.
    expect(
      resolveMoney({ appWide: false, groupOverride: true, ownerToggle: true }),
    ).toBe(true);
  });

  it("an override that says off beats an app-wide on", () => {
    expect(
      resolveMoney({ appWide: true, groupOverride: false, ownerToggle: true }),
    ).toBe(false);
  });

  it("the owner still decides within what is allowed", () => {
    expect(
      resolveMoney({ appWide: true, groupOverride: true, ownerToggle: false }),
    ).toBe(false);
  });

  it("no override falls through to app-wide", () => {
    expect(resolveMoney({ appWide: true, groupOverride: null, ownerToggle: true })).toBe(
      true,
    );
  });
});
