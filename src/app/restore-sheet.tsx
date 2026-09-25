"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActivityIcon, DeadFlame, RestoreIcon } from "./activity-icon";
import { restoreStreakAction } from "./grace-actions";

// The press, and the sheet behind it (items 19 and 20, mock V32GraceOffer).
//
// The same sheet whether it came from Home or from the grace screen, because it
// is the same decision. Four facts and nothing that is not one: what comes
// back, what it costs against what you have, how long the offer lasts, and the
// thing somebody would otherwise get wrong, which is that the fine and the
// standing do not move. An earlier draft wrote a sentence about each and read
// as an essay in front of somebody who wants to press a button.
//
// Nothing here decides anything. The cost and the number coming back are the
// server's, worked out from the same walk that drew the row, and the press
// re-reads both before it writes.

export interface RestoreOfferView {
  typeKey: string;
  name: string;
  icon: string;
  cost: number;
  restoresTo: number;
  /** Grace left before this is spent. */
  left: number;
}

export function RestoreButton({
  offer,
  variant = "outline",
}: {
  offer: RestoreOfferView;
  /** Outline beside a Check in; filled where it is the only thing to press. */
  variant?: "outline" | "filled";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Restore your ${offer.name} streak`}
        className={
          "flex h-[34px] flex-none items-center gap-[5px] border border-flame px-2.5 text-xs active:opacity-70 " +
          (variant === "filled" ? "bg-flame font-semibold text-bg" : "text-flame")
        }
      >
        <RestoreIcon />
        Restore
      </button>
      {open ? <RestoreSheet offer={offer} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RestoreSheet({
  offer,
  onClose,
}: {
  offer: RestoreOfferView;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div
      className="scrim-in fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "var(--scrim)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Restore ${offer.name} streak`}
    >
      <div className="flex w-full flex-col gap-3.5 border-t border-rule bg-bg px-5 pb-[22px] pt-[18px]">
        <span className="text-lg leading-normal">Restore {offer.name} streak</span>

        {/* Whose streak this is, said once, because the sheet can be opened
            from a screen listing several. */}
        <div className="flex items-center gap-[9px]">
          <ActivityIcon name={offer.icon} size={17} />
          <span className="text-sm">{offer.name}</span>
        </div>

        {/* The number coming back, beside what it costs. The flame is out here
            and relights on the row behind once the press lands, which is the
            whole proposition in one image. */}
        <div className="flex items-center gap-4 border-b border-rule pb-3.5">
          <span className="flex items-center gap-[7px]">
            <DeadFlame size={24} />
            <span className="text-2xl leading-none text-muted tabular-nums">
              {offer.restoresTo}
            </span>
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs">
              {offer.cost === 1 ? "One day short" : `${offer.cost} days short`}
            </span>
            <span className="text-2xs text-muted">
              {offer.cost} of your {offer.left} grace
            </span>
          </div>
        </div>

        <span className="self-start border border-flame px-1.5 py-px text-micro tracking-wider text-flame">
          OPEN UNTIL YOU NEXT CHECK IN
        </span>
        <span className="text-2xs text-muted">Fine and standing do not change.</span>

        {error ? (
          <span className="text-2xs leading-relaxed text-penalty">{error}</span>
        ) : null}

        <div className="mt-0.5 flex flex-col gap-[9px]">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await restoreStreakAction(offer.typeKey);
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                onClose();
                router.refresh();
              })
            }
            className="h-[46px] w-full border border-flame bg-flame text-base font-semibold text-bg active:opacity-70 disabled:opacity-40"
          >
            {pending ? "Restoring" : `Use ${offer.cost} grace`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-[46px] w-full border border-rule text-base active:opacity-70 disabled:opacity-40"
          >
            Let it go
          </button>
        </div>
      </div>
    </div>
  );
}
