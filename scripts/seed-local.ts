// Seed the local database with one of several fixtures, each a full wipe and
// rebuild. Local only: refuses to run unless LOCAL_MODE=1, so it can never
// touch a real database.
//
//   bun run local:seed                          -> fixture "default"
//   bun run local:seed -- --fixture=all-done     -> a named fixture
//
// Why fixtures at all: some visual states cannot coexist in one database (a
// blocking notice unacknowledged for the admin vs. no notice at all; a brand
// new account with nothing configured vs. a fully populated one). Each
// fixture below is a self-contained world built from the small helpers in the
// first half of this file.
//
// ---------------------------------------------------------------------------
// Fixed ids for the drift harness (scripts/drift/). Do not randomize these:
//
//   GROUP_NIGHT_OWLS       = "00000000-0000-0000-0000-0000000000a1"  -> /group/00000000-0000-0000-0000-0000000000a1
//   GROUP_EARLY_RISERS     = "00000000-0000-0000-0000-0000000000a2"  -> /group/00000000-0000-0000-0000-0000000000a2
//   GROUP_WEEKEND_CLUB     = "00000000-0000-0000-0000-0000000000a3"  -> /group/00000000-0000-0000-0000-0000000000a3  (default: admin is NOT a member)
//   GROUP_NO_MONEY         = "00000000-0000-0000-0000-0000000000a4"  -> /group/00000000-0000-0000-0000-0000000000a4  (fixture "no-money" only)
//   GROUP_INVITE_TRACKED   = "00000000-0000-0000-0000-0000000000a5"  -> /group/00000000-0000-0000-0000-0000000000a5  (fixture "invite-tracked-type" only)
//   GROUP_INVITE_UNTRACKED = "00000000-0000-0000-0000-0000000000a6"  -> /group/00000000-0000-0000-0000-0000000000a6  (fixture "invite-untracked-type" only)
//
//   INVITE_WEEKEND_CLUB    = "00000000-0000-0000-0000-0000000000b0"  -> /join/00000000-0000-0000-0000-0000000000b0  (default's incoming invite to admin)
//   INVITE_TRACKED         = "00000000-0000-0000-0000-0000000000b1"  -> /join/00000000-0000-0000-0000-0000000000b1  (fixture "invite-tracked-type" only)
//   INVITE_UNTRACKED       = "00000000-0000-0000-0000-0000000000b2"  -> /join/00000000-0000-0000-0000-0000000000b2  (fixture "invite-untracked-type" only)
//   INVITE_NEW_USER        = "00000000-0000-0000-0000-0000000000b3"  -> /join/00000000-0000-0000-0000-0000000000b3  (fixture "new-user-invite" only)
//
//   GROUP_GRACE            = "00000000-0000-0000-0000-0000000000a8"  -> /group/00000000-0000-0000-0000-0000000000a8  (fixture "grace" only)
//
//   NOTICE_MAINTENANCE     = "00000000-0000-0000-0000-0000000000c1"  (fixture "notice-active" only)
// ---------------------------------------------------------------------------

import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { DateTime } from "luxon";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  userApprovals,
  groups,
  groupActivityTypes,
  groupActivityRules,
  memberShares,
  groupMembers,
  groupInvites,
  userSettings,
  userActivityConfig,
  userActivities,
  userPauses,
  events,
  evidence,
  notices,
  groupSettings,
  consentRecords,
  activityTypes,
  appSettings,
} from "@/db/schema";
import {
  getActivityType,
  periodStart,
  periodUnit,
  EVERY_DAY,
  registeredKeys,
  type Schedule,
  type DayBoundary,
} from "@/domain";
import { scoreAll } from "@/server/scoring";
import { groupsSeeingEvidence } from "@/server/sharing";
import { tagEvidence } from "@/server/evidence-tags";
import { CONSENT_VERSION } from "@/server/consent";
import { settingConsequence, typeConsequence, noticeFrom } from "@/app/admin/controls/consequences";

if (process.env.LOCAL_MODE !== "1") {
  console.error("Refusing to seed: LOCAL_MODE is not 1. This script is local-only.");
  process.exit(1);
}

const TZ = "Asia/Kolkata";

// "Today" for every fixture that anchors on the real clock (everything except
// the checkin-open-* fixtures, which anchor on a fixed calendar date instead,
// documented at each of those builders below).
const anchor = DateTime.now().setZone(TZ).startOf("day");
const HISTORY_DAYS = 45;
// Config effective-from far enough back to cover HISTORY_DAYS plus margin.
const configFrom = anchor.minus({ days: 60 }).toFormat("yyyy-MM-dd");
// A date so early it predates every fixture's history, for rows (like the
// timezone default) that should simply always resolve.
const EPOCH = "2000-01-01";

// The module's own defaults, so the fixture is the app's shape rather than a
// second copy of it. The confirm window is not in here and cannot be: it opens
// half an hour after the wake press (item 17).
const DEFAULT_WINDOWS = getActivityType("sleep").defaults.config;

// Fixed ids. See the header comment.
const GROUP_NIGHT_OWLS = "00000000-0000-0000-0000-0000000000a1";
const GROUP_EARLY_RISERS = "00000000-0000-0000-0000-0000000000a2";
const GROUP_WEEKEND_CLUB = "00000000-0000-0000-0000-0000000000a3";
const GROUP_NO_MONEY = "00000000-0000-0000-0000-0000000000a4";
const GROUP_INVITE_TRACKED = "00000000-0000-0000-0000-0000000000a5";
const GROUP_INVITE_UNTRACKED = "00000000-0000-0000-0000-0000000000a6";

const INVITE_WEEKEND_CLUB = "00000000-0000-0000-0000-0000000000b0";
const INVITE_TRACKED = "00000000-0000-0000-0000-0000000000b1";
const INVITE_UNTRACKED = "00000000-0000-0000-0000-0000000000b2";
const GROUP_NEW_USER_INVITE = "00000000-0000-0000-0000-0000000000a7";
const GROUP_GRACE = "00000000-0000-0000-0000-0000000000a8";
const INVITE_NEW_USER = "00000000-0000-0000-0000-0000000000b3";

const NOTICE_MAINTENANCE = "00000000-0000-0000-0000-0000000000c1";

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const PEOPLE = [
  { id: "preview-admin", name: "Preview Admin", email: "preview@curfew.local", status: "approved", isAdmin: true, role: "admin" },
  { id: "preview-alex", name: "Alex Rivera", email: "alex@curfew.local", status: "approved", isAdmin: false, role: "member" },
  { id: "preview-sam", name: "Sam Okafor", email: "sam@curfew.local", status: "approved", isAdmin: false, role: "member" },
  { id: "preview-riya", name: "Riya Shah", email: "riya@curfew.local", status: "approved", isAdmin: false, role: "member" },
  { id: "preview-pat", name: "Pat Nguyen", email: "pat@curfew.local", status: "pending", isAdmin: false, role: "member" },
  { id: "preview-dana", name: "Dana Cole", email: "dana@curfew.local", status: "approved", isAdmin: false, role: "member", disabled: true },
] as const;

const ACTIVE_MEMBERS = ["preview-admin", "preview-alex", "preview-sam", "preview-riya"];

