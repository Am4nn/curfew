import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports, evidence, userApprovals } from "@/db/schema";
import { assertMember } from "./membership";
import { deletePhotos } from "./deletion";
import { recordEvent } from "./events";
import { deleteObject } from "./r2";
import type { ReportReason } from "@/lib/report-reasons";

// Reporting and removal. Any member can report a photo or a person; reports go
// to admins, who can remove the photo and suspend or ban the account.
//
// A report is the ONLY route by which an admin sees a photograph. The console
// counts behaviour and never reads it, and that stays true: an admin looks at
// one image because somebody asked them to, and the fact they looked is on the
// report.

export { REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";

/**
 * Report a photo. Only somebody who can see it may report it, which is the
 * same membership check the evidence tab makes.
 */
export async function reportEvidence(input: {
  reporterId: string;
  evidenceId: number;
  groupId: string;
  reason: ReportReason;
  note?: string;
}): Promise<void> {
  await assertMember(input.groupId, input.reporterId);

  const [row] = await db
    .select({ userId: evidence.userId })
    .from(evidence)
    .where(and(eq(evidence.id, input.evidenceId), isNull(evidence.deletedAt)))
    .limit(1);
  if (!row) throw new Error("That photo is no longer there.");
  if (row.userId === input.reporterId) throw new Error("That is your own photo.");

  // The subject must be in the same group, or somebody could report a photo
  // they were never entitled to see.
  await assertMember(input.groupId, row.userId);

  await db
    .insert(reports)
    .values({
      reporterId: input.reporterId,
      subjectId: row.userId,
      evidenceId: input.evidenceId,
      groupId: input.groupId,
      reason: input.reason,
      note: input.note?.trim() || null,
    })
    .onConflictDoNothing();
}

export interface OpenReport {
  id: number;
  reason: string;
  note: string | null;
  createdAt: Date;
  reporterName: string;
  subjectId: string;
  subjectName: string;
  groupName: string | null;
  objectKey: string | null;
}

/** The admin queue: what has been reported and not yet decided. */
export async function openReports(): Promise<OpenReport[]> {
  return db
    .select({
      id: reports.id,
      reason: reports.reason,
      note: reports.note,
      createdAt: reports.createdAt,
      reporterName: sql<string>`(select name from users where id = ${reports.reporterId})`,
      subjectId: reports.subjectId,
      subjectName: sql<string>`(select name from users where id = ${reports.subjectId})`,
      groupName: sql<string | null>`(select name from groups where id = ${reports.groupId})`,
      objectKey: sql<
        string | null
      >`(select object_key from evidence where id = ${reports.evidenceId} and deleted_at is null)`,
    })
    .from(reports)
    .where(eq(reports.outcome, "open"))
    .orderBy(desc(reports.createdAt))
    .limit(50);
}

/**
 * Decide a report.
 *
 * Upholding it deletes the photograph, which is the point: a rule with no
 * removal behind it is a suggestion. Banning is separate and deliberate, so an
 * admin removing one bad photo does not accidentally remove a person.
 */
export async function reviewReport(input: {
  adminId: string;
  reportId: number;
  outcome: "upheld" | "dismissed";
  removePhoto: boolean;
}): Promise<void> {
  const [report] = await db
    .select({
      id: reports.id,
      evidenceId: reports.evidenceId,
      subjectId: reports.subjectId,
      outcome: reports.outcome,
    })
    .from(reports)
    .where(eq(reports.id, input.reportId))
    .limit(1);
  if (!report || report.outcome !== "open") throw new Error("That report is already decided.");

  if (input.removePhoto && report.evidenceId !== null) {
    const [row] = await db
      .select({ objectKey: evidence.objectKey })
      .from(evidence)
      .where(and(eq(evidence.id, report.evidenceId), isNull(evidence.deletedAt)))
      .limit(1);
    if (row) {
      // The object before the row, as everywhere else: a row saying a photo is
      // gone while the file survives is the failure that matters.
      await deleteObject(row.objectKey);
      await db
        .update(evidence)
        .set({ deletedAt: new Date() })
        .where(eq(evidence.id, report.evidenceId));
    }
  }

  await db
    .update(reports)
    .set({ outcome: input.outcome, reviewedBy: input.adminId, reviewedAt: new Date() })
    .where(eq(reports.id, input.reportId));

  await recordEvent({
    userId: input.adminId,
    type: "admin.report.reviewed",
    payload: {
      report_id: input.reportId,
      outcome: input.outcome,
      photo_removed: input.removePhoto,
    },
  });
}

/**
 * Ban an account for breaking the rules.
 *
 * Distinct from an admin disabling somebody for housekeeping: the reason is
 * recorded, and money owed at the time stays owed and stays visible. A ban is
 * not a way to clear a debt.
 */
export async function banUser(input: {
  adminId: string;
  userId: string;
  reason: string;
}): Promise<void> {
  if (input.adminId === input.userId) throw new Error("You cannot ban yourself.");
  if (!input.reason.trim()) throw new Error("A ban needs a reason.");

  await db
    .update(userApprovals)
    .set({ disabledAt: new Date(), disabledReason: input.reason.trim() })
    .where(and(eq(userApprovals.userId, input.userId), isNull(userApprovals.disabledAt)));

  // Their photographs go with them. Their ledger rows do not.
  await deletePhotos(input.userId);

  await recordEvent({
    userId: input.adminId,
    type: "admin.user.banned",
    payload: { target: input.userId, reason: input.reason.trim() },
  });
}

/** Reports raised about one person, for the admin user detail. */
export async function reportsAbout(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reports)
    .where(eq(reports.subjectId, userId));
  return row?.n ?? 0;
}
