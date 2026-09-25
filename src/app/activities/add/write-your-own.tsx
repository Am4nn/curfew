"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LABEL_MAX } from "@/domain";
import { ActivityIcon } from "../../activity-icon";
import { writeCondition } from "./actions";

// "Write your own" (1.19). The list is ours plus yours, and this is the door
// to yours.
//
// It sits at the bottom of the catalog, under our five, because somebody
// looking for a condition looks through what exists before writing one. It
// opens in place rather than on its own screen: naming a thing is one field,
// and a screen for one field is a screen.
export function WriteYourOwn() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  // C7. Something you DO, or something you AVOID. An abstinence has no
  // moment to repeat, so it cannot form a habit the way a thing you do
  // can, and the two get different screens. Asked rather than guessed:
  // nothing can read "no doomscroll" reliably.
  const [kind, setKind] = useState<"do" | "avoid" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = label.trim();

  function save() {
    setError(null);
    startTransition(async () => {
      if (!kind) return;
      const result = await writeCondition(trimmed, kind);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Straight to its configure screen. It is already tracked at the
      // module's defaults, so this is where the confirm window is set, and
      // landing back on the catalog would leave somebody wondering whether it
      // had worked.
      router.push(`/activities/${result.typeKey}`);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 border-b border-rule py-3.5 text-left"
      >
        <span className="flex flex-none">
          <ActivityIcon name="condition" size={20} />
        </span>
        <div className="flex flex-1 flex-col gap-[3px]">
          <span className="text-base">Write your own</span>
          <span className="text-2xs leading-normal text-muted">
            A yes or no you name yourself
          </span>
        </div>
        <span className="flex-none text-lg leading-none">+</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 border-b border-rule py-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-2xs tracking-caps text-muted">
          WHAT ARE YOU CALLING IT
        </span>
        <input
          type="text"
          value={label}
          autoFocus
          maxLength={LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="No doomscroll"
          className="h-11 w-full border border-rule bg-transparent px-3 text-base text-fg outline-none placeholder:text-muted"
        />
      </label>

      <fieldset className="flex flex-col gap-1.5 border-0 p-0">
        <legend className="text-2xs tracking-caps text-muted">
          WHICH IS IT
        </legend>
        <div className="flex gap-2.5 pt-1.5">
          {(
            [
              ["do", "Something I do"],
              ["avoid", "Something I avoid"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={
                "h-10 flex-1 border text-sm " +
                (kind === value ? "border-fg bg-fg text-bg" : "border-rule text-fg")
              }
            >
              {text}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Said here rather than after the fact, because it is the one thing
          about a condition somebody writes that is different from ours, and
          finding out later that it counted toward nothing would read as a
          bug. */}
      <p className="text-2xs leading-relaxed text-muted">
        It keeps its own streak and you confirm it once a day, the same as any
        other. It does not count toward Monk mode: nothing can know what you
        meant by it.
      </p>

      {error ? <p className="text-2xs text-penalty">{error}</p> : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={trimmed.length === 0 || kind === null || pending}
          className="h-11 flex-1 border border-fg bg-fg text-base font-semibold text-bg disabled:opacity-40"
        >
          {pending ? "Saving" : "Add it"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setLabel("");
            setError(null);
          }}
          disabled={pending}
          className="h-11 flex-1 border border-rule text-base disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