async function insertPerson(p: (typeof PEOPLE)[number]): Promise<void> {
  await db.insert(users).values({
    id: p.id,
    name: p.name,
    email: p.email,
    emailVerified: true,
    image: null,
  });
  await db.insert(userApprovals).values({
    userId: p.id,
    status: p.status,
    isAdmin: p.isAdmin,
    role: p.role,
    requestedAt: new Date(),
    decidedAt: p.status === "pending" ? null : new Date(),
    decidedBy: p.status === "pending" ? null : "preview-admin",
    disabledAt: "disabled" in p && p.disabled ? new Date() : null,
  });
}

async function seedAllPeople(): Promise<void> {
  for (const p of PEOPLE) await insertPerson(p);
}

async function insertDefaultTimezone(): Promise<void> {
  await db.insert(userSettings).values({ userId: null, timezone: TZ, effectiveFrom: EPOCH });
}

async function consentApproved(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await db.insert(consentRecords).values({ userId, version: CONSENT_VERSION });
  }
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

async function wipe(): Promise<void> {
  console.log("wiping local data");
  // activity_types and app_settings are NOT wiped: they are app-wide config
  // owned by `bun run sync:activities` / the admin console, not fixture data.
  //
  // The list is deliberately not every table. `user_pauses`,
  // `activity_streaks` and `fine_postings` all carry a foreign key to `users`,
  // so CASCADE reaches them. Checked rather than assumed: a surviving
  // `fine_postings` row would make the next seed write no fines at all, since
  // a posting that already exists is exactly what tells `writeFines` the fine
  // has been charged.
  await db.execute(sql`TRUNCATE TABLE
    ledger_entries, activity_outcomes, activity_scores, reputation_daily,
    evidence, reports, events,
    user_activity_config, user_activities, user_settings,
    group_invites, group_members, member_shares, group_activity_rules,
    group_activity_types, group_settings, groups,
    notice_acks, notices, consent_records,
    user_approvals, sessions, accounts, users
    RESTART IDENTITY CASCADE`);
}

// ---------------------------------------------------------------------------
// Tracking an activity: the switch (user_activities) and its settings
// (user_activity_config), both required since v3 decision 83. The original
// version of this script never wrote user_activities at all, which meant
// nothing it seeded was actually reachable through getUserActivity() -- every
// checkin and activities screen would have redirected as "not tracking this".
// ---------------------------------------------------------------------------

interface ScheduleShape {
  schedule: Schedule;
  dayBoundary: DayBoundary;
  /** Overrides the module's own default, which is what `trackType` fills in. */
  minGap?: number;
}

async function trackType(
  userId: string,
  typeKey: string,
  schedule: ScheduleShape,
  config: unknown,
  effectiveFrom: string,
): Promise<void> {
  await db.insert(userActivityConfig).values({
    userId,
    typeKey,
    // The gap comes from the MODULE unless the fixture says otherwise, which
    // is what `defaultsFor` does when somebody sets an activity up for real
    // (item 18). Without it the fixture's water has no wait between glasses
    // and the screens describe a setup the app would never write.
    config: {
      schedule: { minGap: getActivityType(typeKey).defaults.minGap ?? 0, ...schedule },
      config,
    },
    effectiveFrom,
  });
  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: true,
    effectiveAt: DateTime.fromISO(effectiveFrom, { zone: TZ }).toJSDate(),
  });
}

// ---------------------------------------------------------------------------
// Check-in events and evidence
// ---------------------------------------------------------------------------

let idemSeq = 0;
let evidenceSeq = 0;

/** Insert one recorded check-in directly, bypassing the app's write path
 * (this is a seed script, not a request). Returns the period it landed in. */
async function checkin(
  userId: string,
  typeKey: string,
  step: string,
  at: Date,
  schedule: Pick<ScheduleShape, "schedule" | "dayBoundary">,
  evidencePayload: Record<string, unknown> = {},
  evidenceKey?: string,
): Promise<string> {
  idemSeq++;
  const period = periodStart(at, TZ, {
    unit: periodUnit(schedule.schedule),
    boundary: schedule.dayBoundary,
  });
  await db.insert(events).values({
    userId,
    type: `checkin.${typeKey}.${step}`,
    payload: {
      type_key: typeKey,
      step,
      period_start: period,
      idem: `seed-${idemSeq}`,
      evidence: evidencePayload,
      ...(evidenceKey ? { evidence_key: evidenceKey } : {}),
    },
    occurredAt: at,
  });
  return period;
}

/**
 * A stand-in photo for a historical check-in: the row, the `evidence_key` on
 * the check-in's own payload, and a real file under `.r2-local/` so the
 * thumbnail actually loads. LOCAL_MODE serves that directory in place of the
 * bucket (see `src/server/r2.ts`), so every evidence screen renders with
 * pictures rather than broken tiles.
 */
/**
 * A tiny PNG in one flat colour. Hand-encoded rather than pulled from a
 * dependency: it is three chunks and a zlib deflate, and the alternative is an
 * image library in a seed script.
 */
