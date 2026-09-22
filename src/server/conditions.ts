import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { userConditions } from "@/db/schema";
import { CONDITION_PREFIX, LABEL_MAX, conditionActivity } from "@/domain";
import { saveUserActivity } from "./activities";

// Conditions somebody writes themselves (1.19). The list is ours plus yours,
// and this is the yours half.
//
// A condition is a TRACKED ACTIVITY like any other: its window, its schedule
// and its sharing toggle live in the same tables, keyed by `condition:<uuid>`.
// This table holds the one fact those tables have no room for, the label, and
// `user_conditions` is its only source of truth. Every read merges it over
// whatever the config blob carries, so the blob's copy can never be read
// stale.

interface Condition {
  id: string;
  typeKey: string;
  label: string;
}

/** Every label this person has ever used, live or retired, lowercased. */
async function labelsEverUsed(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ label: userConditions.label })
    .from(userConditions)
    .where(eq(userConditions.userId, userId));
  return new Set(rows.map((r) => r.label.trim().toLowerCase()));
}

export class ConditionError extends Error {}

/**
 * Write one, and start tracking it in the same breath.
 *
 * Creating a condition nobody tracks would be a row that does nothing and a
 * screen that looks broken, so this does both: the row, then the activity, at
 * the module's defaults with the label written in. A first setup lands TODAY
 * (`saveUserActivity`), so it can be confirmed tonight.
 */
export async function createCondition(userId: string, raw: string): Promise<Condition> {
  const label = raw.trim().replace(/\s+/g, " ");
  if (label.length === 0) throw new ConditionError("Give it a name.");
  if (label.length > LABEL_MAX) {
    throw new ConditionError(`Keep it to ${LABEL_MAX} characters.`);
  }

  // Checked here for the message, and again by the partial unique index for
  // the truth. Two requests at once would both pass this and one would lose at
  // the index, which is the right way round: the check is for the person and
  // the index is for the data.
  //
  // Against EVERY label, not only the live ones, because a retired condition
  // keeps its history and two runs of "No doomscroll" a year apart would be
  // impossible to tell apart in a ledger.
  if ((await labelsEverUsed(userId)).has(label.toLowerCase())) {
    throw new ConditionError("You have used that name before.");
  }

  const [row] = await db
    .insert(userConditions)
    .values({ userId, label })
    .returning({ id: userConditions.id });
  if (!row) throw new ConditionError("That did not save.");

  const typeKey = CONDITION_PREFIX + row.id;
  await saveUserActivity({
    userId,
    typeKey,
    enabled: true,
    schedule: {
      schedule: conditionActivity.defaults.schedule,
      dayBoundary: conditionActivity.defaults.dayBoundary,
      minGap: conditionActivity.defaults.minGap ?? 0,
    },
    config: { ...conditionActivity.defaults.config, label },
  });

  return { id: row.id, typeKey, label };
}

/**
 * Stop offering it. The history stays.
 *
 * Retiring is not the same as switching the activity off, and both happen:
 * the switch is what stops it being scored, and this is what stops the label
 * being resolvable as something you could write again. A deleted row would
 * leave `checkin.condition:<id>.declare` events pointing at a label nothing
 * can resolve, and the ledger would print a blank (invariant 1).
 */
export async function retireCondition(userId: string, id: string): Promise<void> {
  await db
    .update(userConditions)
    .set({ retiredAt: sql`now()` })
    .where(
      and(
        eq(userConditions.userId, userId),
        eq(userConditions.id, id),
        isNull(userConditions.retiredAt),
      ),
    );
}
