import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupMembers, activities } from "@/db/schema";

// Give a new user one group and one sleep activity so the check-in loop works
// before Phase 5 builds real group creation. Idempotent: if the user already
// belongs to a group, this does nothing.
//
// No transaction: the neon-http driver has no interactive transactions, and at
// this scale a concurrent double-create on a user's very first load is not a
// real risk. The membership check makes repeat calls safe.
export async function ensureUserSetup(userId: string): Promise<void> {
  const existing = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  const today = new Date().toISOString().slice(0, 10);

  const [group] = await db
    .insert(groups)
    .values({ name: "Curfew", createdBy: userId })
    .returning({ id: groups.id });

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId, role: "owner", joinedAt: today });

  await db
    .insert(activities)
    .values({ groupId: group.id, typeKey: "sleep", period: "day", createdBy: userId });
}