function flatPng(size: number, rgb: [number, number, number]): Buffer {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      raw[row + 1 + x * 3] = rgb[0];
      raw[row + 2 + x * 3] = rgb[1];
      raw[row + 3 + x * 3] = rgb[2];
    }
  }

  const chunk = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function writeFixturePhoto(objectKey: string, seq: number): Promise<void> {
  const file = path.join(process.cwd(), ".r2-local", objectKey);
  await mkdir(path.dirname(file), { recursive: true });
  // Each one a different shade, so a wall of tiles reads as separate photos
  // rather than one repeated. Warm and dim: these sit on a near-black ground.
  const hue = (seq * 47) % 360;
  await writeFile(file, flatPng(64, hsl(hue, 0.32, 0.34)));
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

async function addEvidence(
  userId: string,
  typeKey: string,
  step: string,
  period: string,
  at: Date,
): Promise<string> {
  evidenceSeq++;
  const objectKey = `local-fixture/${evidenceSeq}.png`;
  await writeFixturePhoto(objectKey, evidenceSeq);
  await db.insert(evidence).values({
    userId,
    typeKey,
    step,
    periodStart: period,
    idem: `seed-evidence-${evidenceSeq}`,
    objectKey,
    contentType: "image/jpeg",
    bytes: 180_000,
    requestedAt: at,
    confirmedAt: at,
    deleteAfter: DateTime.fromJSDate(at, { zone: "utc" }).plus({ days: 60 }).toFormat("yyyy-MM-dd"),
  });
  return objectKey;
}

// ---------------------------------------------------------------------------
// Per-type history generators
// ---------------------------------------------------------------------------

const SLEEP_SCHEDULE: ScheduleShape = { schedule: EVERY_DAY, dayBoundary: "noon" };
const GYM_SCHEDULE = (perWeek: number): ScheduleShape => ({
  schedule: { kind: "minimum", perWeek },
  dayBoundary: "midnight",
});
const DAILY_SCHEDULE: ScheduleShape = { schedule: EVERY_DAY, dayBoundary: "midnight" };

/** Per-user daily pattern for sleep: which of night/wake/confirm happened. */
function sleepPattern(userId: string, dayIndex: number): string[] {
  const all = ["night", "wake", "confirm"];
  switch (userId) {
    case "preview-admin":
      return dayIndex % 7 === 0 ? ["night", "wake"] : all; // occasional missed confirm
    case "preview-alex":
      return dayIndex % 5 === 0 ? ["night", "wake"] : all;
    case "preview-sam":
      return dayIndex % 6 === 0 ? [] : all; // occasional full miss
    case "preview-riya":
      return dayIndex === 3 ? ["night", "wake"] : all; // near perfect
    default:
      return all;
  }
}

// A stable [0, 1) value per seed string, so the wake-time chart shows a real
// scatter instead of one flat line, without making a reseed non-deterministic
// (the drift harness diffs against a fixed mock, so a reseed must reproduce
// the exact same screenshot every time).
function deterministicFraction(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * A night's presses, at the instants the app would have accepted them.
 *
 * The confirm window is anchored to the WAKE press (item 17), so it cannot be
 * resolved until that press exists. Each window is therefore asked for against
 * what has already happened, which is exactly how `getCheckinState` asks.
 * Doing it any other way seeds confirms outside any window, and a fixture
 * full of nights the app would have failed.
 *
 * Every press sits at the middle of its own window unless told otherwise.
 * `wakeFraction` moves the wake press around inside its window so the wake-time
 * chart has something to plot, and `wakeAt` names the instant outright, which
 * is what a fixture needing the confirm window at a particular hour wants:
 * the confirm follows the press, so the press is the thing to place.
 */
function sleepPresses(
  windowsConfig: typeof DEFAULT_WINDOWS,
  period: string,
  steps: string[],
  opts: { wakeFraction?: number; wakeAt?: Date } = {},
): { step: string; at: Date }[] {
  const sleep = getActivityType("sleep");
  const out: { step: string; at: Date }[] = [];
  for (const step of ["night", "wake", "confirm"]) {
    if (!steps.includes(step)) continue;
    if (step === "wake" && opts.wakeAt) {
      out.push({ step, at: opts.wakeAt });
      continue;
    }
    const w = sleep.windows(windowsConfig, period, TZ, out).find((x) => x.step === step);
    // A confirm with no wake press before it has no window to land in, which
    // is the point of the redesign rather than a gap in the fixture.
    if (!w || w.waitingOn) continue;
    const span = w.closesAt.getTime() - w.opensAt.getTime();
    const fraction = step === "wake" ? (opts.wakeFraction ?? 0.5) : 0.5;
    out.push({ step, at: new Date(w.opensAt.getTime() + span * fraction) });
  }
  return out;
}

async function seedSleepEvents(
  userId: string,
  windowsConfig: typeof DEFAULT_WINDOWS,
  days: number,
  from: DateTime,
): Promise<number> {
  let n = 0;
  for (let i = days; i >= 1; i--) {
    const period = from.minus({ days: i }).toFormat("yyyy-MM-dd");
    const presses = sleepPresses(windowsConfig, period, sleepPattern(userId, i), {
      // Inside the window on purpose, 0.15 to 0.85 of its span, so a wobble
      // never flips a night that was seeded to pass.
      wakeFraction: 0.15 + deterministicFraction(`${userId}:${i}`) * 0.7,
    });
    for (const { step, at } of presses) {
      // Sleep REQUIRES a photo on confirm and nowhere else (decision 45), so a
      // seeded confirm without one is data the app itself could never produce.
      // It is also the only type anybody in the fixture shares evidence for,
      // which is why the group evidence tab had nothing to show.
      const key =
        step === "confirm"
          ? await addEvidence(userId, "sleep", "confirm", period, at)
          : undefined;
      await checkin(userId, "sleep", step, at, SLEEP_SCHEDULE, {}, key);
      n++;
    }
  }
  return n;
}

async function seedGymEvents(userId: string, days: number, from: DateTime): Promise<number> {
  const schedule = GYM_SCHEDULE(3);
  let n = 0;
  for (let i = days; i >= 1; i--) {
    const day = from.minus({ days: i });
    const dow = day.weekday; // 1 Monday .. 7 Sunday
    const doIt = [1, 3, 5].includes(dow) || (dow === 6 && i % 3 === 0);
    if (!doIt) continue;
    const at = day.set({ hour: 18, minute: 30 }).toJSDate();
    const period = periodStart(at, TZ, { unit: "week", boundary: "midnight" });
    // Gym always requires evidence (decision: the easiest thing to claim and
    // not do), so every seeded session carries a fake photo.
    const key = await addEvidence(userId, "gym", "session", period, at);
    await checkin(userId, "gym", "session", at, schedule, {}, key);
    n++;
  }
  return n;
}

async function seedStepsEvents(userId: string, days: number, from: DateTime): Promise<number> {
  let n = 0;
  for (let i = days; i >= 1; i--) {
    if (i % 6 === 0) continue; // occasional silent day: silence is a miss
    const day = from.minus({ days: i });
    const stepsVal = i % 9 === 0 ? 7500 : 9200; // occasional dip below the 8000 target
    const at = day.set({ hour: 21 }).toJSDate();
    let key: string | undefined;
    if (i % 5 === 0) {
      const period = periodStart(at, TZ, { unit: "day", boundary: "midnight" });
      key = await addEvidence(userId, "steps", "count", period, at);
    }
    await checkin(userId, "steps", "count", at, DAILY_SCHEDULE, { steps: stepsVal }, key);
    n++;
  }
  return n;
}

async function seedWaterEvents(userId: string, days: number, from: DateTime): Promise<number> {
  let n = 0;
  for (let i = days; i >= 1; i--) {
    const day = from.minus({ days: i });
    const glasses = i % 5 === 0 ? 6 : 8; // occasional day under target
    for (let g = 0; g < glasses; g++) {
      const at = day.set({ hour: 8 + g }).toJSDate();
      await checkin(userId, "water", "glass", at, DAILY_SCHEDULE, {});
      n++;
    }
  }
  return n;
}

async function seedNightfastEvents(
  userId: string,
  config: { window: { open: string; close: string }; cutoff: string | null },
  days: number,
  from: DateTime,
): Promise<number> {
  const type = getActivityType("nightfast");
  let n = 0;
  for (let i = days; i >= 1; i--) {
    const period = from.minus({ days: i }).toFormat("yyyy-MM-dd");
    const [w] = type.windows(config, period, TZ);
    const held = i % 8 !== 0; // occasional slip
    const at = new Date((w.opensAt.getTime() + w.closesAt.getTime()) / 2);
    await checkin(userId, "nightfast", "declare", at, DAILY_SCHEDULE, { held });
    n++;
  }
  return n;
}

async function seedOfficeEvents(
  userId: string,
  scheduledDays: number[],
  days: number,
  from: DateTime,
): Promise<number> {
  const config = { window: { open: "10:00", close: "14:00" } };
  const type = getActivityType("office");
  const schedule: ScheduleShape = {
    schedule: { kind: "days", days: scheduledDays as (1 | 2 | 3 | 4 | 5 | 6 | 7)[] },
    dayBoundary: "midnight",
  };
  let n = 0;
  for (let i = days; i >= 1; i--) {
    const day = from.minus({ days: i });
    if (!scheduledDays.includes(day.weekday)) continue;
    if (i % 10 === 0) continue; // occasional missed arrival
    const period = day.toFormat("yyyy-MM-dd");
    const [w] = type.windows(config, period, TZ);
    const at = new Date(w.opensAt.getTime() + 30 * 60_000);
    await checkin(userId, "office", "arrive", at, schedule, {});
    n++;
  }
  return n;
}

async function seedSugarfreeEvents(userId: string, days: number, from: DateTime): Promise<number> {
  const config = { window: { open: "20:00", close: "23:59" }, cutoff: null };
  const type = getActivityType("sugarfree");
  let n = 0;
  for (let i = days; i >= 1; i--) {
    const period = from.minus({ days: i }).toFormat("yyyy-MM-dd");
    const [w] = type.windows(config, period, TZ);
    const held = i === 4; // one slip a few days back, everything else held
    const at = new Date((w.opensAt.getTime() + w.closesAt.getTime()) / 2);
    await checkin(userId, "sugarfree", "declare", at, DAILY_SCHEDULE, { held });
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

async function createGroup(
  id: string,
  name: string,
  createdBy: string,
  members: { id: string; role: "owner" | "member" }[],
  joinedAt: string,
): Promise<void> {
  await db.insert(groups).values({ id, name, createdBy });
  for (const m of members) {
    await db.insert(groupMembers).values({ groupId: id, userId: m.id, role: m.role, joinedAt });
  }
}

/** The group accepts Sleep, fines a miss, and every member shares it. */
async function acceptSleepWithFine(
  groupId: string,
  members: string[],
  fineAmount: number,
  currency: string,
  effectiveFrom: string,
  moneyOn: boolean,
): Promise<void> {
  await db.insert(groupActivityTypes).values({
    groupId,
    typeKey: "sleep",
    accepted: true,
    changedBy: "preview-admin",
  });
  await db.insert(groupActivityRules).values({
    groupId,
    typeKey: "sleep",
    fineMode: "flat",
    fineAmount,
    currency,
    effectiveFrom,
    changedBy: "preview-admin",
  });
  // The owner's own money toggle: off by default (decision 18), so a
  // "money-on" group has to say so explicitly.
  await db.insert(groupSettings).values({
    groupId,
    key: "money_owner",
    value: moneyOn,
    changedBy: "preview-admin",
    effectiveAt: DateTime.fromISO(effectiveFrom, { zone: TZ }).toJSDate(),
  });
  for (const uid of members) {
    await db.insert(memberShares).values({
      groupId,
      userId: uid,
      typeKey: "sleep",
      shared: true,
      shareEvidence: true,
      changedBy: uid,
      effectiveAt: DateTime.fromISO(effectiveFrom, { zone: TZ }).toJSDate(),
    });
  }
}

// ---------------------------------------------------------------------------
// The shared "default" world
// ---------------------------------------------------------------------------

/** Which of preview-admin's extra types this build should skip -- used by the
 * checkin-open-* fixtures, whose target type needs a config effective long
 * before `anchor` and must not be scored by this script's own (real-clock)
 * scoreAll() pass. See buildCheckinOpen* below for why. */
interface WorldOptions {
  moneyOn: boolean;
  skipAdminSleep?: boolean;
  skipAdminTypes?: Set<string>;
}

async function assembleDefaultWorld(opts: WorldOptions): Promise<void> {
  await seedAllPeople();
  await insertDefaultTimezone();

  await createGroup(
    GROUP_NIGHT_OWLS,
    "Night Owls",
    "preview-admin",
    [
      { id: "preview-admin", role: "owner" },
      { id: "preview-alex", role: "member" },
      { id: "preview-sam", role: "member" },
    ],
    configFrom,
  );
  await acceptSleepWithFine(
    GROUP_NIGHT_OWLS,
    ["preview-admin", "preview-alex", "preview-sam"],
    5000,
    "INR",
    configFrom,
    opts.moneyOn,
  );
  await db.insert(groupInvites).values({
    groupId: GROUP_NIGHT_OWLS,
    email: "newcomer@curfew.local",
    invitedBy: "preview-admin",
    status: "pending",
  });

  await createGroup(
    GROUP_EARLY_RISERS,
    "Early Risers",
    "preview-admin",
    [
      { id: "preview-admin", role: "owner" },
      { id: "preview-riya", role: "member" },
    ],
    configFrom,
  );
  await acceptSleepWithFine(
    GROUP_EARLY_RISERS,
    ["preview-admin", "preview-riya"],
    5000,
    "INR",
    configFrom,
    opts.moneyOn,
  );
  await db.insert(groupInvites).values({
    groupId: GROUP_EARLY_RISERS,
    email: "newcomer@curfew.local",
    invitedBy: "preview-admin",
    status: "pending",
  });

  // A group the admin is NOT in, with a pending invite to the admin's own
  // email, so the dashboard shows an incoming invite to accept.
  await createGroup(
    GROUP_WEEKEND_CLUB,
    "Weekend Club",
    "preview-alex",
    [{ id: "preview-alex", role: "owner" }],
    configFrom,
  );
  await db.insert(groupActivityTypes).values({
    groupId: GROUP_WEEKEND_CLUB,
    typeKey: "sleep",
    accepted: true,
    changedBy: "preview-alex",
  });
  await db.insert(groupInvites).values({
    id: INVITE_WEEKEND_CLUB,
    groupId: GROUP_WEEKEND_CLUB,
    email: "preview@curfew.local",
    invitedBy: "preview-alex",
    status: "pending",
  });

  // Sleep history and tracking for every active member (except the admin,
  // when a checkin-open fixture is deferring the admin's own sleep).
  for (const uid of ACTIVE_MEMBERS) {
    if (uid === "preview-admin" && opts.skipAdminSleep) continue;
    await trackType(uid, "sleep", SLEEP_SCHEDULE, DEFAULT_WINDOWS, configFrom);
    await seedSleepEvents(uid, DEFAULT_WINDOWS, HISTORY_DAYS, anchor);
  }

  await seedAdminExtras(opts.skipAdminTypes ?? new Set());
}

/**
 * The admin's own catalog beyond Sleep: enough variety that Home shows a real
 * mixed TODAY list, /activities has several rows, /stats has more than one
 * chart, and /activities/add has both tracked and untracked types.
 *
 * Tracked: gym, steps, water, nightfast, office. Office is deliberately given
 * a schedule that excludes *today's* weekday (computed from `anchor`, so this
 * holds whatever day the script runs on) -- it is the "not scheduled today"
 * example. Gym cannot serve that role: a "minimum per week" schedule has no
 * unscheduled days in the engine (isScheduledDay always returns true for it),
 * so it is always "due" in some sense even on a day with no session planned.
 *
 * Left untracked: food, supplements, reading, screen, study, sugarfree. The
 * task brief that requested this fixture listed "food" in BOTH the tracked
 * set and the untracked set, which cannot both hold; this build keeps it
 * untracked, matching the fuller, non-overlapping untracked list, and swaps
 * in Office (not mentioned as tracked in the brief) so a genuine
 * "not scheduled today" row exists. Flagged in the final report.
 */
async function seedAdminExtras(skip: Set<string>): Promise<void> {
  const userId = "preview-admin";

  if (!skip.has("gym")) {
    await trackType(userId, "gym", GYM_SCHEDULE(3), {}, configFrom);
    await seedGymEvents(userId, HISTORY_DAYS, anchor);
  }

  if (!skip.has("steps")) {
    await trackType(userId, "steps", DAILY_SCHEDULE, { target: 8000, direction: "atLeast" }, configFrom);
    await seedStepsEvents(userId, HISTORY_DAYS, anchor);
  }

  if (!skip.has("water")) {
    await trackType(userId, "water", DAILY_SCHEDULE, { glasses: 8 }, configFrom);
    await seedWaterEvents(userId, HISTORY_DAYS, anchor);
  }

  if (!skip.has("nightfast")) {
    const nfConfig = { window: { open: "06:00", close: "11:00" }, cutoff: "20:00" };
    await trackType(userId, "nightfast", DAILY_SCHEDULE, nfConfig, configFrom);
    await seedNightfastEvents(userId, nfConfig, HISTORY_DAYS, anchor);
  }

  if (!skip.has("office")) {
    const officeDays = ([1, 2, 3, 4, 5, 6, 7] as const).filter((d) => d !== anchor.weekday);
    const officeSchedule: ScheduleShape = {
      schedule: { kind: "days", days: officeDays },
      dayBoundary: "midnight",
    };
    await trackType(userId, "office", officeSchedule, { window: { open: "10:00", close: "14:00" } }, configFrom);
    await seedOfficeEvents(userId, [...officeDays], HISTORY_DAYS, anchor);
  }
}

async function runScoring(): Promise<void> {
  console.log("scoring the seeded history");
  const result = await scoreAll({});
  console.log(`scored ${result.users} user(s), ${result.fines} fine(s) written`);
  await backdateFines();
}

/**
 * Give every seeded fine the date of the period it punishes.
 *
 * The whole history is scored in one pass here, so `created_at` defaults to
 * the moment the seed ran and the ledger screen showed months of fines stacked
 * on a single day. Nothing about date grouping could be reviewed against it.
 *
 * This is a fixture-only UPDATE and it does not weaken invariant 3. The app
 * never rewrites a ledger row; this script is not the app, and it has just
 * wiped and rebuilt the table from nothing. Settlements keep the seed's clock,
 * because a settlement is not tied to a period.
 */
async function backdateFines(): Promise<void> {
  await db.execute(sql`
    UPDATE ledger_entries
       SET created_at = (period_start::timestamptz + interval '21 hours')
     WHERE kind = 'fine' AND period_start IS NOT NULL
  `);
}

// ---------------------------------------------------------------------------
// Fixture: default
// ---------------------------------------------------------------------------

async function buildDefault(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await seedTodayPartial();
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();
}

// A genuinely mixed TODAY: some done, some still due, Office not scheduled
// (see seedAdminExtras). Without this, "today" carries no check-ins at all --
// every history helper seeds from i=days down to i=1, never i=0 -- so Home
// always read "0 of N done" regardless of what the clock said. Water and
// Nightfast get marked done; Sleep, Gym and Steps stay open, matching the
// mock's "some done, some due" state (V3Home.dc.html).
async function seedTodayPartial(): Promise<void> {
  const userId = "preview-admin";
  const period = anchor.toFormat("yyyy-MM-dd");

  // Nine in the morning to four in the afternoon, an hour apart, which is well
  // clear of water's thirty minute gap. They are wall-clock hours rather than
  // hours relative to now, so the fixture is the same whenever it is seeded;
  // the suites that care read it under a scrubbed clock rather than the real
  // one, because CI crosses midnight IST at 18:30 UTC every day and a fixture
  // that moves with the hour is a fixture nobody can assert against.
  for (let g = 0; g < 8; g++) {
    await checkin(userId, "water", "glass", anchor.set({ hour: 9 + g }).toJSDate(), DAILY_SCHEDULE, {});
  }

  const nfConfig = { window: { open: "06:00", close: "11:00" }, cutoff: "20:00" };
  const nightfast = getActivityType("nightfast");
  const [nfWindow] = nightfast.windows(nfConfig, period, TZ);
  await checkin(
    userId,
    "nightfast",
    "declare",
    new Date((nfWindow.opensAt.getTime() + nfWindow.closesAt.getTime()) / 2),
    DAILY_SCHEDULE,
    { held: true },
  );
}

// ---------------------------------------------------------------------------
// Fixture: all-done -- every one of today's required steps already pressed
// ---------------------------------------------------------------------------

async function buildAllDone(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await seedTodayCompletions();
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();
}

async function seedTodayCompletions(): Promise<void> {
  const userId = "preview-admin";

  // Sleep: today's period (noon boundary) gets all three steps.
  const period = anchor.toFormat("yyyy-MM-dd");
  for (const { step, at } of sleepPresses(DEFAULT_WINDOWS, period, [
    "night",
    "wake",
    "confirm",
  ])) {
    await checkin(userId, "sleep", step, at, SLEEP_SCHEDULE, {});
  }

  // Gym: fill every day from this week's Monday through today, so the weekly
  // minimum is met regardless of what the history above already contributed.
  const monday = anchor.minus({ days: anchor.weekday - 1 });
  for (let d = monday; d <= anchor; d = d.plus({ days: 1 })) {
    const at = d.set({ hour: 18, minute: 30 }).toJSDate();
    const gymPeriod = periodStart(at, TZ, { unit: "week", boundary: "midnight" });
    const key = await addEvidence(userId, "gym", "session", gymPeriod, at);
    await checkin(userId, "gym", "session", at, GYM_SCHEDULE(3), {}, key);
  }

  // Steps: today's reading clears the target.
  await checkin(userId, "steps", "count", anchor.set({ hour: 20 }).toJSDate(), DAILY_SCHEDULE, {
    steps: 9500,
  });

  // Water: all 8 glasses today, an hour apart. See the note in seedTodayPartial.
  for (let g = 0; g < 8; g++) {
    await checkin(userId, "water", "glass", anchor.set({ hour: 9 + g }).toJSDate(), DAILY_SCHEDULE, {});
  }

  // Nightfast: today's confirm, held.
  const nfConfig = { window: { open: "06:00", close: "11:00" }, cutoff: "20:00" };
  const nightfast = getActivityType("nightfast");
  const [nfWindow] = nightfast.windows(nfConfig, period, TZ);
  await checkin(
    userId,
    "nightfast",
    "declare",
    new Date((nfWindow.opensAt.getTime() + nfWindow.closesAt.getTime()) / 2),
    DAILY_SCHEDULE,
    { held: true },
  );

  // Office is deliberately not scheduled today (see seedAdminExtras), so
  // there is nothing of it to complete -- that is the point of the example.
}

// ---------------------------------------------------------------------------
// Fixture: no-money -- one group, money switched off
// ---------------------------------------------------------------------------

async function buildNoMoney(): Promise<void> {
  await wipe();
  await seedAllPeople();
  await insertDefaultTimezone();

  await createGroup(
    GROUP_NO_MONEY,
    "Quiet Ledger",
    "preview-admin",
    [
      { id: "preview-admin", role: "owner" },
      { id: "preview-alex", role: "member" },
    ],
    configFrom,
  );
  // moneyOn: false -- the owner's own toggle stays off, so this group shows
  // no balances anywhere however the app-wide default resolves.
  await acceptSleepWithFine(
    GROUP_NO_MONEY,
    ["preview-admin", "preview-alex"],
    5000,
    "INR",
    configFrom,
    false,
  );

  for (const uid of ["preview-admin", "preview-alex"]) {
    await trackType(uid, "sleep", SLEEP_SCHEDULE, DEFAULT_WINDOWS, configFrom);
    await seedSleepEvents(uid, DEFAULT_WINDOWS, HISTORY_DAYS, anchor);
  }
  await seedAdminExtras(new Set());

  await consentApproved(["preview-admin", "preview-alex"]);
  await runScoring();
}

// ---------------------------------------------------------------------------
// Fixture: new-user -- a genuinely empty account
// ---------------------------------------------------------------------------

async function buildNewUser(): Promise<void> {
  await wipe();
  await insertPerson(PEOPLE[0]); // preview-admin, approved, admin -- nothing else
  await consentApproved(["preview-admin"]);
  // No timezone row, no groups, no activities, no events: listUserActivities
  // and every group query return empty, and resolveUserTimezone falls back
  // to its hardcoded Asia/Kolkata default, which is exactly what a brand new
  // account gets in production too.
}

// ---------------------------------------------------------------------------
// Fixture: new-user-invite -- an empty account with an invite waiting
//
// The awkward first-run state, and the reason the redesigned empty Home keeps
// the catalog in view: accepting this invite while tracking nothing lands on
// the join screen with nothing to share.
// ---------------------------------------------------------------------------

async function buildNewUserInvite(): Promise<void> {
  await wipe();
  await insertPerson(PEOPLE[0]); // preview-admin, and nothing of their own
  await insertPerson(PEOPLE[3]); // preview-riya, who does the inviting
  await consentApproved(["preview-admin", "preview-riya"]);

  await createGroup(GROUP_NEW_USER_INVITE, "Night Owls", "preview-riya", [
    { id: "preview-riya", role: "owner" },
  ], configFrom);
  await db.insert(groupActivityTypes).values({
    groupId: GROUP_NEW_USER_INVITE,
    typeKey: "sleep",
    accepted: true,
    changedBy: "preview-riya",
  });
  await db.insert(groupInvites).values({
    id: INVITE_NEW_USER,
    groupId: GROUP_NEW_USER_INVITE,
    email: "preview@curfew.local",
    invitedBy: "preview-riya",
    status: "pending",
  });
}

// ---------------------------------------------------------------------------
// Fixture: notice-active -- a blocking, unacknowledged notice
// ---------------------------------------------------------------------------

async function buildNoticeActive(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // A real change, not an invented maintenance blurb: turn money off
  // app-wide and enable Screen, then compose the notice exactly the way
  // saveControls() does (consequences.ts's noticeFrom), so what a user reads
  // in the notice actually matches a real toggle in this seeded world rather
  // than a one-off string only the fixture knows about.
  const changedBy = "preview-admin";
  const effectiveAt = new Date();
  await db.insert(appSettings).values({ key: "money", value: false, changedBy, effectiveAt });
  await db.insert(activityTypes).values({ typeKey: "screen", enabled: true, changedBy, effectiveAt });

  const body = noticeFrom([
    settingConsequence("money", false),
    typeConsequence("Screen", true, 0),
  ]);

  // Inserted last, so its created_at is later than every user's (the notice
  // only applies to accounts that existed when it was published). Left
  // unacknowledged for preview-admin, which is what makes the gate show.
  await db.insert(notices).values({
    id: NOTICE_MAINTENANCE,
    body,
    createdBy: changedBy,
  });
}

// ---------------------------------------------------------------------------
// Fixtures: checkin-open-* -- a specific window open, unpressed, at a fixed
// clock instant the harness sets via the mock_now cookie.
//
// Why these anchor on a FIXED CALENDAR DATE rather than `anchor` (today):
// the harness needs a stable, reproducible instant to hardcode, and this
// machine's real clock is not necessarily anywhere near that date. Building
// the target type's config and history around that fixed date (rather than
// today) keeps the fixture correct regardless of when the seed script itself
// happens to run.
//
// Why the target type is added to userActivities/user_activity_config AFTER
// this script's own scoreAll() call, and never scored by this script at all:
// scoreAll() here runs under the REAL system clock (no request, no
// mock_now cookie -- see src/lib/clock.ts), which on this machine is far
// after the fixed target date. If the target type were tracked and scored
// now, scoreAll() would walk every period from its effective-from date all
// the way to today's real date and write activity_scores rows for all of
// them -- mostly misses, since no events exist in that gap. standingFor()
// reads every stored row for a type with no date filter, so those rows would
// wreck the streak the harness is trying to screenshot. Deferring the
// insert until after this script's scoreAll() call means the type is never
// scored here; the app's own lazy-close (standingFor -> scoreUser) computes
// it correctly on first read, using whatever mock_now the harness actually
// sets, because that call runs inside a request and picks up the cookie.
// ---------------------------------------------------------------------------

const CHECKIN_TARGET_DATE = "2026-01-15"; // the calendar date the fixed ids above assume

async function buildCheckinOpenSteps(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true, skipAdminTypes: new Set(["steps"]) });
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // Steps has no time-of-day window (ALL_DAY: the whole local calendar day),
  // so "open" just means "not yet checked in for today's period" and its
  // evidence is already optional by default -- no config change needed
  // there. 09:00:00.000Z on the target date is 14:30 IST, inside that day's
  // window, so the guessed instant is correct as given.
  const target = DateTime.fromISO(CHECKIN_TARGET_DATE, { zone: TZ });
  const effectiveFrom = target.minus({ days: 60 }).toFormat("yyyy-MM-dd");
  await trackType("preview-admin", "steps", DAILY_SCHEDULE, { target: 8000, direction: "atLeast" }, effectiveFrom);
  await seedStepsEvents("preview-admin", 20, target); // history up to, not including, the target day
}

async function buildCheckinOpenSleepConfirm(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true, skipAdminSleep: true });
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // Confirm's window is on the morning AFTER the period it belongs to
  // (sleep.ts: instantWithin treats an hour < 12 as the following day), so for
  // it to land on the target calendar date, P is the day BEFORE it.
  //
  // It is not a clock time any more (item 17). It opens half an hour after the
  // WAKE press and stays open half an hour, so the press is what places it,
  // and this fixture places the press rather than guessing an instant:
  //
  //   period P    = 2026-01-14
  //   wake press  = 2026-01-15 06:52 IST
  //   confirm     = 2026-01-15 07:22 to 07:52 IST
  //               = 2026-01-15T01:52Z to 02:22Z
  //
  // The harness clock is 2026-01-15T02:07:00.000Z, 07:37 IST, in the middle of
  // it. 09:00:00.000Z, which is what the harness guesses by default, is 14:30
  // IST and nowhere near.
  const P = DateTime.fromISO(CHECKIN_TARGET_DATE, { zone: TZ }).minus({ days: 1 });
  const effectiveFrom = P.minus({ days: 60 }).toFormat("yyyy-MM-dd");
  await trackType("preview-admin", "sleep", SLEEP_SCHEDULE, DEFAULT_WINDOWS, effectiveFrom);

  // History before P, ordinary pattern.
  for (let i = 20; i >= 1; i--) {
    const period = P.minus({ days: i }).toFormat("yyyy-MM-dd");
    for (const { step, at } of sleepPresses(DEFAULT_WINDOWS, period, [
      "night",
      "wake",
      "confirm",
    ])) {
      await checkin("preview-admin", "sleep", step, at, SLEEP_SCHEDULE, {});
    }
  }
  // Period P itself: night and wake done, confirm deliberately left open. The
  // wake press is placed at 06:52 so the half hour it opens covers the instant
  // the harness freezes the clock at, worked out above.
  const periodP = P.toFormat("yyyy-MM-dd");
  const wakeAt = DateTime.fromISO(CHECKIN_TARGET_DATE, { zone: TZ })
    .set({ hour: 6, minute: 52 })
    .toJSDate();
  for (const { step, at } of sleepPresses(DEFAULT_WINDOWS, periodP, ["night", "wake"], {
    wakeAt,
  })) {
    await checkin("preview-admin", "sleep", step, at, SLEEP_SCHEDULE, {});
  }
}

