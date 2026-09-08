"use client";

import { useEffect } from "react";

/**
 * One photograph, whole.
 *
 * Every photo in the app was drawn as a square with `object-cover`, which
 * crops a phone photograph to its middle, and none of them could be opened.
 * A meal you photographed and a session somebody else photographed were both
 * shown at 100 pixels and there was nowhere else to see them.
 *
 * An overlay rather than a route, because it is a closer look at something
 * already on screen and not a place to arrive at: nothing links to a photograph
 * and nothing should, since the address would outlive the sharing that allowed
 * it. Escape closes it, the arrows move through the set, and the tile behind it
 * stays where it was, so closing puts you back where you were looking.
 *
 * No actions on it. Deleting your own lives on the photos and delete-data
 * screens, reporting somebody else's lives on the evidence row, and both are
 * one press from here. A viewer that could do either would be the third place
 * to do both.
 */

export interface ViewedPhoto {
  url: string;
  /** What it is, for the screen reader and for the caption's first line. */
  alt: string;
  /** The line under it: who, what, when, in the caller's own words. */
  caption: string;
}

export function PhotoViewer({
  photos,
  at,
  onClose,
  onMove,
}: {
  photos: ViewedPhoto[];
  /** Index into `photos`, or null when nothing is open. */
  at: number | null;
  onClose: () => void;
  onMove: (next: number) => void;
}) {
  const open = at !== null && at >= 0 && at < photos.length;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && at !== null && at > 0) onMove(at - 1);
      if (e.key === "ArrowRight" && at !== null && at < photos.length - 1) {
        onMove(at + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, at, photos.length, onClose, onMove]);

  if (!open) return null;
  const photo = photos[at];
  const first = at === 0;
  const last = at === photos.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      // Opaque, not a wash. At 95% the evidence tab read through the
      // photograph and the whole thing looked like a mistake rather than a
      // screen. Nothing in this app is translucent.
      className="fixed inset-0 z-50 flex flex-col bg-bg"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-[11px]">
        <span className="truncate text-[11.5px] text-muted">{photo.caption}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[30px] flex-none items-center border border-rule px-[11px] text-[11.5px] text-fg active:opacity-70"
        >
          Close
        </button>
      </div>

      {/* Everything between the two bars, and no padding: a margin around a
          photograph is space taken from the photograph. `object-contain`
          scales it to the largest it fits at its own shape, so nothing is
          cropped and nothing is stretched. What is left over on one axis is
          the difference between the picture's shape and the screen's, which is
          the only spacing there is. */}
      <div className="min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.alt}
          className="h-full w-full object-contain"
        />
      </div>

      {photos.length > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-[11px]">
          <button
            type="button"
            disabled={first}
            onClick={() => onMove(at - 1)}
            className="flex h-[30px] items-center border border-rule px-[11px] text-[11.5px] text-fg disabled:opacity-40 active:opacity-70"
          >
            &lsaquo; Previous
          </button>
          <span className="text-[11px] tabular-nums text-muted">
            {at + 1} of {photos.length}
          </span>
          <button
            type="button"
            disabled={last}
            onClick={() => onMove(at + 1)}
            className="flex h-[30px] items-center border border-rule px-[11px] text-[11.5px] text-fg disabled:opacity-40 active:opacity-70"
          >
            Next &rsaquo;
          </button>
        </div>
      ) : null}
    </div>
  );
}
