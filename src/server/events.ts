import { db } from "@/db";
import { events } from "@/db/schema";

// The single insert path for events. No inline event inserts anywhere else
// (CLAUDE.md conventions). occurred_at is left to the DB default (server clock
// only, invariant 8).
//
// ignoreConflict is for check-ins: the partial unique index
// events_one_checkin_idx rejects a second press for the same step and period.
// With ignoreConflict the duplicate is swallowed and this returns null, so the
// caller can report "already checked in" instead of throwing.
export async function recordEvent(input: {
  userId?: string | null;
  sessionId?: string | null;
  type: string;
  payload?: unknown;
  ignoreConflict?: boolean;
}): Promise<{ id: number; occurredAt: Date } | null> {
  const values = {
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    type: input.type,
    payload: (input.payload ?? {}) as Record<string, unknown>,
  };

  const query = input.ignoreConflict
    ? db.insert(events).values(values).onConflictDoNothing()
    : db.insert(events).values(values);

  const rows = await query.returning({
    id: events.id,
    occurredAt: events.occurredAt,
  });

  return rows[0] ?? null;
}