/**
 * Fixture: checkin-open-food -- the photo-slot screen, still.
 *
 * Sleep's confirm used to stand in for "photo required, Send dead until you
 * attach one". It cannot any more: a step that asks for a photo and nothing
 * else opens the camera directly now, with no slot and no Send. Food still has
 * the slot, because it asks for a number as well, and the two boards were
 * drawn as Food all along.
 *
 * Two meals on the target day totalling 1180 calories, which is the number the
 * artboards print under the field.
 */
async function buildCheckinOpenFood(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // Food's window is the whole local day, so any instant inside the target
  // date works. The harness is given 15:34:00.000Z, which is 9:04 PM IST and
  // matches the time printed on the artboards.
  const target = DateTime.fromISO(CHECKIN_TARGET_DATE, { zone: TZ });
  const effectiveFrom = target.minus({ days: 60 }).toFormat("yyyy-MM-dd");
  const config = { meals: 3, calorieLimit: 2000 };
  await trackType("preview-admin", "food", DAILY_SCHEDULE, config, effectiveFrom);

  // History up to, not including, the target day.
  for (let i = 20; i >= 1; i--) {
    const day = target.minus({ days: i });
    if (i % 7 === 0) continue; // an occasional day nobody logged
    const meals = i % 5 === 0 ? [520, 610] : [430, 520, 640];
    for (const [n, calories] of meals.entries()) {
      const at = day.set({ hour: 8 + n * 5 }).toJSDate();
      const period = periodStart(at, TZ, { unit: "day", boundary: "midnight" });
      const key = await addEvidence("preview-admin", "food", "meal", period, at);
      await checkin("preview-admin", "food", "meal", at, DAILY_SCHEDULE, { calories }, key);
    }
  }

  // The target day itself: two meals in, the third still to log.
  for (const [n, calories] of [560, 620].entries()) {
    const at = target.set({ hour: 8 + n * 5 }).toJSDate();
    const period = periodStart(at, TZ, { unit: "day", boundary: "midnight" });
    const key = await addEvidence("preview-admin", "food", "meal", period, at);
    await checkin("preview-admin", "food", "meal", at, DAILY_SCHEDULE, { calories }, key);
  }
}

