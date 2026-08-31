import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userApprovals, users } from "@/db/schema";

export async function isAdmin(userId: string): Promise<boolean> {
  const row = await db.query.userApprovals.findFirst({
    where: eq(userApprovals.userId, userId),
  });
  return row?.isAdmin === true;
}

export interface PendingUser {
  userId: string;
  email: string;
  name: string;
  requestedAt: Date;
}

export async function listPendingApprovals(): Promise<PendingUser[]> {
  return db
    .select({
      userId: userApprovals.userId,
      email: users.email,
      name: users.name,
      requestedAt: userApprovals.requestedAt,
    })
    .from(userApprovals)
    .innerJoin(users, eq(users.id, userApprovals.userId))
    .where(eq(userApprovals.status, "pending"));
}

// Approve or reject a pending account. Only an admin may call this; the caller
// (the server action) checks isAdmin first.
export async function decideApproval(
  adminId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  await db
    .update(userApprovals)
    .set({
      status: approve ? "approved" : "rejected",
      decidedAt: new Date(),
      decidedBy: adminId,
    })
    .where(and(eq(userApprovals.userId, userId), eq(userApprovals.status, "pending")));
}
