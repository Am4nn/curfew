"use client";

import { useMemo, useState, useTransition } from "react";
import type { ControlsState, PendingChange } from "@/server/controls";
import { saveControlsAction } from "./actions";
import { Toggle as SharedToggle } from "@/app/ui";
import {
  settingConsequence,
  retentionConsequence,
  typeConsequence,
  noticeFrom,
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
  <span className="border border-penalty px-1.5 py-px text-micro tracking-wider text-penalty">
    UNSAVED
  </span>
);

// The shared switch, with this screen's onChange shape. Admin controls are a
// batched draft behind an explicit Save, so these never touch the server on
// press and take no pending state.
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
  return <SharedToggle on={on} disabled={disabled} label={label} onClick={() => onChange(!on)} />;
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

  const [saving, startTransition] = useTransition();

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
      // The notice is the sheet's own words, so a user reads exactly what the
      // admin was shown before they saved.
      await saveControlsAction({ changes, notify, notice: noticeFrom(consequences) });
      setSheetOpen(false);
      setNotify(false);
    });
  }

  const retention = Number(draft.settings.retention_days ?? 30);

  return (
    <div className="flex flex-col gap-8 pb-28">
      <section className="flex flex-col gap-2.5">
        <span className="text-micro tracking-label text-muted">THE APP</span>
        <div className="flex flex-col">
          {APP_SWITCHES.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center gap-3 border-b border-rule py-3">
              <div className="flex flex-1 flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{label}</span>
                  {changed("setting", key) ? UNSAVED : null}
                </div>
                <span className="text-micro leading-relaxed text-muted">{hint}</span>
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
        <span className="text-2xs leading-relaxed text-muted">
          A switch here takes effect at once and never deletes anything. Turning money off
          hides it; turning it back on brings the same balances back.
        </span>
      </section>

      <section className="flex flex-col gap-2.5">
        <span className="text-micro tracking-label text-muted">ACTIVITY TYPES</span>
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
                      "text-sm " + (draft.types[type.key] ? "text-fg" : "text-muted")
                    }
                  >
                    {type.name}
                  </span>
                  {changed("type", type.key) ? UNSAVED : null}
                </div>
                <span className="text-micro text-muted">{type.tracking} tracking</span>
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
        <span className="text-2xs leading-relaxed text-muted">
          Off hides a type from the catalog. Anyone already tracking it keeps it. The list
          is every type the app has: adding one is a code change, not a setting.
        </span>
      </section>

      <section className="flex flex-col gap-2.5">
        <span className="text-micro tracking-label text-muted">EVIDENCE</span>
        <div className="flex items-center gap-3 border-b border-rule py-3">
          <div className="flex flex-1 items-center gap-2">
            <span className="text-sm">Retention</span>
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
              className="h-[34px] w-[34px] border border-rule text-base disabled:opacity-40"
            >
              -
            </button>
            <span className="min-w-[74px] border-y border-rule px-3 py-[7px] text-center text-sm">
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
              className="h-[34px] w-[34px] border border-rule text-base disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <span className="text-2xs leading-relaxed text-muted">
          Shortening this deletes anything already older on the next sweep.
        </span>
      </section>

      {changes.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-rule bg-surface px-5 py-3">
          <span className="flex-1 text-2xs text-muted">
            {changes.length} unsaved {changes.length === 1 ? "change" : "changes"}
          </span>
          <button
            type="button"
            onClick={() => setDraft(initial)}
            className="h-[38px] border border-rule px-[15px] text-xs"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="h-[38px] border border-penalty bg-penalty px-[15px] text-xs font-semibold text-bg"
          >
            Save
          </button>
        </div>
      ) : null}

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "var(--scrim-85)" }}
        >
          <div className="flex max-h-[85vh] w-full flex-col border-t border-penalty bg-bg">
            <div className="px-5 pb-1.5 pt-5">
              <span className="text-lg font-semibold">
                Save {changes.length} {changes.length === 1 ? "change" : "changes"}?
              </span>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-5">
              {consequences.map((c) => (
                <div key={c.name} className="flex flex-col gap-2 border-t border-rule py-3.5">
                  <div className="flex items-center gap-[9px]">
                    <span className="text-sm">{c.name}</span>
                    <span
                      className={
                        "border px-1.5 py-px text-micro tracking-wider " +
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
                      <span className="text-2xs leading-loose text-muted">&bull;</span>
                      <span className="flex-1 text-xs leading-relaxed text-muted">{line}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-rule px-5 pb-5 pt-3.5">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="mt-0.5 h-[15px] w-[15px] flex-none accent-fg"
                />
                <span className="text-xs">Tell users what changed</span>
              </label>

              <span className="text-2xs leading-relaxed text-muted">
                A switch hides a system. Nothing here deletes data, and switching back
                restores what was hidden.
              </span>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="h-[46px] flex-1 border border-rule text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="h-[46px] flex-1 border border-penalty bg-penalty text-sm font-semibold text-bg disabled:opacity-50"
                >
                  {saving ? "Saving" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
