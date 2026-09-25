"use client";

import { useState } from "react";
import type { SignedPhoto } from "@/server/own-photos";
import { ActivityIcon } from "./activity-icon";
import { PhotoViewer } from "./photo-viewer";

// Your Photos, as a list rather than a grid (item 15, mock V32Photos).
//
// The grid is right for a wall of squares and wrong for the question this
// screen exists to answer: where did this photograph go. A group name does not
// fit under a third of a phone's width, and a struck-through one has to be
// readable or it says nothing.
//
// Nothing here is a control. Where a photograph went was decided at the
// check-in that sent it and cannot be changed afterwards, which is why the
// check-in screen says nothing about groups and this screen has no toggles.
export function PhotoRows({ photos }: { photos: SignedPhoto[] }) {
  const [at, setAt] = useState<number | null>(null);

  return (
    <>
      <div className="flex flex-col">
        {photos.map((p, i) => (
          <div key={p.id} className="flex gap-3 border-b border-rule py-3.5">
            <button
              type="button"
              onClick={() => setAt(i)}
              aria-label={`Open ${p.name}, ${p.when ?? p.date}`}
              className="flex-none active:opacity-70"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`${p.name}, ${p.when ?? p.date}`}
                className="h-[62px] w-[62px] border border-rule bg-surface object-cover"
              />
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <div className="flex items-center gap-2">
                <ActivityIcon name={p.icon} size={14} />
                <span className="text-sm">{p.name}</span>
                <span className="ml-auto flex-none text-micro text-muted">
                  {p.when ?? p.date}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {p.tags && p.tags.length > 0 ? (
                  p.tags.map((t) => (
                    <span
                      key={t.groupId}
                      className={
                        "border px-2 py-[3px] text-micro " +
                        (t.revoked
                          ? "border-rule text-muted line-through"
                          : "border-dash text-fg")
                      }
                    >
                      {t.name}
                    </span>
                  ))
                ) : (
                  <span className="text-micro text-dash">Yours only</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <PhotoViewer
        photos={photos.map((p) => ({
          url: p.url,
          alt: `${p.name}, ${p.when ?? p.date}`,
          caption: `${p.name} · ${p.when ?? p.date}`,
        }))}
        at={at}
        onClose={() => setAt(null)}
        onMove={setAt}
      />
    </>
  );
}