/**
 * Fixture: pending-approval -- the waiting room.
 *
 * /pending redirects to Home the moment an account is approved, so the only
 * way to photograph it is to have the signed-in user be unapproved. Local mode
 * always signs in as preview-admin, so this is that same account with its
 * approval set back to pending. Nothing else changes: the point of the screen
 * is that nothing else is reachable.
 *
 * /signin needs no fixture of its own. It checks no session and renders for
 * anybody, which is what a sign-in screen is.
 */
async function buildPendingApproval(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await runScoring();
  await db
    .update(userApprovals)
    .set({ status: "pending", decidedAt: null, decidedBy: null })
    .where(eq(userApprovals.userId, "preview-admin"));
}

async function buildCheckinOpenSugarfree(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true }); // sugarfree is untracked by default; nothing to skip
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // Sugarfree's window is 20:00-23:59 IST on the SAME day as the period
  // (midnight boundary, no cutoff): 2026-01-15T20:00 IST to 23:59 IST, which
  // is 2026-01-15T14:30Z to 2026-01-15T18:29Z. 09:00:00.000Z (14:30 IST) is
  // well before that window opens, so the guessed instant does not work.
  // The correct instant to give the harness is 2026-01-15T16:00:00.000Z.
  const target = DateTime.fromISO(CHECKIN_TARGET_DATE, { zone: TZ });
  const effectiveFrom = target.minus({ days: 60 }).toFormat("yyyy-MM-dd");
  const config = { window: { open: "20:00", close: "23:59" }, cutoff: null };
  await trackType("preview-admin", "sugarfree", DAILY_SCHEDULE, config, effectiveFrom);
  await seedSugarfreeEvents("preview-admin", 10, target); // history up to, not including, the target day
}

