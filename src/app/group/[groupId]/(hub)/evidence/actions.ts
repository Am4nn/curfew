"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { reportEvidence } from "@/server/reports";
import type { ReportReason } from "@/lib/report-reasons";

export async function reportEvidenceAction(input: {
  evidenceId: number;
  groupId: string;
  reason: ReportReason;
  note?: string;
}): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  await reportEvidence({ ...input, reporterId: user.id });
  revalidatePath(`/group/${input.groupId}/evidence`);
}
