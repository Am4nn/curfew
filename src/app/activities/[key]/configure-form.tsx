"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getActivityType,
  scheduleConfigSchema,
  type ConfigField,
  type EvidenceRule,
  type ScheduleConfig,
  type Schedule,
  type FieldIssue,
} from "@/domain";
import { CameraIcon, StreakNumber } from "../../activity-icon";
import { saveActivityAction, stopTrackingAction } from "./actions";

// One configure screen, twelve types. Five controls, drawn from the module's
// declared fields (decision 88): a day picker, a stepper, a typed box, a
// segmented switch and a time range. Days, grace and "changes apply from" are
// the engine's, because they mean the same thing for every type.

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

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

function Note({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "pass" | "penalty" }) {
  const border =
    tone === "pass" ? "border-l-pass" : tone === "penalty" ? "border-l-penalty" : "border-l-accent";
  return (
    <div
      className={
        "border-l-[3px] bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] " +
        border +
        (tone === "penalty" ? " text-penalty" : " text-muted")
      }
    >
      {children}
    </div>
  );
}

// --- the screen ------------------------------------------------------------

export function ConfigureForm({
  typeKey,
  name,
  description,
  initialSchedule,
  initialConfig,
  tracked,
  streak,
  best,
  graceLeft,
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
  graceLeft: number | null;
  returnTo?: string;
}) {
  const type = getActivityType(typeKey);
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleConfig>(initialSchedule);
  const [config, setConfig] = useState<unknown>(initialConfig);
  const [saved, setSaved] = useState({ schedule: initialSchedule, config: initialConfig });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    JSON.stringify({ schedule, config }) !== JSON.stringify(saved);

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
  if (schedule.grace > 31) {
    issues.push({ path: "@grace", message: "Grace cannot be more than the days in a month." });
  }
  const errorFor = (path: string) => issues.find((i) => i.path === path)?.message;
  const valid = issues.length === 0;

  const fields = parsedConfig.success
    ? type.fields(parsedConfig.data)
    : type.fields(type.defaults.config);

  const isMinimum = schedule.schedule.kind === "minimum";
  const days = schedule.schedule.kind === "days" ? schedule.schedule.days : [];

  function setSchedulePart(next: Schedule) {
    setSchedule((s) => ({ ...s, schedule: next }));
  }

  function save(share?: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveActivityAction({ typeKey, schedule, config, returnTo, share });
        setSaved({ schedule, config });
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

  return (
    <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-6 pt-[18px]">
      {tracked ? (
        <div className="flex items-center justify-between gap-3">
          <StreakNumber value={streak} />
          <span className="text-[11px] text-muted">days &middot; best {best}</span>
        </div>
      ) : (
        <p className="text-[12.5px] leading-[1.6] text-muted">
          {description}. These are the defaults.
        </p>
      )}

      {type.facts?.map((fact) => (
        <Fact key={fact.title} title={fact.title} sub={fact.sub} />
      ))}

      <FieldWrap label="Days">
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
                    setSchedulePart({
                      kind: "days",
                      days: next.length === 0 ? [day] : next,
                    });
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
        </div>
      </FieldWrap>

      {fields.map((field) => (
        <ModuleField
          key={field.kind === "timeRange" ? field.label : field.key}
          field={field}
          config={config}
          error={
            field.kind === "timeRange"
              ? errorFor(field.openKey)
              : errorFor(field.key)
          }
          onChange={setConfig}
        />
      ))}

      <FieldWrap
        label="Grace"
        hint={
          graceLeft === null
            ? undefined
            : `${graceLeft} left this month.`
        }
        error={errorFor("@grace")}
      >
        <Stepper
          value={schedule.grace}
          min={0}
          max={31}
          unit="per month"
          onChange={(n) => setSchedule((s) => ({ ...s, grace: n }))}
        />
      </FieldWrap>

      <EvidenceFact rule={type.evidence} />

      {type.note ? <Note>{type.note}</Note> : null}

      <p className="text-[11.5px] leading-[1.55] text-muted">
        {tracked
          ? schedule.schedule.kind === "minimum"
            ? "Changes apply from Monday."
            : "Changes apply from tomorrow."
          : "A new activity does not move your reputation for 7 days."}
      </p>

      {error ? <Note tone="penalty">{error}</Note> : null}

      {!valid && dirty ? (
        <Note tone="penalty">
          {issues.length === 1
            ? "One thing needs fixing before this can be saved."
            : `${issues.length} things need fixing before this can be saved.`}
        </Note>
      ) : null}

      {/* Nothing pending: only the way out. Changed: Save, dead until valid. */}
      {!tracked ? (
        <div className="flex flex-col gap-[10px]">
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
        </div>
      ) : dirty ? (
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
          {pending ? "Saving" : "Save"}
        </button>
      ) : (
        <form action={stopTrackingAction.bind(null, typeKey)}>
          <button
            type="submit"
            className="h-11 w-full border border-rule text-[14px] text-penalty"
          >
            Stop tracking {name}
          </button>
        </form>
      )}
    </div>
  );
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
  if (field.kind === "timeRange") {
    return (
      <FieldWrap label={field.label} hint={field.hint} error={error}>
        <div className="flex items-center gap-[9px]">
          <TimeBox
            label={`${field.label} opens`}
            value={String(get(config, field.openKey) ?? "")}
            invalid={Boolean(error)}
            onChange={(v) => onChange(set(config, field.openKey, v))}
          />
          <span className="text-[11px] text-muted">to</span>
          <TimeBox
            label={`${field.label} closes`}
            value={String(get(config, field.closeKey) ?? "")}
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
            value={String(get(config, field.key) ?? "")}
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
          value={String(get(config, field.key) ?? "")}
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
