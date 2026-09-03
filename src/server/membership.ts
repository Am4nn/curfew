import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";

// Membership is enforced in the query layer, via this one helper, on every
// group-scoped query (invariant 10). RLS is deferred and is not a substitute.
// Check-in is global per user so little needs it yet, but every later query
// that touches a group goes through here.
export async function assertMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await memberRole(groupId, userId);
}

/** The same check, answering with the role, for the screens that need it. */
export async function memberRole(
  groupId: string,
  userId: string,
): Promise<"owner" | "member"> {
  const rows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.leftAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    throw new Error("not a member of this group");
  }
  return rows[0].role === "owner" ? "owner" : "member";
}