// ---------------------------------------------------------------------------
// Fixtures: invite-tracked-type / invite-untracked-type
// ---------------------------------------------------------------------------

async function buildInviteTracked(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // A mix, matching the mock (V3JoinShare.dc.html): two types preview-admin
  // already tracks (gym, steps -- pure share toggles) and one they do not
  // (food -- offers inline "Set it up first" instead of a toggle).
  await createGroup(GROUP_INVITE_TRACKED, "Iron Circle", "preview-alex", [
    { id: "preview-alex", role: "owner" },
  ], configFrom);
  await db.insert(groupActivityTypes).values([
    { groupId: GROUP_INVITE_TRACKED, typeKey: "gym", accepted: true, changedBy: "preview-alex" },
    { groupId: GROUP_INVITE_TRACKED, typeKey: "steps", accepted: true, changedBy: "preview-alex" },
    { groupId: GROUP_INVITE_TRACKED, typeKey: "food", accepted: true, changedBy: "preview-alex" },
  ]);
  await db.insert(groupInvites).values({
    id: INVITE_TRACKED,
    groupId: GROUP_INVITE_TRACKED,
    email: "preview@curfew.local",
    invitedBy: "preview-alex",
    status: "pending",
  });
}

async function buildInviteUntracked(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();

  // Reading is untracked for preview-admin in the default world, so the join
  // screen offers inline setup for it.
  await createGroup(GROUP_INVITE_UNTRACKED, "Page Turners", "preview-sam", [
    { id: "preview-sam", role: "owner" },
  ], configFrom);
  await db.insert(groupActivityTypes).values({
    groupId: GROUP_INVITE_UNTRACKED,
    typeKey: "reading",
    accepted: true,
    changedBy: "preview-sam",
  });
  await db.insert(groupInvites).values({
    id: INVITE_UNTRACKED,
    groupId: GROUP_INVITE_UNTRACKED,
    email: "preview@curfew.local",
    invitedBy: "preview-sam",
    status: "pending",
  });
}

