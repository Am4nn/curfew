"use client";

import { useMemo, useState, useTransition } from "react";
import type { ControlsState, PendingChange } from "@/server/controls";
import { saveControlsAction } from "./actions";
import {
  settingConsequence,
  retentionConsequence,
  typeConsequence,
  type Consequence,
} from "./consequences";

// Nothing here saves on the flip (decision 56). A changed switch is marked
// unsaved, a bar offers Discard or a red Save, and Save opens a sheet built
// from the pending changes with the consequences of each one.

type Draft = {
  settings: Record<string, unknown>;
  types: Record<string, boolean>;
};

const APP_SWITCHES: { key: string; label: string; hint: string }[] = [
  {
    key: "money",
    label: "Money",
    hint: "Off hides money everywhere except groups you switch on by hand under Groups.",
  },
  {
    key: "photo_evidence",
    label: "Photo evidence",
    hint: "Off means no type can ask for a photo. Existing photos are untouched.",
  },
  {
    key: "new_groups",
    label: "New groups",
    hint: "Off stops anyone creating a group. Existing ones carry on.",
  },
  {
    key: "invites",
    label: "Invites",
    hint: "Off stops every invite going out. Nobody new can join.",
  },
  {
    key: "signups",
    label: "Sign-ups",
    hint: "Off means an approved invite is the only way in.",
  },
];

const UNSAVED = (
  <span className="border border-penalty px-[6px] py-px text-[9.5px] tracking-[0.1em] text-penalty">
    UNSAVED
  </span>
);

function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={
        "flex h-[22px] w-[38px] flex-none items-center border p-[2px] disabled:opacity-40 " +
        (on ? "justify-end border-fg bg-fg" : "justify-start border-rule bg-transparent")
      }
    >
      <span className={"h-[16px] w-[16px] " + (on ? "bg-bg" : "bg-muted")} />
    </button>
  );
}

