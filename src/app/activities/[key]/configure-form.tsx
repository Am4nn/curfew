"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getActivityType,
  scheduleConfigSchema,
  ruleFor,
  howOften,
  type ConfigField,
  type EvidenceRule,
  type ScheduleConfig,
  type Schedule,
  type FieldIssue,
} from "@/domain";
import { CameraIcon, StreakNumber } from "../../activity-icon";
import { saveActivityAction } from "./actions";
import { StopSheet } from "./stop-sheet";

// One configure screen, twelve types. Five controls, drawn from the module's
// declared fields (decision 88): a day picker, a stepper, a typed box, a
// segmented switch and a time range. Days, grace and "changes apply from" are
// the engine's, because they mean the same thing for every type.

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** One configured value as text for an input. Anything not a scalar is nothing. */
function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, part) => (acc == null ? undefined : (acc as Record<string, unknown>)[part]),
    obj,
  );
}

function set(obj: unknown, path: string, value: unknown): unknown {
  const parts = path.split(".");
  const head = parts[0];
  const base = { ...((obj ?? {}) as Record<string, unknown>) };
  base[head] =
    parts.length === 1 ? value : set(base[head], parts.slice(1).join("."), value);
  return base;
}

// --- the five controls -----------------------------------------------------

function FieldWrap({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-[11px] tracking-[0.06em] text-muted">{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] leading-[1.5] text-penalty">{error}</span>
      ) : hint ? (
        <span className="text-[11px] leading-[1.5] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

function DayCell({
  label,
  on,
  wide,
  onClick,
}: {
  label: string;
  on: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "flex h-[38px] items-center justify-center border text-[11.5px] " +
        (wide ? "flex-[1.5] " : "flex-1 ") +
        (on ? "border-fg bg-fg text-bg" : "border-rule text-muted")
      }
    >
      {label}
    </button>
  );
}

// Any date at all. No module decides `repeats` from which period it is asked
// about, and this control only needs to know whether the step repeats.
const ANY_DAY = "2026-01-01";

function Stepper({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex border border-rule">
      <button
        type="button"
        aria-label="Less"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-11 border-r border-rule text-[16px] text-muted disabled:opacity-40"
      >
        &minus;
      </button>
      <div className="flex flex-1 items-center justify-center gap-[6px] py-[11px]">
        <span className="text-[14px] tabular-nums">{value.toLocaleString("en-US")}</span>
        {unit ? <span className="text-[12px] text-muted">{unit}</span> : null}
      </div>
      <button
        type="button"
        aria-label="More"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-11 border-l border-rule text-[16px] text-muted disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

// A typed box, for a number you already know rather than one you nudge.
function NumberBox({
  value,
  unit,
  invalid,
  onChange,
  label,
}: {
  value: number;
  unit?: string;
  invalid: boolean;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div
      className={
        "flex items-center justify-between gap-[10px] border px-3 py-[10px] " +
        (invalid ? "border-penalty" : "border-rule")
      }
    >
      <input
        type="text"
        inputMode="numeric"
        // A native type="number" input can never show a thousands separator
        // (the browser strips all formatting), so this is a formatted text
        // field: display with commas, parse them back out on change.
        value={Number.isNaN(value) ? "" : value.toLocaleString("en-US")}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value.replace(/,/g, "")))}
        className="w-full bg-transparent text-[14px] tabular-nums text-fg outline-none"
      />
      {unit ? <span className="text-[12px] text-muted">{unit}</span> : null}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex border border-rule">
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={
            "flex-1 px-1 py-[10px] text-center text-[12.5px] " +
            (i > 0 ? "border-l border-rule " : "") +
            (value === option.value ? "bg-fg text-bg" : "text-muted")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// The platform time control: the only one that reaches the phone's own picker.
// Its 12-hour or 24-hour display follows the device.
function TimeBox({
  value,
  invalid,
  label,
  onChange,
}: {
  value: string;
  invalid?: boolean;
  label: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      type="time"
      step={60}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={
        "flex-1 border bg-transparent px-3 py-[10px] text-[14px] text-fg " +
        (invalid ? "border-penalty" : "border-rule")
      }
    />
  );
}

function Fact({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-[3px] border border-rule bg-surface px-[13px] py-3">
      <span className="text-[13px]">{title}</span>
      <span className="text-[11px] leading-[1.5] text-muted">{sub}</span>
    </div>
  );
}

// Evidence is a property of the type, stated and never offered (decision 6).
function EvidenceFact({ rule }: { rule: EvidenceRule }) {
  const none = rule.level === "none";
  return (
    <div className="flex items-center gap-[11px] border border-rule bg-surface px-[13px] py-3">
      <span className={"flex flex-none " + (rule.level === "required" ? "text-fg" : "text-muted")}>
        <CameraIcon struck={none} />
      </span>
      <div className="flex flex-1 flex-col gap-[3px]">
        <span className="text-[13px]">
          {none ? "No photo" : `Photo ${rule.level}`}
        </span>
        <span className="text-[11px] leading-[1.5] text-muted">{rule.detail}</span>
      </div>
    </div>
  );
}

// Small print, and nothing more. This wore a tinted panel with a coloured bar
// down its side, which is emphasis a footnote does not need and which appeared
// on so many screens that it stopped meaning anything.
function Note({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "pass" | "penalty" }) {
  return (
    <p
      className={
        "text-[11.5px] leading-[1.55] " + (tone === "penalty" ? "text-penalty" : "text-muted")
      }
    >
      {children}
    </p>
  );
}

// --- the screen ------------------------------------------------------------

/**
 * One screen, twelve types, two presentations.
 *
 * It used to be every control at once: a day picker, the module's own fields,
 * a gap, grace, and not one line saying what they added up to. Twelve controls
 * on a screen that never states the rule is a screen you configure by
 * guessing.
 *
 * So the rule comes first, written out (`ruleFor`), and the controls sit
 * behind it. Setting one up and changing one are different jobs and get
 * different shapes:
 *
 *  - SETTING UP, one question a screen. Nobody has an opinion about a minimum
 *    gap before they have picked the days, and showing all of it at once is
 *    what made this feel like a form to fill in.
 *  - CHANGING one, a list. You came here to change ONE thing, and a list of
 *    what is set lets you find it and leave. The rule is stated above it, so
 *    the screen answers "what am I signed up for" without being read.
 *
 * Both are drawn from the same `panels` array, so a type that adds a field
 * gets it in both, and neither knows what the field means (invariant 6).
 */

interface Panel {
  id: string;
  /** The row's label in the list, and the short name when setting up. */
  label: string;
  /** What it is set to now, for the right-hand side of a list row. */
  value: string;
  /** The question, asked in full. Only the setup flow shows this. */
  question: string;
  body: React.ReactNode;
  /** True while this panel's own value will not save. */
  broken: boolean;
  /**
   * Set when this is a statement rather than a control: the line under it
   * saying why it is not yours to set.
   *
   * It is a row in the list, in its place, because somebody scanning for the
   * confirm window looks where the confirm window would be and has to find out
   * there that it is fixed. It is not a question, so the setup flow skips it.
   */
  fixed?: string;
}

export function ConfigureForm({
  typeKey,
  name,
  description,
  initialSchedule,
  initialConfig,
  tracked,
  streak,
  best,
  returnTo,
}: {
  typeKey: string;
  name: string;
  description: string;
  initialSchedule: ScheduleConfig;
  initialConfig: unknown;
  tracked: boolean;
  streak: number;
  best: number;
  returnTo?: string;
}) {
  const type = getActivityType(typeKey);
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleConfig>(initialSchedule);
  const [config, setConfig] = useState<unknown>(initialConfig);
  const [saved, setSaved] = useState({ schedule: initialSchedule, config: initialConfig });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Which panel is open. In the list this is the one thing being changed; in
  // the setup flow, how far along you are.
  const [open, setOpen] = useState<string | null>(null);
  const [at, setAt] = useState(0);

  const dirty = JSON.stringify({ schedule, config }) !== JSON.stringify(saved);

  // Everything wrong, against the field it belongs to. The schema says what is
  // valid; the module says what the schema cannot.
  const issues: FieldIssue[] = [];
  const parsedConfig = type.configSchema.safeParse(config);
  if (!parsedConfig.success) {
    for (const issue of parsedConfig.error.issues) {
      issues.push({ path: issue.path.join("."), message: issue.message });
    }
  } else {
    issues.push(...(type.validate?.(parsedConfig.data) ?? []));
  }
  const parsedSchedule = scheduleConfigSchema.safeParse(schedule);
  if (!parsedSchedule.success) {
    for (const issue of parsedSchedule.error.issues) {
      issues.push({ path: `@${issue.path.join(".")}`, message: issue.message });
    }
  }
  const errorFor = (path: string) => issues.find((i) => i.path === path)?.message;
  const valid = issues.length === 0;

  const safeConfig = parsedConfig.success ? parsedConfig.data : type.defaults.config;
  const fields = type.fields(safeConfig);

  const isMinimum = schedule.schedule.kind === "minimum";
  const days = schedule.schedule.kind === "days" ? schedule.schedule.days : [];

  function setSchedulePart(next: Schedule) {
    setSchedule((s) => ({ ...s, schedule: next }));
  }

  // The rule as a person would say it. Drawn from the values on screen rather
  // than the saved ones, so it moves as the controls move and you can read
  // what you are about to save before you save it.
  const rule = ruleFor(typeKey, parsedSchedule.success ? parsedSchedule.data : schedule, safeConfig);

  // -------------------------------------------------------------------------
  // The panels, built once and used by both presentations.
  // -------------------------------------------------------------------------

  const panels: Panel[] = [];

  panels.push({
    id: "days",
    label: "How often",
    value: howOften(schedule.schedule),
    question: `How often do you want to do this?`,
    broken: Boolean(errorFor("@schedule")),
    body: (
      <div className="flex flex-col gap-[9px]">
        <div className="flex gap-[6px]">
          {DAY_LABELS.map((label, i) => {
            const day = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const on = !isMinimum && days.includes(day);
            return (
              <DayCell
                key={i}
                label={label}
                on={on}
                onClick={() => {
                  const next = on ? days.filter((d) => d !== day) : [...days, day].sort();
                  setSchedulePart({ kind: "days", days: next.length === 0 ? [day] : next });
                }}
              />
            );
          })}
          <DayCell
            label="ANY"
            on={isMinimum}
            wide
            onClick={() =>
              setSchedulePart(
                isMinimum
                  ? { kind: "days", days: [1, 2, 3, 4, 5, 6, 7] }
                  : { kind: "minimum", perWeek: 3 },
              )
            }
          />
        </div>
        {schedule.schedule.kind === "minimum" ? (
          <Stepper
            value={schedule.schedule.perWeek}
            min={1}
            max={7}
            unit="days a week"
            onChange={(n) => setSchedulePart({ kind: "minimum", perWeek: n })}
          />
        ) : null}
        <span className="text-[11px] leading-[1.5] text-muted">
          Pick the days, or ANY for a number of days a week whichever they fall on.
        </span>
      </div>
    ),
  });

  for (const field of fields) {
    const key = field.kind === "timeRange" || field.kind === "fixed" ? field.label : field.key;
    const err =
      field.kind === "timeRange"
        ? errorFor(field.openKey)
        : field.kind === "fixed"
          ? undefined
          : errorFor(field.key);
    panels.push({
      id: `field:${key}`,
      label: field.label,
      value: fieldValue(field, config),
      question: `${field.label}?`,
      broken: Boolean(err),
      fixed: field.kind === "fixed" ? field.note : undefined,
      body: <ModuleField field={field} config={config} error={err} onChange={setConfig} />,
    });
  }

  // Only for a step that repeats WITHIN A DAY. There is nothing to space out on
  // a type you check in to once, and offering the control there would be a
  // setting that does nothing.
  //
  // `repeats` alone was the wrong question and Gym was the type it got wrong.
  // Its session repeats, because a week of three is not done after the first,
  // so this offered a wait between logs on an activity whose own rule already
  // refuses the second press until tomorrow. The only presses such a wait could
  // ever have refused are two straddling midnight, which are different days and
  // both count, so the control could do nothing a person would want.
  if (type.steps(safeConfig, ANY_DAY).some((s) => s.repeats && !s.oncePerDay)) {
    panels.push({
      id: "gap",
      label: "Time between logs",
      value: schedule.minGap === 0 ? "no wait" : `${schedule.minGap} minutes`,
      question: "How long between one log and the next?",
      broken: Boolean(errorFor("@minGap")),
      body: (
        <FieldWrap
          label="Time between logs"
          hint={
            schedule.minGap === 0
              ? "Off. Any number of logs, as fast as you like."
              : `A log inside ${schedule.minGap} minutes of the last one is refused.`
          }
          error={errorFor("@minGap")}
        >
          <Stepper
            value={schedule.minGap}
            min={0}
            max={240}
            step={5}
            unit="minutes"
            onChange={(n) => setSchedule((s) => ({ ...s, minGap: n }))}
          />
        </FieldWrap>
      ),
    });
  }

  // "Misses forgiven" was a panel here, a stepper from 0 to 31 a month. It is
  // gone with item 19. Grace is one pool for the account, two a month for each
  // activity tracked, and it is not a setting: how forgiving the app is to you
  // was a number you typed yourself, which is not a rule so much as a dial.
  // Settings carries the count and the grace screen is where it is spent.

  function save(share?: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveActivityAction({ typeKey, schedule, config, returnTo, share });
        setSaved({ schedule, config });
        setOpen(null);
        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else if (returnTo) {
          router.push("/activities");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not save.");
      }
    });
  }

  const settling = tracked
    ? schedule.schedule.kind === "minimum"
      ? "Changes apply from Monday."
      : "Changes apply from tomorrow."
    : "A new activity does not move your reputation for 7 days.";

  const problems =
    !valid && dirty ? (
      <Note tone="penalty">
        {issues.length === 1
          ? "One thing needs fixing before this can be saved."
          : `${issues.length} things need fixing before this can be saved.`}
      </Note>
    ) : null;

  // No `overflow-y-auto`. It made this a scroller inside a page that also
  // scrolls, and it could never do its job anyway: its parent is `min-h-dvh`,
  // a MINIMUM, so `flex-1` here has no upper bound to clip against and the
  // document scrolls regardless. One scroller, which is the page.
  //
  // `flex-1` stays, and it is what `mt-auto` on the button block pushes
  // against: with a short panel the parent is exactly one viewport, this fills
  // the rest of it, and Next sits on the bottom edge instead of floating under
  // a half-empty screen.
  const shell = "flex flex-1 flex-col gap-[18px] px-5 pb-6 pt-[18px]";

  // -------------------------------------------------------------------------
  // Setting one up: one question a screen.
  // -------------------------------------------------------------------------

  if (!tracked) {
    // Only the panels that ask something. A fixed row states a fact and has no
    // answer, so a Next over it would be a screen with nothing to do on it.
    const asked = panels.filter((p) => !p.fixed);
    const last = at >= asked.length;
    const panel = asked[at];
    return (
      <div className={shell}>
        <Progress at={Math.min(at, asked.length)} of={asked.length + 1} />

        {last ? (
          <>
            <RuleText rule={rule} />
            <EvidenceFact rule={type.evidence} />
            {type.note ? <Note>{type.note}</Note> : null}
            <p className="text-[11.5px] leading-[1.55] text-muted">{settling}</p>
            {error ? <Note tone="penalty">{error}</Note> : null}
            {problems}
            <div className="mt-auto flex flex-col gap-[10px] pt-2">
              <button
                type="button"
                onClick={() => save(true)}
                disabled={!valid || pending}
                className={
                  "h-11 w-full border text-[14px] " +
                  (valid
                    ? "border-fg bg-fg font-semibold text-bg"
                    : "cursor-not-allowed border-rule text-muted")
                }
              >
                {pending
                  ? "Starting"
                  : returnTo
                    ? `Add and share ${name}`
                    : `Start tracking ${name}`}
              </button>
              {returnTo ? (
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={!valid || pending}
                  className={
                    "h-11 w-full border text-[14px] " +
                    (valid ? "border-rule text-fg" : "cursor-not-allowed border-rule text-muted")
                  }
                >
                  Add for myself only
                </button>
              ) : null}
              <BackButton onClick={() => setAt(at - 1)} />
            </div>
          </>
        ) : panel ? (
          <>
            <div className="flex flex-col gap-[6px]">
              <p className="text-[15px] leading-[1.45]">{panel.question}</p>
              {at === 0 ? (
                <p className="text-[12px] leading-[1.55] text-muted">{description}.</p>
              ) : null}
            </div>
            {at === 0
              ? type.facts?.map((fact) => (
                  <Fact key={fact.title} title={fact.title} sub={fact.sub} />
                ))
              : null}
            {panel.body}
            <div className="mt-auto flex flex-col gap-[10px] pt-2">
              <button
                type="button"
                onClick={() => setAt(at + 1)}
                disabled={panel.broken}
                className={
                  "h-11 w-full border text-[14px] " +
                  (panel.broken
                    ? "cursor-not-allowed border-rule text-muted"
                    : "border-fg bg-fg font-semibold text-bg")
                }
              >
                Next
              </button>
              {at > 0 ? <BackButton onClick={() => setAt(at - 1)} /> : null}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Changing one: the rule, then a list of what is set.
  // -------------------------------------------------------------------------

  const openPanel = panels.find((p) => p.id === open) ?? null;

  if (openPanel) {
    return (
      <div className={shell}>
        <span className="text-[11px] tracking-[0.06em] text-muted">
          {openPanel.label.toUpperCase()}
        </span>
        {openPanel.body}
        {error ? <Note tone="penalty">{error}</Note> : null}
        {problems}
        <p className="text-[11.5px] leading-[1.55] text-muted">{settling}</p>
        <div className="mt-auto flex flex-col gap-[10px] pt-2">
          <button
            type="button"
            onClick={() => (dirty ? save(true) : setOpen(null))}
            disabled={!valid || pending}
            className={
              "h-11 w-full border text-[14px] " +
              (valid
                ? "border-fg bg-fg font-semibold text-bg"
                : "cursor-not-allowed border-rule text-muted")
            }
          >
            {pending ? "Saving" : dirty ? "Save" : "Done"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSchedule(saved.schedule);
              setConfig(saved.config);
              setOpen(null);
            }}
            disabled={pending}
            className="h-11 w-full border border-rule text-[14px] text-fg"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-3">
        <StreakNumber value={streak} />
        <span className="text-[11px] text-muted">days &middot; best {best}</span>
      </div>

      <RuleText rule={rule} />

      {type.facts?.map((fact) => (
        <Fact key={fact.title} title={fact.title} sub={fact.sub} />
      ))}

      <div className="flex flex-col">
        <span className="pb-[9px] text-[11px] tracking-[0.06em] text-muted">
          CHANGE ONE THING
        </span>
        {panels.map((panel) =>
          panel.fixed ? (
            <div
              key={panel.id}
              className="flex flex-col gap-[4px] border-t border-rule py-[13px]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] text-muted">{panel.label}</span>
                <span className="truncate text-[12px] text-muted">{panel.value}</span>
              </div>
              <span className="text-[11px] leading-[1.5] text-muted">{panel.fixed}</span>
            </div>
          ) : (
            <button
              key={panel.id}
              type="button"
              onClick={() => setOpen(panel.id)}
              className="flex items-center justify-between gap-3 border-t border-rule py-[13px] text-left"
            >
              <span className="text-[13.5px]">{panel.label}</span>
              <span className="flex min-w-0 items-center gap-[8px]">
                <span className="truncate text-[12px] text-muted">{panel.value}</span>
                <Chevron />
              </span>
            </button>
          ),
        )}
      </div>

      {/*
        1.58. EXPLAINED ONCE, AT SETUP, THEN NOT AGAIN.

        The evidence rule and the module's note used to render here too, on
        the screen somebody opens every time they change a target. They are
        the same two paragraphs every visit, and a sentence read fifty times
        is furniture rather than information.

        Both still appear in the setup flow above, which is where they are
        new and where somebody is deciding whether to track this at all. The
        rule itself stays on both, because the rule is what the screen is
        about; what goes is the explanation OF the rule.
      */}
      {error ? <Note tone="penalty">{error}</Note> : null}

      {/* Four things happen on this press and it used to name none of them
          (item 22). One of them is permanent. */}
      <StopSheet typeKey={typeKey} name={name} />
    </div>
  );
}

/** The rule, stated. The one thing the old screen never did. */
function RuleText({ rule }: { rule: { headline: string; notes: string[] } }) {
  return (
    <div className="flex flex-col gap-[10px] border-t border-rule pt-[14px]">
      <span className="text-[11px] tracking-[0.06em] text-muted">THE RULE</span>
      <p className="text-[15px] leading-[1.5]">{rule.headline}</p>
      {rule.notes.map((note) => (
        <p key={note} className="text-[11.5px] leading-[1.55] text-muted">
          {note}
        </p>
      ))}
    </div>
  );
}

/** How far through setting one up, as a rule rather than a number. */
function Progress({ at, of }: { at: number; of: number }) {
  return (
    <div className="flex gap-[4px]" aria-label={`Step ${at + 1} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={"h-[2px] flex-1 " + (i <= at ? "bg-fg" : "bg-rule")}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 w-full border border-rule text-[14px] text-fg"
    >
      Back
    </button>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      className="flex-none text-muted"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * One field's current value, for the right of a list row.
 *
 * The list has to say what everything is set to or it is a list of words. The
 * module declares the unit and the scale, so this reads those rather than
 * knowing what any particular field means (invariant 6).
 */
function fieldValue(field: ConfigField, config: unknown): string {
  if (field.kind === "fixed") return field.value;
  if (field.kind === "timeRange") {
    const open = text(get(config, field.openKey));
    const close = text(get(config, field.closeKey));
    return open && close ? `${hour12(open)} to ${hour12(close)}` : "not set";
  }
  if (field.kind === "time") {
    const value = text(get(config, field.key));
    return value ? hour12(value) : "not set";
  }
  if (field.kind === "segmented") {
    const value = text(get(config, field.key));
    return field.options.find((o) => o.value === value)?.label ?? "not set";
  }
  const raw = get(config, field.key);
  if (raw === null || raw === undefined || raw === "") return field.offLabel ?? "off";
  const scaled = Number(raw) / (field.scale ?? 1);
  const shown = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
  return field.unit ? `${shown} ${field.unit}` : shown;
}

/** "22:00" as "10:00 PM". The house clock is 12-hour (CLAUDE.md voice). */
function hour12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function ModuleField({
  field,
  config,
  error,
  onChange,
}: {
  field: ConfigField;
  config: unknown;
  error?: string;
  onChange: (next: unknown) => void;
}) {
  // A statement, not a control. It never reaches the setup flow, which asks
  // questions, and in the list it is drawn as a row rather than opened.
  if (field.kind === "fixed") return null;
  if (field.kind === "timeRange") {
    return (
      <FieldWrap label={field.label} hint={field.hint} error={error}>
        <div className="flex items-center gap-[9px]">
          <TimeBox
            label={`${field.label} opens`}
            value={text(get(config, field.openKey))}
            invalid={Boolean(error)}
            onChange={(v) => onChange(set(config, field.openKey, v))}
          />
          <span className="text-[11px] text-muted">to</span>
          <TimeBox
            label={`${field.label} closes`}
            value={text(get(config, field.closeKey))}
            invalid={Boolean(error)}
            onChange={(v) => onChange(set(config, field.closeKey, v))}
          />
        </div>
      </FieldWrap>
    );
  }

  if (field.kind === "time") {
    return (
      <FieldWrap label={field.label} hint={field.hint} error={error}>
        <div className="flex">
          <TimeBox
            label={field.label}
            value={text(get(config, field.key))}
            invalid={Boolean(error)}
            onChange={(v) => onChange(set(config, field.key, v))}
          />
        </div>
      </FieldWrap>
    );
  }

  if (field.kind === "segmented") {
    return (
      <FieldWrap label={field.label} hint={field.hint} error={error}>
        <Segmented
          options={field.options}
          value={text(get(config, field.key))}
          onChange={(v) => onChange(set(config, field.key, v))}
        />
      </FieldWrap>
    );
  }

  // A number, stored in one unit and set in another where the two differ.
  const scale = field.scale ?? 1;
  const stored = Number(get(config, field.key) ?? field.min);
  const shown = stored / scale;
  const write = (n: number) => onChange(set(config, field.key, Math.round(n * scale)));

  return (
    <FieldWrap label={field.label} hint={field.hint} error={error}>
      {field.display === "input" ? (
        <NumberBox
          label={field.label}
          value={shown}
          unit={field.unit}
          invalid={Boolean(error)}
          onChange={write}
        />
      ) : (
        <Stepper
          value={shown}
          min={field.min / scale}
          max={field.max / scale}
          step={(field.step ?? 1) / scale}
          unit={field.unit}
          onChange={write}
        />
      )}
    </FieldWrap>
  );
}
