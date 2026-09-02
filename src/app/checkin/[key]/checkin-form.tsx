"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getActivityType, type ConfigField } from "@/domain";
import type { ActivityCheckinState, CheckinStepView } from "@/server/checkin";
import { checkInAction } from "./actions";

// ONE check-in screen, twelve types. The photo slot, the fields, the question
// and the words under it all come from the module (decision 90); this file only
// draws them. Artboards: V3Checkin, V3CheckinRequired, V3CheckinReady,
// V3CheckinAbstain.
//
// The module is asked for its hint here, in the browser, as the number is
// typed (decision 91). That is what turns "1180 so far today. The limit is
// 2000." into "1700 of 2000 once this is sent." with one implementation
// instead of two.

function newIdem(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function CameraIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="14" />
      <path d="M8 6l1.5-2h5L16 6" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

// The photo slot. Phase 5 replaces the placeholder with the camera and the
// upload; the slot states the type's rule now so the screen is honest about it.
function PhotoSlot({ required }: { required: boolean }) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.14em] text-muted">PHOTO</span>
        <span className={"text-[11px] " + (required ? "text-penalty" : "text-muted")}>
          {required ? "required" : "optional"}
        </span>
      </div>
      <div
        className={
          "flex h-[186px] flex-col items-center justify-center gap-[9px] border border-dashed bg-surface text-muted " +
          (required ? "border-penalty" : "border-dash")
        }
      >
        <CameraIcon />
        <span className="text-[12.5px]">Photos arrive in the next release</span>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  hint,
  required,
}: {
  field: ConfigField;
  value: string;
  onChange: (next: string) => void;
  hint: string | null;
  required: boolean;
}) {
  if (field.kind !== "number") return null;
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-[11px] tracking-[0.06em] text-muted">{field.label}</span>
      <div
        className={
          "flex items-center justify-between gap-[10px] border bg-bg px-3 py-[11px] " +
          (required && value === "" ? "border-penalty" : "border-rule")
        }
      >
        <input
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value}
          placeholder="Required"
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-muted"
        />
        {field.unit ? (
          <span className="text-[12px] text-muted">{field.unit}</span>
        ) : null}
      </div>
      {hint ? (
        <span className="text-[11px] leading-[1.5] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

export function CheckinForm({
  state,
  step,
  streak,
}: {
  state: ActivityCheckinState;
  step: CheckinStepView;
  streak: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = step.fields.filter(
    (f) => f.kind === "number" && (values[f.key] ?? "") === "",
  );
  const photoRequired = state.evidence.level === "required";
  const canSend = missing.length === 0;

  // The module's own line, recomputed as the number is typed.
  const hints = useMemo(() => {
    const type = getActivityType(state.typeKey);
    if (!type.hint) return {} as Record<string, string | null>;
    const pendingEvidence: Record<string, number> = {};
    for (const field of step.fields) {
      if (field.kind !== "number") continue;
      const raw = values[field.key];
      if (raw !== undefined && raw !== "") pendingEvidence[field.key] = Number(raw);
    }
    const line = type.hint({
      periodStart: state.period,
      timezone: state.timezone,
      config: state.config,
      checkins: state.recorded.map((r) => ({
        step: r.step,
        at: new Date(r.at),
        evidence: r.evidence,
      })),
      step: step.key,
      pending: Object.keys(pendingEvidence).length > 0 ? pendingEvidence : null,
    });
    return { [step.key]: line } as Record<string, string | null>;
  }, [state, step, values]);

  function send(evidence: Record<string, unknown>) {
    setError(null);
    const idem = newIdem();
    startTransition(async () => {
      const result = await checkInAction({
        typeKey: state.typeKey,
        step: step.key,
        idem,
        note: note.trim() === "" ? undefined : note.trim(),
        evidence,
      });
      if (result.ok) {
        router.push(`/activities/${state.typeKey}`);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  function sendFields() {
    const evidence: Record<string, unknown> = {};
    for (const field of step.fields) {
      if (field.kind !== "number") continue;
      evidence[field.key] = Number(values[field.key]);
    }
    send(evidence);
  }

  // The abstinence board: a question, two answers, the streak it moves, and
  // what a slip costs. No photo, because absence cannot be photographed.
  if (step.prompt) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-6 pt-[18px]">
        <div className="flex flex-col gap-2">
          <span className="text-[16px] leading-[1.5]">{step.prompt}</span>
          {step.aside ? (
            <span className="text-[11.5px] leading-[1.55] text-muted">{step.aside}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-[10px]">
          <button
            type="button"
            disabled={pending}
            onClick={() => send({ held: true })}
            className="h-[52px] w-full border border-fg bg-fg text-[15px] font-semibold text-bg disabled:opacity-60"
          >
            It held
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => send({ held: false })}
            className="h-[52px] w-full border border-rule bg-transparent text-[15px] text-penalty disabled:opacity-60"
          >
            I slipped
          </button>
        </div>

        <div className="flex items-center justify-between border-y border-rule py-3">
          <span className="text-[12.5px] text-muted">Current streak</span>
          <StreakBadge value={streak} />
        </div>

        {error ? (
          <p className="text-[11px] leading-[1.5] text-penalty">{error}</p>
        ) : null}

        <div className="flex-1" />

        {step.consequence ? (
          <div className="border-l-[3px] border-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
            {step.consequence}
          </div>
        ) : null}
      </div>
    );
  }

  const blocked = photoRequired
    ? missing.length > 0
      ? `Take the photo and enter the ${missing[0].label.toLowerCase()} to send this check-in.`
      : "Take the photo to send this check-in."
    : missing.length > 0
      ? `Enter the ${missing[0].label.toLowerCase()} to send this check-in.`
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-6 pt-[18px]">
      {state.evidence.level === "none" ? null : (
        <PhotoSlot required={photoRequired} />
      )}

      {step.fields.map((field) => (
        <Field
          key={field.kind === "number" ? field.key : field.label}
          field={field}
          value={field.kind === "number" ? (values[field.key] ?? "") : ""}
          onChange={(next) =>
            field.kind === "number"
              ? setValues((v) => ({ ...v, [field.key]: next }))
              : undefined
          }
          hint={hints[step.key] ?? step.hint}
          required={photoRequired}
        />
      ))}

      {/* Your own line, for your own record. Never scored, never shown to a
          group unless you share the check-in itself. */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[11px] tracking-[0.06em] text-muted">Note</span>
        <div className="flex items-center justify-between gap-[10px] border border-rule bg-bg px-3 py-[11px]">
          <input
            type="text"
            maxLength={200}
            value={note}
            placeholder="Optional"
            aria-label="Note"
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-muted"
          />
        </div>
      </div>

      {step.fields.length === 0 && step.hint ? (
        <span className="text-[11px] leading-[1.5] text-muted">{step.hint}</span>
      ) : null}

      <div className="flex-1" />

      {error ? (
        <span className="text-[11px] leading-[1.5] text-penalty">{error}</span>
      ) : blocked ? (
        <span className="text-[11px] leading-[1.5] text-penalty">{blocked}</span>
      ) : null}

      <div className="flex gap-[10px]">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-[46px] flex-1 border border-rule bg-transparent text-[13.5px] text-penalty"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={!canSend || pending}
          onClick={sendFields}
          className={
            "h-[46px] flex-[1.6] border text-[13.5px] " +
            (canSend
              ? "border-fg bg-fg font-semibold text-bg"
              : "cursor-not-allowed border-rule bg-transparent text-muted")
          }
        >
          {pending ? "Sending" : "Send"}
        </button>
      </div>
    </div>
  );
}

// The one flame in the app outside Home, at the size the artboard uses.
function StreakBadge({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1">
      <svg width="13" height="13" viewBox="0 0 24 24" className="flex-none" aria-hidden="true">
        <defs>
          <linearGradient id="checkin-flame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffc24b" />
            <stop offset="55%" stopColor="#ff7a2f" />
            <stop offset="100%" stopColor="#e4574b" />
          </linearGradient>
        </defs>
        <path
          d="M12 2c2.5 3.5 4.6 5.6 4.6 9.1a4.6 4.6 0 0 1-9.2 0c0-1.5.5-2.6 1.5-3.7C10.4 8.6 12 6.1 12 2Z"
          fill="url(#checkin-flame)"
        />
        <path
          d="M12 12.4c1 .9 1.6 1.7 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-.8.5-1.6 1.6-2.8Z"
          fill="#ffe6a1"
        />
      </svg>
      <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-[12px] font-medium leading-none text-transparent tabular-nums">
        {value}
      </span>
    </span>
  );
}