export function ControlsForm({
  state,
  writable,
}: {
  state: ControlsState;
  writable: boolean;
}) {
  const initial: Draft = useMemo(
    () => ({
      settings: { ...state.settings },
      types: Object.fromEntries(state.types.map((t) => [t.key, t.enabled])),
    }),
    [state],
  );

  const [draft, setDraft] = useState<Draft>(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notify, setNotify] = useState(false);
  const [noticeBody, setNoticeBody] = useState("");
  const [pending, startTransition] = useTransition();

  const changes: PendingChange[] = useMemo(() => {
    const out: PendingChange[] = [];
    for (const [key, value] of Object.entries(draft.settings)) {
      if (value !== initial.settings[key]) out.push({ kind: "setting", key, value });
    }
    for (const [key, value] of Object.entries(draft.types)) {
      if (value !== initial.types[key]) out.push({ kind: "type", key, value });
    }
    return out;
  }, [draft, initial]);

  const consequences: Consequence[] = useMemo(
    () =>
      changes.map((change) => {
        if (change.kind === "type") {
          const type = state.types.find((t) => t.key === change.key);
          return typeConsequence(
            type?.name ?? change.key,
            change.value === true,
            type?.tracking ?? 0,
          );
        }
        if (change.key === "retention_days") {
          return retentionConsequence(
            Number(change.value),
            Number(initial.settings.retention_days),
          );
        }
        return settingConsequence(change.key, change.value);
      }),
    [changes, state.types, initial.settings.retention_days],
  );

  const changed = (kind: "setting" | "type", key: string) =>
    changes.some((c) => c.kind === kind && c.key === key);

  function save() {
    startTransition(async () => {
      await saveControlsAction({ changes, notify, noticeBody });
      setSheetOpen(false);
      setNotify(false);
      setNoticeBody("");
    });
  }

  const retention = Number(draft.settings.retention_days ?? 30);

  return (
    <div className="flex flex-col gap-8 pb-28">
      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">THE APP</span>
        <div className="flex flex-col">
          {APP_SWITCHES.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center gap-3 border-b border-rule py-[13px]">
              <div className="flex flex-1 flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px]">{label}</span>
                  {changed("setting", key) ? UNSAVED : null}
                </div>
                <span className="text-[10.5px] leading-[1.5] text-muted">{hint}</span>
              </div>
              <Toggle
                label={label}
                on={draft.settings[key] === true}
                disabled={!writable}
                onChange={(next) =>
                  setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: next } }))
                }
              />
            </div>
          ))}
        </div>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          A switch here takes effect at once and never deletes anything. Turning money off
          hides it; turning it back on brings the same balances back.
        </span>
      </section>

      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">ACTIVITY TYPES</span>
        <div className="flex flex-col">
          {state.types.map((type) => (
            <div
              key={type.key}
              className="flex items-center gap-3 border-b border-rule py-[11px]"
            >
              <div className="flex flex-1 flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-[13.5px] " + (draft.types[type.key] ? "text-fg" : "text-muted")
                    }
                  >
                    {type.name}
                  </span>
                  {changed("type", type.key) ? UNSAVED : null}
                </div>
                <span className="text-[10.5px] text-muted">{type.tracking} tracking</span>
              </div>
              <Toggle
                label={type.name}
                on={draft.types[type.key] === true}
                disabled={!writable}
                onChange={(next) =>
                  setDraft((d) => ({ ...d, types: { ...d.types, [type.key]: next } }))
                }
              />
            </div>
          ))}
        </div>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          Off hides a type from the catalog. Anyone already tracking it keeps it. The list
          is every type the app has: adding one is a code change, not a setting.
        </span>
      </section>

      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">EVIDENCE</span>
        <div className="flex items-center gap-3 border-b border-rule py-[13px]">
          <div className="flex flex-1 items-center gap-2">
            <span className="text-[13.5px]">Retention</span>
            {changed("setting", "retention_days") ? UNSAVED : null}
          </div>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Fewer days"
              disabled={!writable || retention <= 1}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  settings: { ...d.settings, retention_days: retention - 1 },
                }))
              }
              className="h-[34px] w-[34px] border border-rule text-[15px] disabled:opacity-40"
            >
              -
            </button>
            <span className="min-w-[74px] border-y border-rule px-3 py-[7px] text-center text-[13px]">
              {retention} days
            </span>
            <button
              type="button"
              aria-label="More days"
              disabled={!writable || retention >= 365}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  settings: { ...d.settings, retention_days: retention + 1 },
                }))
              }
              className="h-[34px] w-[34px] border border-rule text-[15px] disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <span className="text-[11.5px] leading-[1.55] text-muted">
          Shortening this deletes anything already older on the next sweep.
        </span>
      </section>

      {changes.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-[10px] border-t border-rule bg-surface px-5 py-[13px]">
          <span className="flex-1 text-[11.5px] text-muted">
            {changes.length} unsaved {changes.length === 1 ? "change" : "changes"}
          </span>
          <button
            type="button"
            onClick={() => setDraft(initial)}
            className="h-[38px] border border-rule px-[15px] text-[12.5px]"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="h-[38px] border border-penalty bg-penalty px-[15px] text-[12.5px] font-semibold text-bg"
          >
            Save
          </button>
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-bg/85">
          <div className="flex max-h-[85vh] w-full flex-col border-t border-penalty bg-bg">
            <div className="px-5 pb-[6px] pt-5">
              <span className="text-[16px] font-semibold">
                Save {changes.length} {changes.length === 1 ? "change" : "changes"}?
              </span>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-5">
              {consequences.map((c) => (
                <div key={c.name} className="flex flex-col gap-2 border-t border-rule py-[14px]">
                  <div className="flex items-center gap-[9px]">
                    <span className="text-[13.5px]">{c.name}</span>
                    <span
                      className={
                        "border px-[6px] py-px text-[9.5px] tracking-[0.1em] " +
                        (c.state === "on"
                          ? "border-pass text-pass"
                          : "border-penalty text-penalty")
                      }
                    >
                      {c.state.toUpperCase()}
                    </span>
                  </div>
                  {c.lines.map((line) => (
                    <div key={line} className="flex gap-[9px]">
                      <span className="text-[11px] leading-[1.65] text-muted">&bull;</span>
                      <span className="flex-1 text-[12px] leading-[1.6] text-muted">{line}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-rule px-5 pb-5 pt-[14px]">
              <label className="flex items-start gap-[10px]">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="mt-[2px] h-[15px] w-[15px] flex-none accent-fg"
                />
                <span className="text-[12.5px]">Tell users what changed</span>
              </label>

              {notify ? (
                <textarea
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  rows={3}
                  placeholder="Money is off. Your balances are kept and come back if it returns."
                  className="w-full border border-rule bg-transparent p-[10px] text-[12.5px] leading-[1.5] text-fg placeholder:text-muted"
                />
              ) : null}

              <span className="text-[11px] leading-[1.55] text-muted">
                A switch hides a system. Nothing here deletes data, and switching back
                restores what was hidden.
              </span>

              <div className="flex gap-[10px]">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="h-[46px] flex-1 border border-rule text-[13.5px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || (notify && noticeBody.trim().length === 0)}
                  className="h-[46px] flex-1 border border-penalty bg-penalty text-[13.5px] font-semibold text-bg disabled:opacity-50"
                >
                  {pending ? "Saving" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
