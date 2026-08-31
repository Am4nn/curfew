"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { ok?: boolean; error?: string };
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
