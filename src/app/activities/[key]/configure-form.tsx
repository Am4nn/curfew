"use client";

import { useState, useTransition } from "react";
import type { ConfigField, EvidenceRule } from "@/domain";
import type { ScheduleConfig, Schedule } from "@/domain";
import { saveActivityAction, stopTrackingAction } from "./actions";

// ONE configure screen, twelve types. Nothing here knows what any type means:
// the schedule comes from the engine's own model (decision 79) and the rest is
// drawn from the module's declared fields (decision 88). Adding a type adds no
// code to this file, which is the whole point of the declarative model.

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

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] tracking-[0.16em] text-muted">{children}</span>;
}

// The schedule control: a day row with an ANY cell that turns it into a minimum
// a week (decision 55). One control, not two fields, because "days that count"
// and "minimum a week" are the same decision asked twice.
function ScheduleControl({
  value,
  onChange,
}: {
  value: Schedule;
  onChange: (next: Schedule) => void;
}) {
  const isMinimum = value.kind === "minimum";
  const days = value.kind === "days" ? value.days : [];

  return (
    <div className="flex flex-col gap-[10px]">
      <Label>WHICH DAYS</Label>
      <div className="flex gap-[6px]">
        {DAY_LABELS.map((label, i) => {
          const day = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
          const on = !isMinimum && days.includes(day);
          return (
            <button
              key={i}
              type="button"
              aria-label={`Day ${day}`}
              aria-pressed={on}
              onClick={() => {
                const next = on ? days.filter((d) => d !== day) : [...days, day].sort();
                onChange(next.length === 0 ? { kind: "days", days: [day] } : { kind: "days", days: next });
              }}
              className={
                "h-[38px] flex-1 border text-[12px] " +
                (on ? "border-fg bg-fg font-semibold text-bg" : "border-rule text-muted")
              }
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={isMinimum}
          onClick={() =>
            onChange(isMinimum ? { kind: "days", days: [1, 2, 3, 4, 5, 6, 7] } : { kind: "minimum", perWeek: 3 })
          }
          className={
            "h-[38px] flex-[1.4] border text-[11px] tracking-[0.08em] " +
            (isMinimum ? "border-fg bg-fg font-semibold text-bg" : "border-rule text-muted")
          }
        >
          ANY
        </button>
      </div>

      {isMinimum ? (
        <div className="flex items-center gap-3">
          <span className="flex-1 text-[13px]">Minimum a week</span>
          <Stepper
            value={value.perWeek}
            min={1}
            max={7}
            step={1}
            unit="days"
            onChange={(n) => onChange({ kind: "minimum", perWeek: n })}
          />
        </div>
      ) : (
        <span className="text-[11px] leading-[1.55] text-muted">
          Only the days you pick can add to a streak or break it. The rest are skipped.
        </span>
      )}
    </div>
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
    <div className="flex items-center">
      <button
        type="button"
        aria-label="Less"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="h-[34px] w-[34px] border border-rule text-[15px] disabled:opacity-40"
      >
        -
      </button>
      <span className="min-w-[92px] border-y border-rule px-3 py-[7px] text-center text-[13px] tabular-nums">
        {value.toLocaleString()}
        {unit ? ` ${unit}` : ""}
      </span>
      <button
        type="button"
        aria-label="More"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="h-[34px] w-[34px] border border-rule text-[15px] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function FieldControl({
  field,
  config,
  onChange,
}: {
  field: ConfigField;
  config: unknown;
  onChange: (next: unknown) => void;
}) {
  if (field.kind === "timeRange") {
    return (
      <div className="flex items-center gap-3 border-b border-rule py-[13px]">
        <span className="flex-1 text-[13px]">{field.label}</span>
        <input
          type="time"
          value={String(get(config, field.openKey) ?? "")}
          onChange={(e) => onChange(set(config, field.openKey, e.target.value))}
          className="border border-rule bg-transparent px-2 py-[6px] text-[13px] text-fg"
        />
        <span className="text-[12px] text-muted">to</span>
        <input
          type="time"
          value={String(get(config, field.closeKey) ?? "")}
          onChange={(e) => onChange(set(config, field.closeKey, e.target.value))}
          className="border border-rule bg-transparent px-2 py-[6px] text-[13px] text-fg"
        />
      </div>
    );
  }

  if (field.kind === "segmented") {
    const current = String(get(config, field.key) ?? "");
    return (
      <div className="flex items-center gap-3 border-b border-rule py-[13px]">
        <span className="flex-1 text-[13px]">{field.label}</span>
        <div className="flex">
          {field.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(set(config, field.key, option.value))}
              className={
                "h-[34px] border px-3 text-[12.5px] " +
                (current === option.value
                  ? "border-fg bg-fg font-semibold text-bg"
                  : "border-rule text-muted")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const raw = get(config, field.key);
  const off = raw === null || raw === undefined;

  return (
    <div className="flex items-center gap-3 border-b border-rule py-[13px]">
      <span className="flex-1 text-[13px]">{field.label}</span>
      {field.nullable ? (
        <button
          type="button"
          onClick={() =>
            onChange(set(config, field.key, off ? field.min : null))
          }
          className={
            "h-[34px] border px-3 text-[11.5px] " +
            (off ? "border-fg bg-fg font-semibold text-bg" : "border-rule text-muted")
          }
        >
          {field.offLabel ?? "Off"}
        </button>
      ) : null}
      {off ? null : (
        <Stepper
          value={Number(raw)}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          unit={field.unit}
          onChange={(n) => onChange(set(config, field.key, n))}
        />
      )}
    </div>
  );
}

// Evidence is a FACT, never a control (decision 6). The type fixes it, so the
// screen states the rule and does not offer to change it.
function evidenceLine(rule: EvidenceRule): string {
  if (rule.level === "none") return "No photo. Nothing here can be proved by one.";
  const where = rule.steps?.length
    ? ` on ${rule.steps.join(", ")}`
    : "";
  const source =
    rule.source === "gallery"
      ? "Taken in the app, or picked from your gallery."
      : "Taken in the app, live. No gallery.";
  return rule.level === "required"
    ? `Photo required${where}. ${source}`
    : `Photo optional${where}. ${source}`;
}

export function ConfigureForm({
  typeKey,
  name,
  description,
  evidence,
  fields,
  initialSchedule,
  initialConfig,
  tracked,
  streak,
}: {
  typeKey: string;
  name: string;
  description: string;
  evidence: EvidenceRule;
  fields: ConfigField[];
  initialSchedule: ScheduleConfig;
  initialConfig: unknown;
  tracked: boolean;
  streak: number;
}) {
  const [schedule, setSchedule] = useState<ScheduleConfig>(initialSchedule);
  const [config, setConfig] = useState<unknown>(initialConfig);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveActivityAction({ typeKey, schedule, config });
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not save.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-7 pb-28">
      <header className="flex flex-col gap-1">
        <h1 className="text-[19px] font-semibold">{name}</h1>
        <span className="text-[12px] text-muted">{description}</span>
        {tracked ? (
          <span className="mt-2 text-[13px] text-muted">
            <span className="text-[22px] font-semibold text-fg tabular-nums">{streak}</span>{" "}
            {streak === 1 ? "day" : "days"}
          </span>
        ) : null}
      </header>

      <ScheduleControl
        value={schedule.schedule}
        onChange={(next) => setSchedule((s) => ({ ...s, schedule: next }))}
      />

      {fields.length > 0 ? (
        <section className="flex flex-col gap-[10px]">
          <Label>SETTINGS</Label>
          <div className="flex flex-col">
            {fields.map((field) => (
              <FieldControl
                key={field.kind === "timeRange" ? field.label : field.key}
                field={field}
                config={config}
                onChange={setConfig}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-[10px]">
        <Label>GRACE</Label>
        <div className="flex items-center gap-3 border-b border-rule py-[13px]">
          <span className="flex-1 text-[13px]">Misses forgiven a month</span>
          <Stepper
            value={schedule.grace}
            min={0}
            max={10}
            unit={schedule.grace === 1 ? "miss" : "misses"}
            onChange={(n) => setSchedule((s) => ({ ...s, grace: n }))}
          />
        </div>
        <span className="text-[11px] leading-[1.55] text-muted">
          Grace protects the streak only. The fine still applies and reputation still
          dips. Unused grace does not carry over.
        </span>
      </section>

      <section className="flex flex-col gap-[8px]">
        <Label>EVIDENCE</Label>
        <span className="text-[12px] leading-[1.6] text-muted">
          {evidenceLine(evidence)}
        </span>
        <span className="text-[11px] leading-[1.55] text-muted">
          Set by the type, not by you, so the same streak means the same thing for
          everyone in a group.
        </span>
      </section>

      {error ? (
        <p className="border border-penalty px-3 py-2 text-[12px] text-penalty">{error}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-[10px] border-t border-rule bg-surface px-5 py-[13px]">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-[46px] flex-1 border border-fg bg-fg text-[13.5px] font-semibold text-bg disabled:opacity-50"
        >
          {pending ? "Saving" : tracked ? "Save" : "Start tracking"}
        </button>
        {tracked ? (
          <form action={stopTrackingAction.bind(null, typeKey)}>
            <button
              type="submit"
              className="h-[46px] border border-rule px-4 text-[13px] text-muted"
            >
              Stop
            </button>
          </form>
        ) : null}
      </div>

      {tracked ? (
        <span className="text-[11px] leading-[1.55] text-muted">
          Changes land at the start of tomorrow, so today is judged by what you agreed to
          this morning. Stopping keeps your history and freezes the streak; starting again
          resumes from zero.
        </span>
      ) : null}
    </div>
  );
}
