"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { ok?: boolean; error?: string; note?: string };
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

// Submit button that reflects the form's pending state: disabled and relabelled
// while the server action runs, so every action gives feedback.
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={(className ?? "") + (pending ? " opacity-60" : "")}
    >
      {pending ? (pendingLabel ?? children) : children}
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

// Destructive action: a red button that opens a confirmation modal before it
// submits. Used for leave, decline, reject and any other irreversible action.
export function ConfirmButton({
  action,
  fields,
  label,
  message,
  confirmLabel = "Confirm",
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  message: string;
  confirmLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <form action={formAction}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-penalty px-3 py-[6px] text-[13px] text-penalty"
      >
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
            <p className="text-[14px]">{message}</p>
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
              <SubmitButton
                pendingLabel="Working"
                className="border border-penalty bg-penalty px-3 py-[8px] text-[13px] text-bg"
              >
                {confirmLabel}
              </SubmitButton>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
