// Access control for the admin console, gated by capability rather than by
// scattered role checks. A role is just a named bundle of capabilities; adding
// a role is a one-line change here. Enforced server-side by can() /
// requireCapability() in src/server/admin.ts, and used to render only the
// sections and actions a user is allowed.

export type Capability =
  | "users.view"
  | "users.approve"
  | "users.set_role"
  | "users.disable"
  | "groups.view"
  | "groups.archive"
  | "ledger.view"
  | "ledger.adjust"
  | "insights.view"
  | "ops.score"
  | "ops.verify";

export type Role = "member" | "auditor" | "ops" | "moderator" | "admin";

// Most-privileged first, for pickers.
export const ROLES: Role[] = ["admin", "moderator", "ops", "auditor", "member"];

const CAPS: Record<Role, Capability[]> = {
  // Admin can do everything, including changing roles.
  admin: [
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
  ],
  // Moderator gates accounts and reads people/groups, but never touches money
  // or roles and cannot run jobs.
  moderator: ["users.view", "users.approve", "groups.view", "ledger.view", "insights.view"],
  // Ops runs the derivable jobs and reads data, but cannot approve or set roles.
  ops: ["users.view", "groups.view", "ledger.view", "insights.view", "ops.score", "ops.verify"],
  // Auditor is read-only across the console.
  auditor: ["users.view", "groups.view", "ledger.view", "insights.view"],
  // Member has no admin access.
  member: [],
};

export function roleCapabilities(role: Role): Capability[] {
  return CAPS[role] ?? [];
}

export function roleHas(role: Role, capability: Capability): boolean {
  return (CAPS[role] ?? []).includes(capability);
}

// Any non-member role can enter the admin console.
export function hasAdminAccess(role: Role): boolean {
  return role !== "member";
}

export function isRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}
