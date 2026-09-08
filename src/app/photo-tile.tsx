"use client";

import { useState } from "react";
import type { SignedPhoto } from "@/server/own-photos";
import { ActivityIcon } from "./activity-icon";
import { PhotoViewer } from "./photo-viewer";

// One photograph as it appears anywhere a person looks at their own: the
// square, then what it was for and when. Delete-data wraps it in a button of
// its own, so the tile itself stays a plain block and the grid is what makes
// them openable.

export function PhotoTile({
  photo,
  showType = true,
}: {
  photo: SignedPhoto;
  /** Off in a strip that is already one activity, where the name repeats. */
  showType?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[6px] text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={`${photo.name}, ${photo.date}`}
        className="aspect-square w-full border border-rule bg-surface object-cover"
      />
      {showType ? (
        <span className="flex items-center gap-[5px] text-[10px] text-muted">
          <ActivityIcon name={photo.icon} size={11} />
          {photo.name}
        </span>
      ) : null}
      <span className="text-[10px] text-muted">{photo.date}</span>
    </div>
  );
}

/**
 * The grid, and the only way to see a photograph whole.
 *
 * The tiles are cropped squares, which is right for a grid and wrong for a
 * photograph taken on a phone, so each one opens. Before this there was no way
 * to see the rest of any picture in the app.
 */
export function PhotoGrid({
  photos,
  cols = 3,
  showType = true,
}: {
  photos: SignedPhoto[];
  cols?: 2 | 3;
  showType?: boolean;
}) {
  const [at, setAt] = useState<number | null>(null);

  return (
    <>
      <div className={"grid gap-3 " + (cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setAt(i)}
            aria-label={`Open ${p.name}, ${p.date}`}
            className="text-left active:opacity-70"
          >
            <PhotoTile photo={p} showType={showType} />
          </button>
        ))}
      </div>
      <PhotoViewer
        photos={photos.map((p) => ({
          url: p.url,
          alt: `${p.name}, ${p.date}`,
          caption: `${p.name} · ${p.date}`,
        }))}
        at={at}
        onClose={() => setAt(null)}
        onMove={setAt}
      />
    </>
  );
}
