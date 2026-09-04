"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

export type FormState = { ok?: boolean; error?: string; note?: string };
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

// ---------------------------------------------------------------------------
// The button. One component, because the house style was hand-written about
// fifteen times across the app with three different disabled opacities and no
// pressed state at all, so half the controls looked identical whether you had
// touched them or not.
//
// Every button that reaches the server takes `pending`. While it is true the
// button is disabled, announces itself busy, and says what it is doing.
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "destructive" | "quiet";
export type ButtonSize = "lg" | "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "border border-fg bg-fg font-semibold text-bg",
  secondary: "border border-rule text-fg",
  destructive: "border border-rule text-penalty",
  quiet: "text-fg",
};

const SIZE: Record<ButtonSize, string> = {
  lg: "h-11 px-4 text-[14px]",
  md: "h-[38px] px-3 text-[13px]",
  sm: "h-[30px] px-[10px] text-[11.5px]",
};

// `active:` is the whole point of the pressed state: a press that is waiting on
// a round trip has to look different from one that never registered.
const BASE =
  "inline-flex items-center justify-center whitespace-nowrap active:opacity-70 " +
  "disabled:opacity-40 disabled:active:opacity-40";

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "lg",
  extra?: string,
): string {
  return [BASE, VARIANT[variant], SIZE[size], extra ?? ""].join(" ").trim();
}

export function Button({
  children,
  variant = "secondary",
  size = "lg",
  full,
  pending,
  pendingLabel,
  className,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  pending?: boolean;
  pendingLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass(variant, size, [full ? "w-full" : "", className ?? ""].join(" "))}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}

// Submit button that reflects the form's pending state: disabled and relabelled
// while the server action runs, so every action gives feedback. Callers that
// pass `className` keep their own styling; the rest get the house one.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size,
  full,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={
        className
          ? className + " active:opacity-70 disabled:opacity-40" + (pending ? " opacity-60" : "")
          : buttonClass(variant, size, full ? "w-full" : "")
      }
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}

/**
 * Everything a control that talks to the server has to do, in one place:
 * run it inside a transition so `pending` stays true until the new server
 * render actually lands, refresh, and catch the failure as a string rather
 * than an unhandled rejection.
 *
 * This block was copy-pasted into five files with small differences, and in
 * two of them the pending flag was discarded entirely, which is why half the
 * app looked identical whether you had pressed it or not.
 */
export function useServerAction(): {
  run: (fn: () => Promise<void>) => void;
  pending: boolean;
  error: string | null;
  clearError: () => void;
} {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (fn: () => Promise<void>) => {
      setError(null);
      startTransition(async () => {
        try {
          await fn();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "That did not save.");
        }
      });
    },
    [router],
  );

  return { run, pending, error, clearError: () => setError(null) };
}

/**
 * A button that calls the server and reports on itself. Press it and it
 * disables, relabels, refreshes when the action lands, and renders the failure
 * underneath. The caller supplies the async function and nothing else.
 *
 * Use this for one-off actions. A group of controls that share one pending
 * state (a settings screen, a row of chips) should take `useServerAction()`
 * once and pass `pending` down instead.
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  onDone,
  ...rest
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  pendingLabel?: string;
  /** Called after the action resolves, for closing a menu or clearing a draft. */
  onDone?: () => void;
} & Omit<React.ComponentProps<typeof Button>, "pending" | "onClick">) {
  const { run, pending, error } = useServerAction();
  return (
    <span className="flex flex-col gap-2">
      <Button
        {...rest}
        pending={pending}
        pendingLabel={pendingLabel}
        onClick={() =>
          run(async () => {
            await action();
            onDone?.();
          })
        }
      >
        {children}
      </Button>
      {error ? <span className="text-[11.5px] text-penalty">{error}</span> : null}
    </span>
  );
}

/**
 * A checkbox with its label as one press target. Was hand-rolled identically
 * in both sharing surfaces.
 */
