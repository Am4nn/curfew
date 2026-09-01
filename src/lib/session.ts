import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/db";
import { userApprovals, type ApprovalStatus } from "@/db/schema";
import { previewEnabled, PREVIEW_USER } from "./preview";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

// Reads the real session from the database. Use this in server components and
// server actions, never the optimistic cookie check from middleware.
export async function getSessionUser(): Promise<SessionUser | null> {
  // Preview mode is signed in as the seeded admin, no OAuth round trip.
  if (previewEnabled()) return PREVIEW_USER;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

export async function getApprovalStatus(
  userId: string,
): Promise<ApprovalStatus> {
  const row = await db.query.userApprovals.findFirst({
    where: eq(userApprovals.userId, userId),
  });
  // A disabled account is blocked whatever its approval status. No row is
  // treated as pending: the create hook writes one, but a missing row must
  // never read as approved.
  if (row?.disabledAt) return "disabled";
  return (row?.status as ApprovalStatus) ?? "pending";
}
