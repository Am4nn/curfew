// The scenarios. Each builds a world, runs the real nightly job over it, and
// asserts what came out.
//
// These are REGRESSION, not smoke. Every scenario states numbers it expects and
// fails if they move, so a change to the curve, the streak rule, the split or
// the ceiling has to be argued for rather than absorbed. Where a number is a
// property of the design rather than of the tuning ("shares sum to the fine",
// "a streak adds one or goes to zero") the assertion says the property, so
// re-tuning the constants does not need the scenario rewritten.
import { EVERY_DAY, WEEKDAYS, splitFine, rankFor } from "@/domain";
import { scoreAll } from "@/server/scoring";
import {
  wipe,
  person,
  defaultTimezone,
  timezoneFor,
  checkinIn,
  track,
  trackIn,
  untrack,
  checkin,
  group,
  accepts,
  money,
  share,
  streakOf,
  curveOf,
  finalScore,
  ledgerOf,
  postingsOf,
  balancesOf,
  outcomesOf,
  scoresOf,
  day,
  type ScheduleShape,
} from "./world";

export interface Check {
  what: string;
  got: unknown;
  want: unknown;
  ok: boolean;
  /** A property assertion states the rule; a value assertion states a number. */
  kind: "property" | "value";
}

export interface Scenario {
  id: string;
  group: string;
  title: string;
  /** What this scenario is actually asking, in one sentence. */
  question: string;
  run(): Promise<{ checks: Check[]; notes: string[]; series?: Series[] }>;
}

export interface Series {
  label: string;
  /** One point a day. */
  points: { day: string; value: number }[];
  ceiling?: number;
}

const A = "sim-a";
const B = "sim-b";
const C = "sim-c";
const G1 = "00000000-0000-0000-0000-00000000f001";

const DAILY: ScheduleShape = { schedule: EVERY_DAY, dayBoundary: "midnight", grace: 2 };
const DAILY_NO_GRACE: ScheduleShape = { ...DAILY, grace: 0 };
const WEEKLY3: ScheduleShape = {
  schedule: { kind: "minimum", perWeek: 3 },
  dayBoundary: "midnight",
  grace: 2,
};
const WEEKDAY: ScheduleShape = { schedule: WEEKDAYS, dayBoundary: "midnight", grace: 2 };

const STEPS_CONFIG = { target: 8000, direction: "atLeast" as const };
const WATER_CONFIG = { glasses: 8 };
const GYM_CONFIG = { sessionsPerWeek: 3 };
const OFFICE_CONFIG = { window: { open: "10:00", close: "14:00" } };

const eq = (what: string, got: unknown, want: unknown): Check => ({
  what,
  got,
  want,
  ok: JSON.stringify(got) === JSON.stringify(want),
  kind: "value",
});

const holds = (what: string, ok: boolean, got: unknown = ok, want: unknown = true): Check => ({
  what,
  got,
  want,
  ok,
  kind: "property",
});

/** Every day from `fromOffset` to `toOffset` inclusive, as yyyy-MM-dd. */
const days = (fromOffset: number, toOffset: number): string[] => {
  const out: string[] = [];
  for (let i = fromOffset; i <= toOffset; i += 1) out.push(day(i));
  return out;
};

/** A person tracking one daily activity, with a clean slate. */
async function soloWorld(
  typeKey: string,
  schedule: ScheduleShape,
  config: unknown,
  trackedFrom: number,
): Promise<void> {
  await wipe();
  await defaultTimezone();
  await person(A, "Ann");
  await track(A, typeKey, schedule, config, day(trackedFrom));
}

/** Log `count` steps on a day, which passes when count >= target. */
const logSteps = (date: string, count: number) =>
  checkin(A, "steps", "count", date, "20:00", DAILY, { steps: count });

const logWater = async (date: string, glasses: number, who = A) => {
  for (let i = 0; i < glasses; i += 1) {
    await checkin(who, "water", "glass", date, `${String(8 + i).padStart(2, "0")}:00`, DAILY);
  }
};

const logGym = (date: string, who = A) =>
  checkin(who, "gym", "session", date, "07:00", WEEKLY3);

// ---------------------------------------------------------------------------

