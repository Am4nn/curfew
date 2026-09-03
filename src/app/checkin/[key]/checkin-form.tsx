"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getActivityType, type ConfigField } from "@/domain";
import type { ActivityCheckinState, CheckinStepView } from "@/server/checkin";
import { compressFile, type Compressed } from "@/lib/compress";
import { Camera } from "./camera";
import { checkInAction } from "./actions";

// One check-in screen, twelve types. The photo slot, the fields, the question
// and the words under them all come from the module (decision 90).
//
// The hint is asked of the module here, in the browser, as the number is typed
// (decision 91): that is what turns "1180 so far today" into "1700 of 2000 once
// this is sent" without a second implementation of the same sentence.

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

// Empty and waiting, or the frame with a red cross to remove it.
function PhotoSlot({
  required,
  shot,
  onOpen,
  onRemove,
}: {
  required: boolean;
  shot: Compressed | null;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.14em] text-muted">PHOTO</span>
        <span
          className={
            "text-[11px] " + (required && !shot ? "text-penalty" : "text-muted")
          }
        >
          {required ? "required" : "optional"}
        </span>
      </div>

      {shot ? (
        <div className="relative h-[186px] border border-rule bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.url}
            alt="The photo you attached"
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove the photo"
            className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center bg-penalty text-[13px] leading-none text-bg"
          >
            &#10005;
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className={
            "flex h-[186px] w-full flex-col items-center justify-center gap-[9px] border border-dashed bg-surface text-muted " +
            (required ? "border-penalty" : "border-dash")
          }
        >
          <CameraIcon />
          <span className="text-[12.5px]">Take a photo</span>
        </button>
      )}
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
  const [shot, setShot] = useState<Compressed | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const missing = step.fields.filter(
    (f) => f.kind === "number" && (values[f.key] ?? "") === "",
  );
  // Required means required ON THIS STEP: sleep asks on confirm and nowhere
  // else.
  const photoRequired =
    state.evidence.level === "required" &&
    (state.evidence.steps === undefined || state.evidence.steps.includes(step.key));
  const takesPhoto = state.evidence.level !== "none";
  const gallery = state.evidence.source === "gallery";
  const canSend = missing.length === 0 && (!photoRequired || shot !== null);
  const busy = sending || pending;

  const evidenceRule = getActivityType(state.typeKey).evidence;
  const compression = {
    maxEdge: evidenceRule.maxEdge ?? 1280,
    quality: evidenceRule.quality ?? 0.75,
  };

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

  /**
   * Upload the photo, then record the check-in. That order is the point
   * (decision 71): a file with no check-in is an orphan and is swept, and a
   * check-in that needs a photo never exists without one.
   */
  async function send(evidence: Record<string, unknown>) {
    setError(null);
    setSending(true);
    const idem = newIdem();

    try {
      let evidenceKey: string | undefined;

      if (shot) {
        const ticket = await fetch("/api/evidence/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            typeKey: state.typeKey,
            step: step.key,
            idem,
            contentType: shot.contentType,
            bytes: shot.blob.size,
          }),
        });
        const body = (await ticket.json().catch(() => ({}))) as {
          ok?: boolean;
          url?: string;
          objectKey?: string;
          message?: string;
        };
        if (!ticket.ok || !body.url || !body.objectKey) {
          setError(body.message ?? "That upload could not start.");
          return;
        }

        const put = await fetch(body.url, {
          method: "PUT",
          headers: { "content-type": shot.contentType },
          body: shot.blob,
        });
        if (!put.ok) {
          setError("The photo did not upload. Try again.");
          return;
        }
        evidenceKey = body.objectKey;
      }

      const result = await checkInAction({
        typeKey: state.typeKey,
        step: step.key,
        idem,
        note: note.trim() === "" ? undefined : note.trim(),
        evidenceKey,
        evidence,
      });
      if (result.ok) {
        startTransition(() => {
          router.push(`/activities/${state.typeKey}`);
          router.refresh();
        });
        return;
      }
      setError(result.message);
    } catch {
      setError("Network failed. Nothing was recorded.");
    } finally {
      setSending(false);
    }
  }

  async function pickFromGallery(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressFile(file, compression);
      if (shot) URL.revokeObjectURL(shot.url);
      setShot(compressed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be read.");
    }
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
            disabled={busy}
            onClick={() => send({ held: true })}
            className="h-[52px] w-full border border-fg bg-fg text-[15px] font-semibold text-bg disabled:opacity-60"
          >
            It held
          </button>
          <button
            type="button"
            disabled={busy}
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

  const needsPhoto = photoRequired && shot === null;
  const blocked =
    needsPhoto && missing.length > 0
      ? `Take the photo and enter the ${missing[0].label.toLowerCase()} to send this check-in.`
      : needsPhoto
        ? "Take the photo to send this check-in."
        : missing.length > 0
          ? `Enter the ${missing[0].label.toLowerCase()} to send this check-in.`
          : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-6 pt-[18px]">
      {takesPhoto ? (
        <PhotoSlot
          required={photoRequired}
          shot={shot}
          onOpen={() => (gallery ? fileRef.current?.click() : setCameraOpen(true))}
          onRemove={() => {
            if (shot) URL.revokeObjectURL(shot.url);
            setShot(null);
          }}
        />
      ) : null}

      {gallery ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickFromGallery(e.target.files?.[0])}
        />
      ) : null}

      {cameraOpen ? (
        <Camera
          title={`${state.name.toUpperCase()} \u00b7 ${step.label.toUpperCase()}`}
          closesLabel={step.closesLabel}
          nowLabel={state.nowLabel}
          maxEdge={compression.maxEdge}
          quality={compression.quality}
          onClose={() => setCameraOpen(false)}
          onUse={(taken) => {
            if (shot) URL.revokeObjectURL(shot.url);
            setShot(taken);
            setCameraOpen(false);
          }}
        />
      ) : null}

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

      {/* Your own line, never scored. */}
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
          disabled={!canSend || busy}
          onClick={sendFields}
          className={
            "h-[46px] flex-[1.6] border text-[13.5px] " +
            (canSend
              ? "border-fg bg-fg font-semibold text-bg"
              : "cursor-not-allowed border-rule bg-transparent text-muted")
          }
        >
          {busy ? "Sending" : "Send"}
        </button>
      </div>
    </div>
  );
}

// The one flame outside Home.
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