// ---------------------------------------------------------------------------
// Fixture: paused -- a trip already running
// ---------------------------------------------------------------------------

/**
 * Two people away, mid-pause, on a world that otherwise has full history.
 *
 * Written straight into `user_pauses` rather than declared through
 * `declarePause`, which refuses anything starting today or earlier: the app is
 * right to refuse that and a fixture needs exactly it, because every screen
 * worth reviewing is one you can only see from INSIDE a pause. Two people so
 * the group boards have somebody who is not you.
 */
async function buildPaused(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await seedTodayPartial();
  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));

  for (const userId of ["preview-admin", "preview-sam"]) {
    await db.insert(userPauses).values({
      pauseId: crypto.randomUUID(),
      userId,
      startsOn: anchor.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
      endsOn: anchor.plus({ days: 3 }).toFormat("yyyy-MM-dd"),
      declaredAt: anchor.minus({ days: 4 }).toJSDate(),
    });
  }

  // After the pauses exist, so the scoring pass marks those periods paused.
  await runScoring();
}

// ---------------------------------------------------------------------------
// Fixture: grace -- a group that has not started counting you yet
// ---------------------------------------------------------------------------

/**
 * A group joined TODAY, so its grace period is live (decision 123).
 *
 * The default world's groups were all joined months ago, so the three grace
 * boards had nothing to be captured against. This adds one more group on top
 * of that world rather than replacing it, because the point of the Home board
 * is a member who is in grace SOMEWHERE while the rest of their day carries on.
 */