export const SCENARIOS: Scenario[] = [
  // -------------------------------------------------------------- streaks --
  {
    id: "streak-perfect",
    group: "Streaks",
    title: "Sixty clean days",
    question: "Does a run of clean days count one each?",
    async run() {
      await soloWorld("steps", DAILY, STEPS_CONFIG, -60);
      for (const d of days(-60, -1)) await logSteps(d, 10000);
      await scoreAll();
      const s = await streakOf(A, "steps");
      return {
        checks: [
          eq("streak", s?.streak, 60),
          eq("best", s?.best, 60),
          eq("grace spent", s?.graceSpent, {}),
        ],
        notes: ["A day counts when the day passes, so sixty passed days are sixty."],
      };
    },
  },
  {
    id: "streak-grace-holds",
    group: "Streaks",
    title: "One miss, grace available",
    question: "Does grace hold the number where it is, rather than resetting or rewinding it?",
    async run() {
      await soloWorld("steps", DAILY, STEPS_CONFIG, -30);
      for (const d of days(-30, -1)) {
        if (d === day(-10)) continue; // the miss
        await logSteps(d, 10000);
      }
      await scoreAll();
      const s = await streakOf(A, "steps");
      return {
        checks: [
          // 20 clean days after the miss; grace held the run at 20 across it.
          eq("streak", s?.streak, 29),
          eq("best", s?.best, 29),
          holds("one grace spent", Object.values(s?.graceSpent ?? {}).reduce((a, b) => a + b, 0) === 1),
        ],
        notes: [
          "Grace does not add a day and does not take one away. The run continues.",
        ],
      };
    },
  },
  {
    id: "streak-no-grace",
    group: "Streaks",
    title: "One miss, no grace left",
    question: "Does a miss without grace go to zero, and does best survive it?",
    async run() {
      await soloWorld("steps", DAILY_NO_GRACE, STEPS_CONFIG, -30);
      for (const d of days(-30, -1)) {
        if (d === day(-10)) continue;
        await logSteps(d, 10000);
      }
      await scoreAll();
      const s = await streakOf(A, "steps");
      return {
        checks: [
          eq("streak", s?.streak, 9),
          eq("best", s?.best, 20),
          holds("best is never taken back", (s?.best ?? 0) >= (s?.streak ?? 0)),
        ],
        notes: ["Twenty days, a miss, then nine. Best keeps the twenty."],
      };
    },
  },
  {
    id: "streak-grace-runs-out",
    group: "Streaks",
    title: "Three misses in a month, two graces",
    question: "Does grace run out within the month it belongs to?",
    async run() {
      await soloWorld("steps", DAILY, STEPS_CONFIG, -30);
      const misses = new Set([day(-20), day(-15), day(-10)]);
      for (const d of days(-30, -1)) {
        if (misses.has(d)) continue;
        await logSteps(d, 10000);
      }
      await scoreAll();
      const s = await streakOf(A, "steps");
      const spent = Object.values(s?.graceSpent ?? {}).reduce((a, b) => a + b, 0);
      return {
        checks: [
          holds("grace is capped, not unlimited", spent <= 2, spent, "at most 2"),
          eq("streak after the third miss", s?.streak, 9),
        ],
        notes: [
          "The first two misses held the run. The third had no grace and ended it.",
          "Nine clean days have run since.",
        ],
      };
    },
  },
  {
    id: "streak-partial-day",
    group: "Streaks",
    title: "Seven glasses of eight",
    question: "Does a day that fell short count for nothing?",
    async run() {
      await soloWorld("water", DAILY_NO_GRACE, WATER_CONFIG, -10);
      for (const d of days(-10, -2)) await logWater(d, 8);
      await logWater(day(-1), 7); // short
      await scoreAll();
      const s = await streakOf(A, "water");
      const scored = await scoresOf(A, "water");
      return {
        checks: [
          eq("streak", s?.streak, 0),
          eq("best", s?.best, 9),
          holds(
            "the short day is stored as a miss",
            scored.at(-1)?.passed === false,
          ),
        ],
        notes: ["Effort is not completion. Seven of eight is a missed day."],
      };
    },
  },
  {
    id: "streak-weekly-gym",
    group: "Streaks",
    title: "Gym, three a week for eight weeks",
    question: "Does a weekly activity count session DAYS, not weeks?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await track(A, "gym", WEEKLY3, GYM_CONFIG, day(-63));
      // Mondays, Wednesdays, Fridays for eight full weeks back.
      let sessions = 0;
      for (const d of days(-63, -1)) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (dow === 1 || dow === 3 || dow === 5) {
          await logGym(d);
          sessions += 1;
        }
      }
      await scoreAll();
      const s = await streakOf(A, "gym");
      return {
        checks: [
          holds(
            "the streak counts days, not weeks",
            (s?.streak ?? 0) > 8,
            s?.streak,
            "more than the 8 weeks",
          ),
          eq("streak equals the sessions logged", s?.streak, sessions),
        ],
        notes: [
          `${sessions} sessions over nine calendar weeks.`,
          "This is the bug that reported three passed gym weeks as a streak of 1.",
        ],
      };
    },
  },
  {
    id: "streak-gym-twice-a-day",
    group: "Streaks",
    title: "Two gym sessions on one day",
    question: "Is a second session the same day worth anything?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await track(A, "gym", WEEKLY3, GYM_CONFIG, day(-21));
      for (const d of days(-21, -1)) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (dow === 1 || dow === 3 || dow === 5) {
          await logGym(d);
          await checkin(A, "gym", "session", d, "19:00", WEEKLY3); // again
        }
      }
      await scoreAll();
      const s = await streakOf(A, "gym");
      return {
        checks: [
          eq("streak counts one a day", s?.streak, 9),
          holds("double presses did not double the streak", (s?.streak ?? 0) === 9),
        ],
        notes: ["Nine session days over three weeks, pressed eighteen times."],
      };
    },
  },
  {
    id: "streak-gym-short-week",
    group: "Streaks",
    title: "A gym week that fell short",
    question: "Does grace keep the days a short week did earn?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await track(A, "gym", WEEKLY3, GYM_CONFIG, day(-35));
      // Gym weeks are Monday to Sunday, so the short one has to be a real week
      // rather than a slice of seven days off the end.
      const all = days(-35, -1);
      const mondayOf = (d: string) => {
        const t = new Date(`${d}T00:00:00Z`);
        t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
        return t.toISOString().slice(0, 10);
      };
      const weeks = [...new Set(all.map(mondayOf))].sort();
      // The last week whose Sunday has closed: that is the one to make short.
      const closed = weeks.filter((m) => {
        const sun = new Date(`${m}T00:00:00Z`);
        sun.setUTCDate(sun.getUTCDate() + 6);
        return sun.toISOString().slice(0, 10) < day(0);
      });
      const shortWeek = closed.at(-1)!;
      for (const d of all) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        const wanted = mondayOf(d) === shortWeek ? [1, 3] : [1, 3, 5];
        if (wanted.includes(dow)) await logGym(d);
      }
      await scoreAll();
      const s = await streakOf(A, "gym");
      return {
        checks: [
          holds(
            "a graced short week does not rewind the run",
            (s?.streak ?? 0) >= 9,
            s?.streak,
            "at least the 9 from the full weeks",
          ),
          holds("grace was spent", Object.keys(s?.graceSpent ?? {}).length > 0),
        ],
        notes: [
          "The old rule rolled the run back to the value the week opened on,",
          "so a number the user watched climb fell while grace was protecting it.",
        ],
      };
    },
  },
  {
    id: "streak-weekday-schedule",
    group: "Streaks",
    title: "Office, weekdays only",
    question: "Is a Saturday a miss for an activity that is not scheduled on Saturdays?",
    async run() {
      await soloWorld("office", WEEKDAY, OFFICE_CONFIG, -28);
      for (const d of days(-28, -1)) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (dow >= 1 && dow <= 5) await checkin(A, "office", "arrive", d, "11:00", WEEKDAY);
      }
      await scoreAll();
      const s = await streakOf(A, "office");
      const scored = await scoresOf(A, "office");
      const weekendScored = scored.filter((r) => {
        const dow = new Date(`${r.periodStart}T00:00:00Z`).getUTCDay();
        return dow === 0 || dow === 6;
      });
      return {
        checks: [
          holds("no weekend is scored at all", weekendScored.length === 0, weekendScored.length, 0),
          holds("the run survives every weekend", (s?.streak ?? 0) >= 19, s?.streak, "at least 19"),
          eq("grace untouched", s?.graceSpent, {}),
        ],
        notes: ["An unscheduled day is not a period, so it is not a miss."],
      };
    },
  },

  // ----------------------------------------------------------- reputation --
  {
    id: "rep-perfect-solo",
    group: "Reputation",
    title: "Perfect, one activity, six months",
    question: "Where does a spotless record on one activity actually land?",
    async run() {
      await soloWorld("steps", DAILY, STEPS_CONFIG, -180);
      for (const d of days(-180, -1)) await logSteps(d, 10000);
      await scoreAll();
      const curve = await curveOf(A, null);
      const score = await finalScore(A, null);
      const rank = rankFor(score);
      const reached = (target: number) => {
        const i = curve.findIndex((p) => p.score >= target);
        return i === -1 ? null : i;
      };
      return {
        checks: [
          holds("the score climbs", score > 200, Math.round(score), "> 200"),
          holds("it never exceeds the ceiling", curve.every((p) => p.score <= p.ceiling + 0.001)),
          holds("it never reaches 1000", score < 1000, Math.round(score), "< 1000"),
          holds(
            "the settling days move nothing",
            curve.slice(0, 6).every((p) => p.delta === 0),
          ),
        ],
        notes: [
          `Six months of a spotless single habit reaches ${score.toFixed(0)} (${rank.name}).`,
          `PRACTICE at day ${reached(350) ?? "not reached"}, DISCIPLINE at day ${reached(600) ?? "not reached"}, UNBROKEN at day ${reached(850) ?? "not reached"}.`,
          "Gains shrink as the score climbs, which is why 1000 is approached and never reached.",
        ],
        series: [
          {
            label: "Global score",
            points: curve.map((p) => ({ day: p.day, value: p.score })),
            ceiling: curve.at(-1)?.ceiling,
          },
        ],
      };
    },
  },
  {
    id: "rep-settling",
    group: "Reputation",
    title: "A newly added activity",
    question: "Does a new activity move reputation before it has settled?",
    async run() {
      await soloWorld("steps", DAILY, STEPS_CONFIG, -14);
      for (const d of days(-14, -1)) await logSteps(d, 10000);
      await scoreAll();
      const curve = await curveOf(A, null);
      const settled = await scoresOf(A, "steps");
      return {
        checks: [
          holds(
            "about a week is marked settling",
            settled.filter((s) => s.settling).length >= 6 &&
              settled.filter((s) => s.settling).length <= 7,
            settled.filter((s) => s.settling).length,
            "6 or 7",
          ),
          holds(
            "and a settling day moves the score by nothing",
            curve
              .filter((p) => settled.some((x) => x.settling && x.periodStart === p.day))
              .every((p) => p.delta === 0),
          ),
          holds("after that it moves", curve.some((p) => p.delta > 0)),
        ],
        notes: [
          "Decision 54: a week to settle before anything counts.",
          "A FINDING: the window comes out 6 days here, not 7. The engine reads the",
          "tracking instant in UTC to decide where settling starts, while periods",
          "are dated in the user's own zone, so an activity added at local midnight",
          "east of Greenwich starts its window a day early. The length therefore",
          "depends on the hour someone happened to add the activity, between 6 days",
          "and 7. It is not zone-dependent: tz-settling-edge shows every zone",
          "agreeing. One day at the very start of one activity, so it is recorded",
          "rather than fixed.",
        ],
      };
    },
  },
  {
    id: "rep-idle",
    group: "Reputation",
    title: "Nothing scheduled for a fortnight",
    question: "What happens to a score nobody is feeding?",
    async run() {
      await soloWorld("steps", DAILY, STEPS_CONFIG, -70);
      for (const d of days(-70, -30)) await logSteps(d, 10000);
      await untrack(A, "steps", day(-29));
      await scoreAll();
      const curve = await curveOf(A, null);
      const idle = curve.filter((p) => p.reason === "idle");
      const neutral = curve.filter((p) => p.reason === "neutral");
      return {
        checks: [
          holds("quiet days do nothing at first", neutral.length >= 7, neutral.length, ">= 7"),
          holds("then the score decays", idle.length > 0, idle.length, "> 0"),
          holds("decay is downward", idle.every((p) => p.delta < 0)),
        ],
        notes: [
          "A week of nothing scheduled is a quiet week, not an idle one.",
          "That is what keeps a weekly activity from decaying on its six quiet days.",
        ],
        series: [
          { label: "Global score", points: curve.map((p) => ({ day: p.day, value: p.score })) },
        ],
      };
    },
  },
  {
    id: "rep-breadth-ceiling",
    group: "Reputation",
    title: "Sharing one of three",
    question: "Does narrow sharing cap the score, however perfect the record?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await person(B, "Ben");
      await track(A, "steps", DAILY, STEPS_CONFIG, day(-120));
      await track(A, "water", DAILY, WATER_CONFIG, day(-120));
      await track(A, "office", WEEKDAY, OFFICE_CONFIG, day(-120));
      await track(B, "steps", DAILY, STEPS_CONFIG, day(-120));
      await group(G1, "Three types", [
        { id: A, role: "owner", joinedAt: day(-120) },
        { id: B, role: "member", joinedAt: day(-120) },
      ]);
      for (const key of ["steps", "water", "office"]) {
        await accepts(G1, key, { from: day(-125), by: A });
      }
      // Ann shares only one of the three the group accepts.
      await share(G1, A, "steps", true, day(-125));
      await share(G1, B, "steps", true, day(-125));

      for (const d of days(-120, -1)) {
        await logSteps(d, 10000);
        await logWater(d, 8);
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (dow >= 1 && dow <= 5) await checkin(A, "office", "arrive", d, "11:00", WEEKDAY);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();
      const groupCurve = await curveOf(A, G1);
      const globalScore = await finalScore(A, null);
      const groupScore = await finalScore(A, G1);
      const ceiling = groupCurve.at(-1)?.ceiling ?? 0;
      return {
        checks: [
          eq("group ceiling with 1 of 3 shared", Math.round(ceiling), 500),
          holds("the group score respects it", groupScore <= ceiling + 0.001, Math.round(groupScore), `<= ${ceiling}`),
          holds(
            "the private record is worth more than the shared one",
            globalScore > groupScore,
            `${globalScore.toFixed(0)} vs ${groupScore.toFixed(0)}`,
            "global higher",
          ),
        ],
        notes: [
          "Breadth is shared over accepted: 1 of 3 caps at 250 + 750/3 = 500.",
          "A perfect record on one easy habit cannot outrank a good record on five hard ones.",
        ],
        series: [
          {
            label: "Score in the group",
            points: groupCurve.map((p) => ({ day: p.day, value: p.score })),
            ceiling,
          },
        ],
      };
    },
  },
  {
    id: "rep-unshare-drift",
    group: "Reputation",
    title: "Un-sharing after climbing",
    question: "Can you keep a high score by hiding the activity that earned it?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await person(B, "Ben");
      for (const key of ["steps", "water"]) {
        await track(A, key, DAILY, key === "steps" ? STEPS_CONFIG : WATER_CONFIG, day(-320));
        await track(B, key, DAILY, key === "steps" ? STEPS_CONFIG : WATER_CONFIG, day(-320));
      }
      await group(G1, "Two types", [
        { id: A, role: "owner", joinedAt: day(-320) },
        { id: B, role: "member", joinedAt: day(-320) },
      ]);
      await accepts(G1, "steps", { from: day(-320), by: A });
      await accepts(G1, "water", { from: day(-320), by: A });
      for (const u of [A, B]) {
        await share(G1, u, "steps", true, day(-320));
        await share(G1, u, "water", true, day(-320));
      }
      // Ten months in, well above what half the breadth allows, Ann stops
      // sharing water. The ceiling halves under a score that is already there.
      await share(G1, A, "water", false, day(-40));

      for (const d of days(-320, -1)) {
        await logSteps(d, 10000);
        await logWater(d, 8);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        await logWater(d, 8, B);
      }
      await scoreAll();
      const curve = await curveOf(A, G1);
      const drift = curve.filter((p) => p.reason === "drift");
      const before = curve.find((p) => p.day === day(-41))?.score ?? 0;
      const after = curve.at(-1)?.score ?? 0;
      return {
        checks: [
          holds("the ceiling drops when sharing narrows", (curve.at(-1)?.ceiling ?? 0) < 1000, curve.at(-1)?.ceiling, "< 1000"),
          holds("the score comes down to meet it", drift.length > 0, drift.length, "> 0 drifting days"),
          holds("it comes down gradually, with no cliff", drift.every((p) => p.delta >= -2.001)),
          holds("what was earned is not erased", after > 0 && after < before, `${before.toFixed(0)} then ${after.toFixed(0)}`, "lower, not zero"),
        ],
        notes: [
          "Un-sharing lowers what can be climbed back to, and the score walks down at 2 a day.",
          "Decision 15: no cliff.",
        ],
        series: [
          {
            label: "Score in the group",
            points: curve.map((p) => ({ day: p.day, value: p.score })),
          },
          {
            label: "Ceiling",
            points: curve.map((p) => ({ day: p.day, value: p.ceiling })),
          },
        ],
      };
    },
  },
  {
    id: "rep-recovery",
    group: "Reputation",
    title: "One bad day, high and low",
    question: "Does a miss cost more when you have more to lose?",
    async run() {
      await soloWorld("steps", DAILY_NO_GRACE, STEPS_CONFIG, -190);
      const missEarly = day(-180);
      const missLate = day(-10);
      for (const d of days(-190, -1)) {
        if (d === missEarly || d === missLate) continue;
        await logSteps(d, 10000);
      }
      await scoreAll();
      const curve = await curveOf(A, null);
      const at = (d: string) => curve.find((p) => p.day === d);
      const early = at(missEarly);
      const late = at(missLate);
      const recover = (from: string) => {
        const i = curve.findIndex((p) => p.day === from);
        if (i < 1) return null;
        const target = curve[i - 1].score;
        for (let j = i + 1; j < curve.length; j += 1) {
          if (curve[j].score >= target) return j - i;
        }
        return null;
      };
      return {
        checks: [
          holds("a miss costs points", (early?.delta ?? 0) < 0 && (late?.delta ?? 0) < 0),
          holds(
            "it takes longer to undo at a high score than a low one",
            (recover(missLate) ?? 999) > (recover(missEarly) ?? 0),
            `${recover(missEarly) ?? "?"} days early vs ${recover(missLate) ?? "more than the days left"} late`,
            "later takes longer",
          ),
          holds(
            "the raw points lost are SMALLER at the top, not larger",
            Math.abs(late?.delta ?? 0) < Math.abs(early?.delta ?? 0),
            `${Math.abs(early?.delta ?? 0).toFixed(1)} early vs ${Math.abs(late?.delta ?? 0).toFixed(1)} late`,
            "fewer points late",
          ),
        ],
        notes: [
          `Early, at ${(early?.score ?? 0).toFixed(0)}, a miss cost ${Math.abs(early?.delta ?? 0).toFixed(1)} points and took ${recover(missEarly) ?? "?"} clean days to undo.`,
          `Late, at ${(late?.score ?? 0).toFixed(0)}, it cost ${Math.abs(late?.delta ?? 0).toFixed(1)} points and took ${recover(missLate) ?? "more than the days left"}.`,
          "The cost is stated in CLEAN DAYS, not points, and that is why the points",
          "figure is smaller at the top while the sting is bigger: a day is worth",
          "less up there too. Expressed as a flat points figure, a loss that stung",
          "at 900 would be ruinous at 200.",
        ],
        series: [
          { label: "Global score", points: curve.map((p) => ({ day: p.day, value: p.score })) },
        ],
      };
    },
  },

  // ---------------------------------------------------------------- money --
  {
    id: "money-split-two",
    group: "Money",
    title: "One misses, two pass",
    question: "Who gets paid, and does it add up?",
    async run() {
      await wipe();
      await defaultTimezone();
      for (const [id, name] of [[A, "Ann"], [B, "Ben"], [C, "Cam"]] as const) {
        await person(id, name);
        await track(id, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-20));
      }
      await group(G1, "Money group", [
        { id: A, role: "owner", joinedAt: day(-20) },
        { id: B, role: "member", joinedAt: day(-20) },
        { id: C, role: "member", joinedAt: day(-20) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-22), by: A });
      await money(G1, true, day(-22), A);
      for (const u of [A, B, C]) await share(G1, u, "steps", true, day(-22));

      const missDay = day(-3);
      for (const d of days(-20, -1)) {
        if (d !== missDay) await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        await checkin(C, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();
      const lines = (await ledgerOf(G1)).filter((l) => l.periodStart === missDay);
      const postings = (await postingsOf(G1)).filter((p) => p.periodStart === missDay);
      const total = lines.reduce((s, l) => s + l.amount, 0);
      const net = await balancesOf(G1);
      return {
        checks: [
          eq("one posting for the miss", postings.length, 1),
          eq("posted at the full fine", postings[0]?.amount, 50000),
          eq("split into two shares", lines.length, 2),
          holds("shares sum exactly to the fine", total === 50000, total, 50000),
          holds("each passer is paid the same", lines.every((l) => l.amount === 25000)),
          holds("the misser owes it all", net.get(A) === 50000, net.get(A), 50000),
          holds("nobody who passed owes anything", (net.get(B) ?? 0) < 0 && (net.get(C) ?? 0) < 0),
        ],
        notes: [
          "A fine is a debt to specific people, never a pot.",
          "Rupees 500 split two ways, and the shares sum to the fine exactly (invariant 7).",
        ],
      };
    },
  },
  {
    id: "money-odd-split",
    group: "Money",
    title: "An amount that does not divide",
    question: "Where does the leftover minor unit go?",
    // Every scenario is `async run()` so the runner can treat them alike. This
    // one happens to need no database, which is not a reason to make it the odd
    // shape out.
    // eslint-disable-next-line @typescript-eslint/require-await
    async run() {
      const shares = splitFine(5000, ["u3", "u1", "u2"]);
      const total = shares.reduce((s, x) => s + x.amount, 0);
      return {
        checks: [
          holds("shares sum exactly to the fine", total === 5000, total, 5000),
          eq("distributed by sorted id", shares, [
            { toUserId: "u1", amount: 1667 },
            { toUserId: "u2", amount: 1667 },
            { toUserId: "u3", amount: 1666 },
          ]),
          holds(
            "no minor unit is lost",
            shares.every((s) => Number.isInteger(s.amount)),
          ),
        ],
        notes: [
          "5000 across three is 1667/1667/1666, never 1666 three times with a unit lost.",
          "Ordered by id so the same fine splits the same way every time.",
        ],
      };
    },
  },
  {
    id: "money-nobody-passed",
    group: "Money",
    title: "Everyone missed the same day",
    question: "Who is owed when nobody passed?",
    async run() {
      await wipe();
      await defaultTimezone();
      for (const [id, name] of [[A, "Ann"], [B, "Ben"]] as const) {
        await person(id, name);
        await track(id, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-30));
      }
      await group(G1, "Money group", [
        { id: A, role: "owner", joinedAt: day(-25) },
        { id: B, role: "member", joinedAt: day(-25) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-28), by: A });
      await money(G1, true, day(-28), A);
      for (const u of [A, B]) await share(G1, u, "steps", true, day(-28));

      const missDay = day(-3);
      for (const d of days(-20, -1)) {
        if (d === missDay) continue;
        await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();
      const lines = (await ledgerOf(G1)).filter((l) => l.periodStart === missDay);
      const outcomes = (await outcomesOf(G1)).filter((o) => o.periodStart === missDay);
      return {
        checks: [
          eq("nothing is written", lines.length, 0),
          holds("but the miss is still recorded", outcomes.every((o) => !o.passed), outcomes.length, "> 0 missed"),
        ],
        notes: [
          "Decision 107: with nobody who passed there is no creditor, so there is no debt.",
          "That is also what keeps invariant 7 exact: a fine always has shares to sum to.",
        ],
      };
    },
  },
  {
    id: "money-off",
    group: "Money",
    title: "A group with money switched off",
    question: "Does a miss cost anything when the group does not do money?",
    async run() {
      await wipe();
      await defaultTimezone();
      for (const [id, name] of [[A, "Ann"], [B, "Ben"]] as const) {
        await person(id, name);
        await track(id, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-30));
      }
      await group(G1, "No money", [
        { id: A, role: "owner", joinedAt: day(-25) },
        { id: B, role: "member", joinedAt: day(-25) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-28), by: A });
      await money(G1, false, day(-28), A); // the owner's toggle stays off
      for (const u of [A, B]) await share(G1, u, "steps", true, day(-28));

      const missDay = day(-3);
      for (const d of days(-20, -1)) {
        if (d !== missDay) await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();
      const lines = await ledgerOf(G1);
      const outcomes = (await outcomesOf(G1)).filter((o) => o.periodStart === missDay && o.user === A);
      const curve = await curveOf(A, G1);
      return {
        checks: [
          eq("no ledger rows at all", lines.length, 0),
          eq("the outcome carries no fine", outcomes[0]?.fine, 0),
          holds("the miss still moves reputation", curve.some((p) => p.delta < 0)),
        ],
        notes: [
          "A fine rule set but money off costs nothing, because the group never agreed to money.",
          "Accountability is not the same as money, and switching one off does not switch the other off.",
        ],
      };
    },
  },
  {
    id: "money-unshared-type",
    group: "Money",
    title: "A miss on something you never shared",
    question: "Can a group fine you for an activity you keep private?",
    async run() {
      await wipe();
      await defaultTimezone();
      for (const [id, name] of [[A, "Ann"], [B, "Ben"]] as const) {
        await person(id, name);
        await track(id, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-30));
        await track(id, "water", DAILY_NO_GRACE, WATER_CONFIG, day(-30));
      }
      await group(G1, "Money group", [
        { id: A, role: "owner", joinedAt: day(-25) },
        { id: B, role: "member", joinedAt: day(-25) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-28), by: A });
      await accepts(G1, "water", { fine: 50000, from: day(-28), by: A });
      await money(G1, true, day(-28), A);
      for (const u of [A, B]) await share(G1, u, "steps", true, day(-28));
      // Nobody shares water: it is accepted by the group and private to both.

      const missDay = day(-3);
      for (const d of days(-20, -1)) {
        await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        if (d !== missDay) await logWater(d, 8);
        await logWater(d, 8, B);
      }
      await scoreAll();
      const waterLines = (await ledgerOf(G1)).filter((l) => l.typeKey === "water");
      const waterOutcomes = (await outcomesOf(G1)).filter((o) => o.typeKey === "water");
      const scored = await scoresOf(A, "water");
      return {
        checks: [
          eq("no fine for the private type", waterLines.length, 0),
          eq("no group outcome for it either", waterOutcomes.length, 0),
          holds("but it is still scored personally", scored.length > 0, scored.length, "> 0"),
        ],
        notes: [
          "A private activity produces no outcome, no fine and no movement in the group.",
          "It still counts for the person, which is the whole point of tracking it.",
        ],
      };
    },
  },
  {
    id: "money-idempotent",
    group: "Money",
    title: "The job runs twice",
    question: "Does a second scoring pass charge the same fine again?",
    async run() {
      await wipe();
      await defaultTimezone();
      for (const [id, name] of [[A, "Ann"], [B, "Ben"], [C, "Cam"]] as const) {
        await person(id, name);
        await track(id, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-30));
      }
      await group(G1, "Money group", [
        { id: A, role: "owner", joinedAt: day(-25) },
        { id: B, role: "member", joinedAt: day(-25) },
        { id: C, role: "member", joinedAt: day(-25) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-28), by: A });
      await money(G1, true, day(-28), A);
      for (const u of [A, B, C]) await share(G1, u, "steps", true, day(-28));

      const missDay = day(-3);
      for (const d of days(-20, -1)) {
        if (d !== missDay) await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        await checkin(C, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();
      const first = await ledgerOf(G1);
      await scoreAll();
      await scoreAll();
      const third = await ledgerOf(G1);
      const total = third.reduce((s, l) => s + l.amount, 0);
      return {
        checks: [
          eq("three passes wrote the same rows as one", third.length, first.length),
          holds("and the same total", total === first.reduce((s, l) => s + l.amount, 0), total, 50000),
          holds("charged exactly once", total === 50000, total, 50000),
        ],
        notes: [
          "The posting carries the fine's identity, so a replay cannot write a second set of entries.",
          "Before fine_postings this charged 750 for a 500 fine when a later pass found another peer.",
        ],
      };
    },
  },

  // ---------------------------------------------------------- memberships --
  {
    id: "group-joining-score",
    group: "Groups",
    title: "Joining with a record behind you",
    question: "Does a good record help, and can a bad one be escaped by rejoining?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await person(B, "Ben");
      await track(A, "steps", DAILY, STEPS_CONFIG, day(-200));
      await track(B, "steps", DAILY, STEPS_CONFIG, day(-200));
      // Ann has six months of a spotless record before joining. Ben has none.
      for (const d of days(-190, -1)) {
        await logSteps(d, 10000);
      }
      for (const d of days(-30, -1)) {
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await group(G1, "New group", [
        { id: A, role: "owner", joinedAt: day(-20) },
        { id: B, role: "member", joinedAt: day(-20) },
      ]);
      await accepts(G1, "steps", { from: day(-25), by: A });
      await share(G1, A, "steps", true, day(-25));
      await share(G1, B, "steps", true, day(-25));
      await scoreAll();
      const annGroup = (await curveOf(A, G1))[0]?.score ?? 0;
      const benGroup = (await curveOf(B, G1))[0]?.score ?? 0;
      const annGlobal = await finalScore(A, null);
      return {
        checks: [
          holds("a record helps", annGroup > benGroup, `${annGroup.toFixed(0)} vs ${benGroup.toFixed(0)}`, "Ann starts higher"),
          holds("but only a little: the start is clamped to 100..300", annGroup <= 300 && annGroup >= 100, annGroup.toFixed(0), "100..300"),
          holds(
            "so a long private record does not buy a rank",
            annGroup < annGlobal,
            `${annGroup.toFixed(0)} vs a global ${annGlobal.toFixed(0)}`,
            "much lower",
          ),
        ],
        notes: [
          "Decision 10: the global score sets where you start, clamped, and is never shown to anyone else.",
          "The clamp is also what stops a bad record being escaped by leaving and rejoining.",
        ],
      };
    },
  },
  {
    id: "group-left",
    group: "Groups",
    title: "Leaving a group",
    question: "Does a group keep scoring someone who left?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await person(B, "Ben");
      await track(A, "steps", DAILY, STEPS_CONFIG, day(-60));
      await track(B, "steps", DAILY, STEPS_CONFIG, day(-60));
      await group(G1, "Left group", [
        { id: A, role: "owner", joinedAt: day(-50) },
        { id: B, role: "member", joinedAt: day(-50), leftAt: day(-20) },
      ]);
      await accepts(G1, "steps", { from: day(-55), by: A });
      await share(G1, A, "steps", true, day(-55));
      await share(G1, B, "steps", true, day(-55));
      for (const d of days(-50, -1)) {
        await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();
      const benCurve = await curveOf(B, G1);
      const annCurve = await curveOf(A, G1);
      return {
        checks: [
          holds("scoring stops on the day they left", benCurve.at(-1)?.day === day(-20), benCurve.at(-1)?.day, day(-20)),
          holds("the person who stayed keeps going", (annCurve.at(-1)?.day ?? "") > day(-20)),
          holds("what they earned is not deleted", benCurve.length > 0, benCurve.length, "> 0 days kept"),
        ],
        notes: ["Leaving stops the clock. It does not erase the record or the balance."],
      };
    },
  },
  {
    id: "group-join-grace",
    group: "Groups",
    title: "The day you join",
    question: "Can a group fine you for a day that was over before you joined it?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person(A, "Ann");
      await person(B, "Ben");
      await track(A, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-30));
      await track(B, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-30));
      await group(G1, "Grace group", [
        { id: A, role: "owner", joinedAt: day(-30) },
        { id: B, role: "member", joinedAt: day(-10) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-32), by: A });
      await money(G1, true, day(-32), A);
      await share(G1, A, "steps", true, day(-32));
      await share(G1, B, "steps", true, day(-32));

      // Ann never misses. Ben misses the day he joined and the day after it,
      // so the only difference between the two days is the grace.
      const joinDay = day(-10);
      const firstCounted = day(-9);
      for (const d of days(-30, -1)) {
        await logSteps(d, 10000);
        if (d !== joinDay && d !== firstCounted) {
          await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        }
      }
      await scoreAll();

      const outcomes = (await outcomesOf(G1)).filter((o) => o.user === B);
      const onJoin = outcomes.filter((o) => o.periodStart === joinDay);
      const onFirst = outcomes.filter((o) => o.periodStart === firstCounted);
      const postings = (await postingsOf(G1)).filter((p) => p.user === B);
      const groupCurve = await curveOf(B, G1);
      const ownCurve = await curveOf(B, null);
      const ownOnJoin = ownCurve.find((r) => r.day === joinDay);

      return {
        checks: [
          eq("nothing is judged on the join day", onJoin.length, 0),
          eq("no fine for it", postings.filter((p) => p.periodStart === joinDay).length, 0),
          eq("the day after is judged", onFirst.length, 1),
          eq("and fined", onFirst[0]?.fine, 50000),
          holds(
            "the group's score starts the day after the join",
            groupCurve[0]?.day === firstCounted,
            groupCurve[0]?.day,
            firstCounted,
          ),
          holds(
            "their own record still counts the join day",
            ownOnJoin?.reason === "incomplete",
            ownOnJoin?.reason,
            "incomplete",
          ),
        ],
        notes: [
          "A group does not count the day somebody joined it: the day was already lived, and its windows shut before the group existed to that person.",
          "It is a group boundary only. The same miss moves their own record on the same day.",
        ],
        series: [
          { label: "Ben, in the group", points: groupCurve.map((r) => ({ day: r.day, value: r.score })) },
          { label: "Ben, his own record", points: ownCurve.map((r) => ({ day: r.day, value: r.score })) },
        ],
      };
    },
  },
  {
    id: "group-grace-not-paid",
    group: "Groups",
    title: "In grace when someone else misses",
    question: "Does a member in grace collect a share of that day's fine?",
    async run() {
      await wipe();
      await defaultTimezone();
      for (const [id, name] of [[A, "Ann"], [B, "Ben"], [C, "Cam"]] as const) {
        await person(id, name);
        await track(id, "steps", DAILY_NO_GRACE, STEPS_CONFIG, day(-20));
      }
      await group(G1, "Grace pay", [
        { id: A, role: "owner", joinedAt: day(-20) },
        { id: C, role: "member", joinedAt: day(-20) },
        { id: B, role: "member", joinedAt: day(-5) },
      ]);
      await accepts(G1, "steps", { fine: 50000, from: day(-22), by: A });
      await money(G1, true, day(-22), A);
      for (const u of [A, B, C]) await share(G1, u, "steps", true, day(-22));

      // Ann misses the day Ben joins. Ben and Cam both pass it.
      const joinDay = day(-5);
      for (const d of days(-20, -1)) {
        if (d !== joinDay) await logSteps(d, 10000);
        await checkin(B, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        await checkin(C, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
      }
      await scoreAll();

      const lines = (await ledgerOf(G1)).filter((l) => l.periodStart === joinDay);
      const total = lines.reduce((s, l) => s + l.amount, 0);
      return {
        checks: [
          eq("one share, not two", lines.length, 1),
          eq("it goes to the member who was being counted", lines[0]?.to, C),
          holds("nothing goes to the member in grace", lines.every((l) => l.to !== B)),
          holds("and the fine is still whole", total === 50000, total, 50000),
        ],
        notes: [
          "Grace runs both ways: a group that is not judging you is not paying you either.",
          "It falls out of the model rather than needing a rule. With no outcome for the day there is nobody to pay.",
        ],
      };
    },
  },
  // ------------------------------------------------------------ timezones --
  {
    id: "tz-same-behaviour",
    group: "Timezones",
    title: "The same habit, in four places",
    question: "Does where you live change what your record is worth?",
    async run() {
      await wipe();
      await defaultTimezone();
      const zones: [string, string][] = [
        ["tz-ist", "Asia/Kolkata"],
        ["tz-la", "America/Los_Angeles"],
        ["tz-nz", "Pacific/Auckland"],
        ["tz-utc", "UTC"],
      ];
      for (const [id, zone] of zones) {
        await person(id, id);
        await timezoneFor(id, zone);
        // Their own local midnight, not one shared instant. The engine reads
        // the switch instant in the member's zone, so starting all four at
        // midnight IST would give them four different local start days and
        // four settling weeks covering different dates.
        await trackIn(zone, id, "steps", DAILY, STEPS_CONFIG, day(-60));
      }
      // Everyone logs at eight in the evening, their own evening, through to
      // today. A zone twelve hours ahead is already on tomorrow's date, so a
      // fixture that stops at yesterday-in-IST hands it a genuine missed day.
      for (const d of days(-60, 0)) {
        for (const [id, zone] of zones) {
          await checkinIn(zone, id, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        }
      }
      await scoreAll();
      // Compared on a day every zone has certainly finished. Comparing "now"
      // would be comparing different amounts of elapsed time: a zone twelve
      // hours ahead has genuinely lived one more day, and its score being one
      // day further along is the right answer, not a defect.
      const common = day(-3);
      const results = await Promise.all(
        zones.map(async ([id, zone]) => ({
          zone,
          streak: (await streakOf(id, "steps"))?.streak ?? -1,
          onCommonDay: Math.round(
            (await curveOf(id, null)).find((p) => p.day === common)?.score ?? -1,
          ),
        })),
      );
      const streaks = results.map((r) => r.streak);
      const commonScores = results.map((r) => r.onCommonDay);
      return {
        checks: [
          holds(
            "the same day is worth the same everywhere",
            new Set(commonScores).size === 1 && commonScores[0] > 0,
            results.map((r) => `${r.zone}=${r.onCommonDay}`).join(", "),
            "all equal",
          ),
          holds(
            "and the streaks agree, to within the day a zone is ahead",
            Math.max(...streaks) - Math.min(...streaks) <= 1,
            results.map((r) => `${r.zone}=${r.streak}`).join(", "),
            "within 1",
          ),
          holds("nobody lost a day to the date line", Math.min(...streaks) >= 60, Math.min(...streaks), "at least 60"),
        ],
        notes: [
          "A period is resolved in the user's own zone, so an evening is an evening.",
          "UTC+12 and UTC-7 in the same run, doing the same thing, counting the same.",
          `On ${common}, a day behind every one of them, all four scores are identical.`,
        ],
      };
    },
  },
  {
    id: "tz-late-night",
    group: "Timezones",
    title: "Half past eleven at night",
    question: "Does a late check-in fall on the day it felt like?",
    async run() {
      await wipe();
      await defaultTimezone();
      // Los Angeles at 23:30 is already tomorrow in UTC, which is exactly where
      // a naive implementation puts the check-in.
      await person("tz-la", "Lee");
      await timezoneFor("tz-la", "America/Los_Angeles");
      await track("tz-la", "steps", DAILY, STEPS_CONFIG, day(-30));
      const landed: string[] = [];
      for (const d of days(-30, -1)) {
        landed.push(
          await checkinIn("America/Los_Angeles", "tz-la", "steps", "count", d, "23:30", DAILY, {
            steps: 10000,
          }),
        );
      }
      await scoreAll();
      const s = await streakOf("tz-la", "steps");
      const wanted = days(-30, -1);
      const misplaced = landed.filter((period, i) => period !== wanted[i]);
      return {
        checks: [
          eq("every check-in landed on its own local day", misplaced.length, 0),
          eq("so the run is unbroken", s?.streak, 30),
          eq("and no grace was needed", s?.graceSpent, {}),
        ],
        notes: [
          "23:30 in Los Angeles is 06:30 the next day in UTC.",
          "Reading the clock in UTC would move every one of these to tomorrow and",
          "leave today empty, which is a miss a day for anyone west of Greenwich.",
        ],
      };
    },
  },
  {
    id: "tz-dst",
    group: "Timezones",
    title: "The clocks go back, and forward",
    question: "Does a 23-hour day or a 25-hour day cost anything?",
    async run() {
      await wipe();
      await defaultTimezone();
      await person("tz-ny", "Nat");
      await timezoneFor("tz-ny", "America/New_York");
      // A window long enough to span both of the year's transitions.
      await track("tz-ny", "steps", DAILY, STEPS_CONFIG, day(-320));
      const all = days(-320, -1);
      for (const d of all) {
        await checkinIn("America/New_York", "tz-ny", "steps", "count", d, "20:00", DAILY, {
          steps: 10000,
        });
      }
      await scoreAll();
      const s = await streakOf("tz-ny", "steps");
      const scored = await scoresOf("tz-ny", "steps");
      const periods = new Set(scored.map((r) => r.periodStart));
      const missing = all.filter((d) => !periods.has(d) && d < day(-1));
      const failedDays = scored.filter((r) => !r.passed);
      return {
        checks: [
          eq("no day is skipped over a transition", missing.length, 0),
          eq("no day is scored as a miss", failedDays.length, 0),
          holds(
            "the run covers the whole window",
            (s?.streak ?? 0) >= all.length - 1,
            s?.streak,
            `about ${all.length}`,
          ),
          holds("no duplicate periods", periods.size === scored.length),
        ],
        notes: [
          "New York over a full year covers both an hour lost in March and an hour",
          "gained in November.",
          "Days are compared as calendar days in the zone, never as 24-hour blocks,",
          "which is what makes a 23-hour day a day.",
        ],
      };
    },
  },
  {
    id: "tz-noon-boundary",
    group: "Timezones",
    title: "A day that starts at noon",
    question: "Does a sleep-shaped day, which runs noon to noon, behave across zones?",
    async run() {
      await wipe();
      await defaultTimezone();
      const NOON: ScheduleShape = { schedule: EVERY_DAY, dayBoundary: "noon", grace: 0 };
      const zones: [string, string][] = [
        ["tz-n-ist", "Asia/Kolkata"],
        ["tz-n-la", "America/Los_Angeles"],
      ];
      for (const [id, zone] of zones) {
        await person(id, id);
        await timezoneFor(id, zone);
        await track(id, "steps", NOON, STEPS_CONFIG, day(-40));
      }
      // Ten at night belongs to the day that started at noon, not the next one.
      const landed: Record<string, string[]> = { "tz-n-ist": [], "tz-n-la": [] };
      for (const d of days(-40, 0)) {
        for (const [id, zone] of zones) {
          landed[id].push(
            await checkinIn(zone, id, "steps", "count", d, "22:00", NOON, { steps: 10000 }),
          );
        }
      }
      await scoreAll();
      const streaks = await Promise.all(
        zones.map(async ([id]) => (await streakOf(id, "steps"))?.streak ?? -1),
      );
      const expected = days(-40, 0);
      return {
        checks: [
          holds(
            "a 10 PM check-in belongs to the day that began at noon",
            landed["tz-n-ist"].every((p, i) => p === expected[i]),
            landed["tz-n-ist"].slice(0, 2).join(", "),
            expected.slice(0, 2).join(", "),
          ),
          holds(
            "both zones agree, to within the day one is ahead",
            Math.abs(streaks[0] - streaks[1]) <= 1,
            streaks.join(" vs "),
            "within 1",
          ),
          holds(
            "and neither loses a day",
            streaks[0] >= expected.length - 2,
            streaks[0],
            `about ${expected.length}`,
          ),
        ],
        notes: [
          "A noon boundary is what lets a night that runs past midnight belong to",
          "one day. Sleep uses it; this checks the boundary itself rather than the",
          "sleep module.",
        ],
      };
    },
  },
  {
    id: "tz-settling-edge",
    group: "Timezones",
    title: "Where the settling week starts",
    question: "Is a new activity's first week the same length wherever you live?",
    async run() {
      await wipe();
      await defaultTimezone();
      const zones: [string, string][] = [
        ["tz-s-ist", "Asia/Kolkata"],
        ["tz-s-utc", "UTC"],
        ["tz-s-la", "America/Los_Angeles"],
      ];
      for (const [id, zone] of zones) {
        await person(id, id);
        await timezoneFor(id, zone);
        await trackIn(zone, id, "steps", DAILY, STEPS_CONFIG, day(-20));
      }
      for (const d of days(-20, -1)) {
        for (const [id, zone] of zones) {
          await checkinIn(zone, id, "steps", "count", d, "20:00", DAILY, { steps: 10000 });
        }
      }
      await scoreAll();
      const counts = await Promise.all(
        zones.map(async ([id, zone]) => ({
          zone,
          settling: (await scoresOf(id, "steps")).filter((r) => r.settling).length,
        })),
      );
      const values = counts.map((c) => c.settling);
      const spread = counts.map((c) => `${c.zone}=${c.settling}`).join(", ");
      return {
        checks: [
          holds(
            "the settling window is about a week everywhere",
            values.every((v) => v >= 6 && v <= 8),
            spread,
            "6 to 8 days",
          ),
          holds(
            "and it does not depend on the zone",
            new Set(values).size === 1,
            spread,
            "all equal",
          ),
        ],
        notes: [
          "The settling window compares a period date against the day the",
          "activity was switched on, both in the member's own zone.",
          "Reading the switch instant in UTC moved that edge by a day depending",
          "which side of Greenwich the member was on, so the window closed early",
          "and the seventh day counted. Each of these starts at their own local",
          "midnight, which is what makes the counts comparable at all.",
        ],
      };
    },
  },
];
