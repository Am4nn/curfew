import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { consentRecords } from "@/db/schema";
import { RETENTION_DAYS } from "./evidence";
import { MINIMUM_AGE, type PolicySection } from "./policy";

// What Curfew records, stated plainly and accepted before the app can be used.
// The rules a member agrees to are in `policy.ts`, and the gate shows both.
//
// The text lives here rather than in a document, because every claim in it has
// to stay true as the code changes, and a policy nobody can diff is a policy
// that quietly stops being accurate.

/**
 * Bump when EITHER document changes in substance. Everyone re-accepts, because
 * an old acceptance does not cover new wording.
 */
export const CONSENT_VERSION = 1;

export type ConsentSection = PolicySection;

export const CONSENT: ConsentSection[] = [
  {
    heading: "BEFORE ANYTHING ELSE",
    lines: [
      `You must be ${MINIMUM_AGE} or older to use Curfew.`,
      "Curfew records what you say you did. It does not check whether it is true, and a streak is a record of what you pressed rather than proof of what you did.",
      "It is not health, fitness, medical or financial advice, and nothing in it is a professional opinion.",
    ],
  },
  {
    heading: "WHAT IS RECORDED",
    lines: [
      "Every check-in you press, with the time the server saw it. Client clocks are never trusted.",
      "The photos you attach, where the activity asks for one.",
      "What you configure: which activities you track, their windows, targets and grace.",
      "Your streaks, and a reputation score for each group you are in.",
    ],
  },
  {
    heading: "PHOTOS",
    lines: [
      `Stored in object storage outside this app, and deleted ${RETENTION_DAYS} days after they are taken.`,
      "Compressed in your browser before they are uploaded. That re-encode also removes every scrap of metadata, GPS included, so location never leaves your device.",
      "Fetched through short-lived signed links, issued only to you and to members of a group you chose to share that activity's evidence with.",
      "You can delete all of them at any time, in Settings.",
    ],
  },
  {
    heading: "REPUTATION",
    lines: [
      "A score from 0 to 1000 in each group, worked out from whether you passed the periods you share with it.",
      "Sharing fewer of the activities a group accepts sets a ceiling below the top. Sharing more raises it.",
      "Doing nothing for a week starts a slow decay. A high score is a record you keep, not one you reach.",
      "Grace protects a streak. It never protects reputation and it never waives a fine.",
    ],
  },
  {
    heading: "A SCORE ONLY YOU SEE",
    lines: [
      "Curfew also keeps one score for you across everything you track, which nobody else ever sees, in any group or anywhere else.",
      "Its only effect is to set where you start in a group you join. It never touches your score inside a group afterwards.",
      "It exists so that leaving a group and rejoining it cannot be used to escape a bad record.",
    ],
  },
  {
    heading: "WHAT A GROUP SEES",
    lines: [
      "Only the activities you choose to share with it, and only from the day you shared them.",
      "For each of those: whether you passed, your streak, and your score in that group.",
      "Your photos, only if you also ticked evidence for that activity in that group.",
      "Nothing else. An activity you track privately is invisible to every group.",
    ],
  },
  {
    heading: "LEAVING A GROUP",
    lines: [
      "Your streaks, standing and photos stop being visible to it immediately.",
      "Money you owe stays owed, and stays visible to the people you owe it to.",
      "Rejoining starts you fresh in that group, never at your old number.",
    ],
  },
  {
    heading: "MONEY",
    lines: [
      "Fines are a record of what members owe each other. Curfew never collects, holds or moves money.",
      "The ledger is append-only. A correction is a new row, never an edit.",
      "Money owed is never deleted, including when you delete your account.",
    ],
  },
  {
    heading: "DELETING",
    lines: [
      "You can delete your photos, one activity's history, all of it, or your account, in Settings.",
      "Deleting your account removes your name, your email and your history, and you cannot sign in again.",
      "Two things survive: ledger rows, because a debt with no counterparty is not a debt, and check-in records with nothing identifying left on them.",
    ],
  },
  {
    heading: "WHAT ADMINS SEE",
    lines: [
      "That you checked in, and how often. Never what you checked in, and never your photos.",
      "An admin can switch whole systems off for everyone. Doing so never rewrites your history.",
    ],
  },
];

/** Has this person accepted the current text? */
export async function hasConsented(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ version: consentRecords.version })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.version, CONSENT_VERSION),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function recordConsent(userId: string): Promise<void> {
  await db
    .insert(consentRecords)
    .values({ userId, version: CONSENT_VERSION })
    .onConflictDoNothing();
}

/** When somebody last accepted, and which version, for Settings. */
export async function consentOf(
  userId: string,
): Promise<{ version: number; acceptedAt: Date } | null> {
  const [row] = await db
    .select({ version: consentRecords.version, acceptedAt: consentRecords.acceptedAt })
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.version))
    .limit(1);
  return row ?? null;
}