async function buildGrace(): Promise<void> {
  await wipe();
  await assembleDefaultWorld({ moneyOn: true });
  await seedTodayPartial();

  const today = anchor.toFormat("yyyy-MM-dd");
  await createGroup(
    GROUP_GRACE,
    "New Term",
    "preview-admin",
    [
      { id: "preview-admin", role: "owner" },
      { id: "preview-riya", role: "member" },
    ],
    today,
  );
  // The rule is dated from the same day the group is: a fine rule effective
  // later than the period being judged resolves to nothing at all.
  await acceptSleepWithFine(GROUP_GRACE, ["preview-admin", "preview-riya"], 5000, "INR", today, true);

  await consentApproved(PEOPLE.filter((p) => p.status !== "pending").map((p) => p.id));
  await runScoring();
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const BUILDERS: Record<string, () => Promise<void>> = {
  paused: buildPaused,
  grace: buildGrace,
  default: buildDefault,
  "all-done": buildAllDone,
  "no-money": buildNoMoney,
  "new-user": buildNewUser,
  "new-user-invite": buildNewUserInvite,
  "notice-active": buildNoticeActive,
  // Admin screens are covered by the default world (preview-admin is already
  // an admin, Pat is pending, Dana is disabled, and there is real scored
  // history for Insights/Ops to show). Alias rather than duplicate.
  admin: buildDefault,
  "checkin-open-steps": buildCheckinOpenSteps,
  "checkin-open-sleep-confirm": buildCheckinOpenSleepConfirm,
  "checkin-open-food": buildCheckinOpenFood,
  "pending-approval": buildPendingApproval,
  "checkin-open-sugarfree": buildCheckinOpenSugarfree,
  "invite-tracked-type": buildInviteTracked,
  "invite-untracked-type": buildInviteUntracked,
};

function fixtureArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--fixture="));
  return arg ? arg.slice("--fixture=".length) : "default";
}

// activity_types ships every type disabled (decision 63) — correct in
// production, where an admin turns each one on deliberately, but useless for
// local testing where every screen needs all twelve reachable. wipe()'s
// TRUNCATE never names this table directly, but activity_types.changed_by
// references users.id, and TRUNCATE ... CASCADE on users pulls in every table
// with a foreign key to it -- so wipe() empties activity_types as a side
// effect regardless. Must run AFTER builder() (which calls wipe()), never
// before, or the cascade wipes out what this just inserted.
async function ensureTypesEnabled(): Promise<void> {
  const existing = await db.select().from(activityTypes);
  const enabled = new Set(existing.filter((r) => r.enabled).map((r) => r.typeKey));
  for (const key of registeredKeys()) {
    if (!enabled.has(key)) {
      await db.insert(activityTypes).values({ typeKey: key, enabled: true });
    }
  }
}

/**
 * Send the seeded photographs to the groups that were being shown them.
 *
 * A real photograph is tagged with its groups by the check-in that sends it
 * (item 15, migration 0024), and the fixture writes its evidence rows straight
 * into the table without going through one. Without this pass the group
 * evidence tab is empty against a fixture built to fill it, which reads as the
 * leak fix having broken the feature.
 *
 * Resolved at each photograph's OWN instant, which is what the press does, so
 * a fixture that changes somebody's sharing part way through a history gets
 * the same answer the app would have given at the time.
 */
async function tagSeededEvidence(): Promise<number> {
  const rows = await db
    .select({
      id: evidence.id,
      userId: evidence.userId,
      typeKey: evidence.typeKey,
      confirmedAt: evidence.confirmedAt,
    })
    .from(evidence);

  let tagged = 0;
  for (const r of rows) {
    if (!r.confirmedAt) continue;
    const groupIds = await groupsSeeingEvidence(r.userId, r.typeKey, r.confirmedAt);
    if (groupIds.length === 0) continue;
    await tagEvidence(r.id, groupIds, r.confirmedAt);
    tagged += 1;
  }
  return tagged;
}

async function main() {
  const fixture = fixtureArg();
  const builder = BUILDERS[fixture];
  if (!builder) {
    console.error(`Unknown fixture "${fixture}". Known: ${Object.keys(BUILDERS).join(", ")}`);
    process.exit(1);
  }
  console.log(`seeding fixture: ${fixture}`);
  await builder();
  await ensureTypesEnabled();
  const tagged = await tagSeededEvidence();
  if (tagged > 0) console.log(`${tagged} photographs sent to their groups`);
  // Leave a note of which world is in the database. The drift harness reads it
  // and refuses to photograph a screen that needs a different one: running
  // shots.ts directly instead of run-all.mjs used to capture those against
  // whatever happened to be seeded, and produce a confident "No such page".
  //
  // `day` is the calendar day this fixture calls TODAY, and the browser suite
  // refuses to run against a stale one. Every fixture that anchors on the real
  // clock puts its "today" events on `anchor`, so once the member's zone rolls
  // past midnight the whole fixture is describing yesterday: the water row
  // reads "0 of 8 today" and the suite fails saying a finished counter is not
  // finished, which is true and has nothing to do with the code. Seeding at
  // 11:59 PM and running at 12:01 AM is all it takes, and CI crosses that line
  // at 18:30 UTC every day.
  await writeFile(
    path.join(process.cwd(), "scripts", "drift", ".seeded.json"),
    JSON.stringify(
      { fixture, at: new Date().toISOString(), day: anchor.toFormat("yyyy-MM-dd"), tz: TZ },
      null,
      2,
    ) + "\n",
  );
  console.log(`fixture "${fixture}" seeded`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