export function CheckRow({
  on,
  onClick,
  children,
  disabled,
  className,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={
        "flex items-center gap-[9px] active:opacity-70 disabled:opacity-40 " + (className ?? "")
      }
    >
      <span
        className={
          "flex h-4 w-4 flex-none items-center justify-center border " +
          (on ? "border-fg bg-fg" : "border-rule")
        }
      >
        {on ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--bg)"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M4 12.5 9 17.5 20 6.5" />
          </svg>
        ) : null}
      </span>
      <span className={"text-[12px] " + (on ? "text-fg" : "text-muted")}>{children}</span>
    </button>
  );
}

/**
 * The switch. Was copied verbatim into four files, only two of which accepted
 * `disabled` and none of which showed anything while the server answered.
 */
export function Toggle({
  on,
  onClick,
  disabled,
  pending,
  label,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled}
      onClick={onClick}
      className={
        "flex h-[22px] w-10 flex-none items-center p-[2px] active:opacity-70 disabled:opacity-40 " +
        (on ? "justify-end border border-fg bg-fg" : "justify-start border border-rule")
      }
    >
      <span className={"h-4 w-4 " + (on ? "bg-bg" : "bg-muted")} />
    </button>
  );
}

// A touch-friendly inline explanation. The marker itself toggles the content,
// and a separate close control makes dismissal explicit on small screens.
export function InfoHint({ children, label = "More information" }: {
  children: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="ml-2 inline-flex h-4 w-4 items-center justify-center border border-muted text-[11px] leading-none text-muted"
      >
        i
      </button>
      {open ? (
        <span
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-6 z-10 w-72 border border-fg bg-bg p-3 text-left text-[12px] font-normal leading-5 tracking-normal text-fg shadow-none"
        >
          <span className="block">{children}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 border border-fg px-2 py-1 text-[11px]"
          >
            Close
          </button>
        </span>
      ) : null}
    </span>
  );
}
// A form wired to a server action that returns { error } instead of throwing,
// so validation and failures render inline rather than crashing the route.
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <ActionFormInner
      state={state}
      formAction={formAction}
      className={className}
      resetOnSuccess={resetOnSuccess}
    >
      {children}
    </ActionFormInner>
  );
}

function ActionFormInner({
  state,
  formAction,
  children,
  className,
  resetOnSuccess,
}: {
  state: FormState;
  formAction: (fd: FormData) => void;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok && formEl) formEl.reset();
  }, [state, resetOnSuccess, formEl]);
  return (
    <form ref={setFormEl} action={formAction} className={className}>
      {children}
      {state.error ? (
        <p className="mt-2 text-[13px] text-penalty">{state.error}</p>
      ) : null}
      {state.note ? (
        <p className="mt-2 whitespace-pre-wrap text-[13px] text-pass">{state.note}</p>
      ) : null}
    </form>
  );
}

// An action gated behind a confirmation modal. `danger` (the default) is red,
// for leave, decline, reject and other irreversible removals. `neutral` is the
// house filled style, for significant but non-destructive actions like adding
// an owner.
export function ConfirmButton({
  action,
  fields,
  label,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "neutral";
}) {
  const [state, formAction] = useActionState(action, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const triggerClass =
    tone === "danger"
      ? "border border-penalty px-3 py-[6px] text-[13px] text-penalty"
      : "border border-rule px-3 py-[6px] text-[13px]";
  const confirmClass =
    tone === "danger"
      ? "border border-penalty bg-penalty px-3 py-[8px] text-[13px] text-bg"
      : "border border-fg bg-fg px-3 py-[8px] text-[13px] text-bg";

  return (
    <form action={formAction}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[360px] border border-fg bg-bg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[14px] leading-relaxed">{message}</p>
            {state.error ? (
              <p className="mt-2 text-[13px] text-penalty">{state.error}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-fg px-3 py-[8px] text-[13px]"
              >
                Cancel
              </button>
              <SubmitButton pendingLabel="Working" className={confirmClass}>
                {confirmLabel}
              </SubmitButton>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
