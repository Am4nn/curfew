import { describe, expect, it } from "vitest";
import { describeFailure } from "./job-failure";

// The shape QStash actually POSTs, from its own documentation of a failure
// callback. Written out in full rather than minimised, because the thing being
// tested is tolerance of somebody else's payload.
const real = {
  status: 500,
  header: { "content-type": ["text/html"] },
  body: Buffer.from("Internal Server Error").toString("base64"),
  retried: 3,
  maxRetries: 3,
  dlqId: "dlq_1234",
  sourceMessageId: "msg_abc",
  topicName: "",
  url: "https://curfew.amanarya.com/api/cron/score",
  method: "GET",
  sourceHeader: { Authorization: ["Bearer x"] },
  sourceBody: "",
  notBefore: 1789912800000,
  createdAt: 1789912800000,
  scheduleId: "scd_4suJguHg71aNsPxkbinuWLWUsc2e",
  callerIP: "1.2.3.4",
};

describe("describeFailure", () => {
  it("reads a real QStash failure report", () => {
    const p = describeFailure(real);
    expect(p.parsed).toBe(true);
    expect(p.path).toBe("/api/cron/score");
    expect(p.status).toBe(500);
    expect(p.retried).toBe(3);
    expect(p.dlqId).toBe("dlq_1234");
    expect(p.scheduleId).toBe("scd_4suJguHg71aNsPxkbinuWLWUsc2e");
    expect(p.response).toBe("Internal Server Error");
  });

  // The 3.4.6 lesson. A strict schema over somebody else's payload refused
  // every Android subscription for a week; these extra keys are exactly the
  // kind QStash adds without telling anyone.
  it("keeps reading when QStash adds a field", () => {
    const p = describeFailure({ ...real, somethingNew: "added next year", nested: { a: 1 } });
    expect(p.parsed).toBe(true);
    expect(p.dlqId).toBe("dlq_1234");
  });

  // Losing the alert because the report about it was malformed is the worst
  // trade available: the row is what makes a dead job visible at all.
  it("still records a report it cannot parse", () => {
    for (const bad of [null, "not json", 42, { status: "five hundred" }, {}]) {
      const p = describeFailure(bad);
      expect(p.dlqId).toBeNull();
      expect(p.response).toBeNull();
    }
    expect(describeFailure({ status: "five hundred" }).parsed).toBe(false);
    // An empty object is a legal report with nothing in it, not a parse
    // failure, and the difference is what tells you whether to trust the row.
    expect(describeFailure({}).parsed).toBe(true);
  });

  it("keeps a url it cannot parse as a url", () => {
    expect(describeFailure({ url: "not a url" }).path).toBe("not a url");
    expect(describeFailure({}).path).toBeNull();
  });

  // A Next.js error page is kilobytes of HTML and this is one line in a list.
  it("cuts a long response short", () => {
    const long = Buffer.from("x".repeat(5000)).toString("base64");
    expect(describeFailure({ body: long }).response).toHaveLength(400);
  });

  it("reports an empty body as nothing rather than as an empty string", () => {
    expect(describeFailure({ body: "" }).response).toBeNull();
    expect(describeFailure({ body: Buffer.from("   ").toString("base64") }).response).toBeNull();
  });
});
