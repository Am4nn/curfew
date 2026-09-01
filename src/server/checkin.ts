import { DateTime } from "luxon";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { periodStart, getActivityType, type CheckinWindow } from "@/domain";
import { resolveUserTimezone, resolveUserSleepConfig } from "./config";
import { recordEvent } from "./events";
import { now } from "@/lib/clock";

function hhmm(d: Date, tz: string): string {
  return DateTime.fromJSDate(d, { zone: tz }).toFormat("HH:mm");
}

// Everything the read and write paths share: resolved timezone, the current
// noon-to-noon period, and the step windows for this period and the next one
// (the "next window" when idle can fall in the following period).
// Resolve the timezone and current noon-to-noon period (one round trip).
async function resolveContext(userId: string) {
  const nowDate = await now();
  const todayUtc = nowDate.toISOString().slice(0, 10);
  const tz = await resolveUserTimezone(userId, todayUtc);
  const period = periodStart(nowDate, tz);
  return { tz, now: nowDate, period };
}

// The step windows for this period and the next one (the idle "next window" can
// fall in the following period). Reads the sleep config.
async function windowsFor(userId: string, period: string, tz: string) {
  const config = await resolveUserSleepConfig(userId, period);
  const sleep = getActivityType("sleep");
  const nextPeriod = DateTime.fromISO(period, { zone: tz })
    .plus({ days: 1 })
    .toFormat("yyyy-MM-dd");
  return {
    thisWindows: sleep.windows(config, period, tz),
    nextWindows: sleep.windows(config, nextPeriod, tz),
  };
}

async function doneStepsForPeriod(
  userId: string,
  period: string,
): Promise<Map<string, Date>> {
  const rows = await db
    .select({ type: events.type, occurredAt: events.occurredAt })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, "checkin.sleep.%"),
        sql`${events.payload}->>'period_start' = ${period}`,
      ),
    );
  const done = new Map<string, Date>();
  for (const r of rows) {
    const step = r.type.split(".").pop()!;
    done.set(step, r.occurredAt);
  }
  return done;
}

function openNow(windows: CheckinWindow[], now: Date): CheckinWindow | undefined {
  return windows.find((w) => now >= w.opensAt && now <= w.closesAt);
}

function nextUpcoming(
  windows: CheckinWindow[],
  now: Date,
): CheckinWindow | undefined {
  return windows
    .filter((w) => w.opensAt > now)
    .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())[0];
}

export interface NextWindowView {
  label: string;
  opensLabel: string;
  closesLabel: string;
}

export interface StepView {
  key: string;
  label: string;
  at: string | null; // "HH:mm" if checked in this period
}

export type CheckinAction =
  | { kind: "open"; step: string; label: string; closesLabel: string }
  | { kind: "waiting"; label: string; recordedLabel: string; next: NextWindowView | null }
  | { kind: "idle"; next: NextWindowView | null };

export interface CheckinState {
  period: string; // the sleep_date this screen is about
  steps: StepView[];
  action: CheckinAction;
}

function nextView(w: CheckinWindow | undefined, tz: string): NextWindowView | null {
  if (!w) return null;
  return {
    label: w.label,
    opensLabel: hhmm(w.opensAt, tz),
    closesLabel: hhmm(w.closesAt, tz),
  };
}

export async function getCheckinState(userId: string): Promise<CheckinState> {
  const { tz, now, period } = await resolveContext(userId);
  // The config read and the check-in read are independent; run them together.
  const [{ thisWindows, nextWindows }, done] = await Promise.all([
    windowsFor(userId, period, tz),
    doneStepsForPeriod(userId, period),
  ]);

  const steps: StepView[] = thisWindows.map((w) => {
    const at = done.get(w.step);
    return { key: w.step, label: w.label, at: at ? hhmm(at, tz) : null };
  });

  const open = openNow(thisWindows, now);
  const next = nextUpcoming([...thisWindows, ...nextWindows], now);

  let action: CheckinAction;
  if (open && !done.has(open.step)) {
    action = {
      kind: "open",
      step: open.step,
      label: open.label,
      closesLabel: hhmm(open.closesAt, tz),
    };
  } else if (open) {
    action = {
      kind: "waiting",
      label: open.label,
      recordedLabel: hhmm(done.get(open.step)!, tz),
      next: nextView(next, tz),
    };
  } else {
    action = { kind: "idle", next: nextView(next, tz) };
  }

  return { period, steps, action };
}

export type CheckinResult =
  | { ok: true; step: string; atLabel: string }
  | { ok: false; reason: "closed" | "duplicate" };

export async function performCheckin(
  userId: string,
  sessionId: string | null,
): Promise<CheckinResult> {
  const { tz, now, period } = await resolveContext(userId);
  const { thisWindows } = await windowsFor(userId, period, tz);
  const open = openNow(thisWindows, now);
  if (!open) return { ok: false, reason: "closed" };

  const row = await recordEvent({
    userId,
    sessionId,
    type: `checkin.sleep.${open.step}`,
    payload: {
      type_key: "sleep",
      step: open.step,
      period_start: period,
      evidence: {},
    },
    ignoreConflict: true,
  });

  if (!row) return { ok: false, reason: "duplicate" };
  return { ok: true, step: open.step, atLabel: hhmm(row.occurredAt, tz) };
}
