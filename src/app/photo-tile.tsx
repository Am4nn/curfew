import type { SignedPhoto } from "@/server/own-photos";
import { ActivityIcon } from "./activity-icon";

// One photograph as it appears anywhere a person looks at their own: the
// square, then what it was for and when. Delete-data wraps it in a button,
// Stats and Photos do not.

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

export function PhotoGrid({
  photos,
  cols = 3,
  showType = true,
}: {
  photos: SignedPhoto[];
  cols?: 2 | 3;
  showType?: boolean;
}) {
  return (
    <div className={"grid gap-3 " + (cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {photos.map((p) => (
        <PhotoTile key={p.id} photo={p} showType={showType} />
      ))}
    </div>
  );
}
