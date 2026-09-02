import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupSettings } from "@/db/schema";
import { resolveAt } from "@/domain";
import { invalidateAppConfig } from "./app-config";

// The per-group money override an admin sets in the Groups tab (decision 66).
//
// Money resolves app-wide, then this override, then the group owner's own
// toggle. An owner can never turn money on where an admin has it off; this is
// how a single group keeps money while it is off everywhere else.
//
// null means "no override": the group follows the app-wide setting.

export type MoneyOverride = boolean | null;

export async function moneyOverrides(): Promise<Map<string, MoneyOverride>> {
  const now = new Date();
  const rows = await db
    .select({
      id: groupSettings.id,
      groupId: groupSettings.groupId,
      value: groupSettings.value,
      effectiveAt: groupSettings.effectiveAt,
    })
    .from(groupSettings)
    .where(eq(groupSettings.key, "money"));

  const byGroup = new Map<string, MoneyOverride>();
  for (const groupId of new Set(rows.map((r) => r.groupId))) {
    const row = resolveAt(rows.filter((r) => r.groupId === groupId), now);
    // A null value is how an override is cleared. The row stays, because the
    // table is append-only and "an admin removed the override" is history.
    byGroup.set(groupId, row && typeof row.value === "boolean" ? row.value : null);
  }
  return byGroup;
}

export async function setMoneyOverride(
  groupId: string,
  value: MoneyOverride,
  adminId: string,
): Promise<void> {
  await db.insert(groupSettings).values({
    groupId,
    key: "money",
    value: sql`${JSON.stringify(value)}::jsonb`,
    changedBy: adminId,
    // App clock, not the database's. See the note in saveControls.
    effectiveAt: new Date(),
  });
  invalidateAppConfig();
}

/**
 * Archive a group rather than delete it (decision 67). Nothing is removed: the
 * ledger, the events and the history all stay, and money already owed is still
 * owed. Archiving only takes it out of circulation.
 */
export async function setArchived(groupId: string, archived: boolean): Promise<void> {
  await db
    .update(groups)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(groups.id, groupId)));
}
