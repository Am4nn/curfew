import type { Capability } from "../../src/lib/capabilities";

// Every capability, listed here rather than imported, ON PURPOSE.
//
// The point of the round is that a plain member is refused all of them. If it
// read the same array the roles are built from, adding a capability and
// forgetting to grant it correctly would still pass, because the test would
// have moved with the code. A second list has to be updated by hand, and the
// check below fails loudly when it has not been.
export const CAPABILITIES_FOR_TEST: Capability[] = [
  "users.view",
  "users.approve",
  "users.set_role",
  "users.disable",
  "groups.view",
  "groups.archive",
  "ledger.view",
  "ledger.adjust",
  "insights.view",
  "ops.score",
  "ops.verify",
  "settings.view",
  "settings.write",
];
