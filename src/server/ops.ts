import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { evidence, events } from "@/db/schema";
import { RETENTION_DAYS } from "./evidence";

// What the Ops tab reports about stored evidence. Counted, never read: the
// console knows how many photos exist and never what any of them shows.

export interface EvidenceOps {
  stored: number;
  bytes: number;
  retentionDays: number;
  lastSweep: { at: Date; deleted: number } | null;
  /** Uploaded, never confirmed, older than an hour: the sweep's next targets. */
  orphaned: number;
}

export async function evidenceOps(): Promise<EvidenceOps> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);

  const [stored, swept, last, orphaned] = await Promise.all([
    db
      .select({
        n: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${evidence.bytes}), 0)::bigint`,
      })
      .from(evidence)
      .where(isNull(evidence.deletedAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(sql`${evidence.deletedAt} > now() - interval '24 hours'`),
    db
      .select({ at: evidence.deletedAt })
      .from(evidence)
      .where(sql`${evidence.deletedAt} is not null`)
      .orderBy(desc(evidence.deletedAt))
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(
        and(
          isNull(evidence.confirmedAt),
          isNull(evidence.deletedAt),
          sql`${evidence.requestedAt} < ${cutoff}`,
        ),
      ),
  ]);

  return {
    stored: stored[0]?.n ?? 0,
    bytes: Number(stored[0]?.bytes ?? 0),
    retentionDays: RETENTION_DAYS,
    lastSweep: last[0]?.at ? { at: last[0].at, deleted: swept[0]?.n ?? 0 } : null,
    orphaned: orphaned[0]?.n ?? 0,
  };
}

/** Bytes as something a person reads. */
export function humanBytes(bytes: number): string {
  if (bytes === 0) return "nothing";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

// ---- The scheduler: did the jobs run, and did any of them break -------------
//
// Two different questions with two different answers, and neither was asked
// before 3.4.7.
//
// A job that RAN AND BROKE now reports itself: QStash calls /api/cron/failed
// after the last retry and that route writes `ops.job.failed`. Before it, the
// failure went to Upstash's dead letter queue, which the free plan keeps for
// three days, and nothing here ever read it.
//
// A job that STOPPED BEING CALLED cannot report anything, because nothing ran.
// No Upstash feature can tell you this: a deleted or paused schedule is not a
// failed delivery, it is the absence of one. So the signal is the absence too.
// Every job already writes an event when it runs, and this reads the newest of
// each against the cadence it is supposed to keep.

/** The heartbeat each schedule leaves behind, and how long a gap is too long. */
const HEARTBEATS = [
  // Hourly, claimed before any work. Two hours is one missed firing plus room
  // for a slow one, so a single retry that lands late is not an alarm.
  { path: "/api/cron/score", label: "Scoring", event: "ops.score.ran", staleAfterMinutes: 120 },
  // Every fifteen minutes, and it beats even when PUSH_REMINDERS is off, so a
  // disabled environment still proves the tick is arriving.
  { path: "/api/cron/remind", label: "Reminders", event: "ops.push.ran", staleAfterMinutes: 60 },
  // 07:00 UTC. A day and an hour, so the report is not amber every morning
  // while the job is running.
  { path: "/api/cron/nightly", label: "Nightly", event: "ops.verify.ran", staleAfterMinutes: 25 * 60 },
] as const;

interface SchedulerJob {
  path: string;
  label: string;
  /** Null means this job has never run, which is not the same as late. */
  ranAt: Date | null;
  stale: boolean;
  staleAfterMinutes: number;
}

interface JobFailure {
  at: Date;
  path: string | null;
  status: number | null;
  retried: number | null;
  /** What the route said as it died, already truncated by the callback route. */
  response: string | null;
}

export interface SchedulerHealth {
  jobs: SchedulerJob[];
  /** Recent failures, newest first. Capped: this is a list, not an archive. */
  failures: JobFailure[];
  ok: boolean;
}

export async function schedulerHealth(days = 7, limit = 10): Promise<SchedulerHealth> {
  const since = new Date(Date.now() - days * 864e5);

  // One grouped query for the heartbeats rather than one per job. They are all
  // "newest row of this type", which is what max() over a filtered scan is.
  const beats = await db
    .select({ type: events.type, at: sql<Date>`max(${events.occurredAt})` })
    .from(events)
    .where(inArray(events.type, HEARTBEATS.map((h): string => h.event)))
    .groupBy(events.type);

  const newest = new Map(beats.map((b) => [b.type, new Date(b.at)]));

  const jobs: SchedulerJob[] = HEARTBEATS.map((h) => {
    const ranAt = newest.get(h.event) ?? null;
    return {
      path: h.path,
      label: h.label,
      ranAt,
      // Never having run is reported as "never", not as late. A fresh database
      // and a dead scheduler are different problems and the page says which.
      stale: ranAt !== null && Date.now() - ranAt.getTime() > h.staleAfterMinutes * 60_000,
      staleAfterMinutes: h.staleAfterMinutes,
    };
  });

  const failed = await db
    .select({ at: events.occurredAt, payload: events.payload })
    .from(events)
    .where(and(eq(events.type, "ops.job.failed"), gte(events.occurredAt, since)))
    .orderBy(desc(events.occurredAt))
    .limit(limit);

  const failures: JobFailure[] = failed.map((f) => {
    const p = (f.payload ?? {}) as Record<string, unknown>;
    return {
      at: f.at,
      path: typeof p.path === "string" ? p.path : null,
      status: typeof p.status === "number" ? p.status : null,
      retried: typeof p.retried === "number" ? p.retried : null,
      response: typeof p.response === "string" ? p.response : null,
    };
  });

  return { jobs, failures, ok: failures.length === 0 && !jobs.some((j) => j.stale) };
}
