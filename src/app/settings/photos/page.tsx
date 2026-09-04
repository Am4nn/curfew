import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { ownPhotos, countOwnPhotos } from "@/server/own-photos";
import { RETENTION_DAYS } from "@/server/evidence";
import { PhotoGrid } from "../../photo-tile";
import { BackLink } from "@/app/back-link";

// One page of photographs. The group evidence tab loads twenty and offers the
// rest; this loaded every photo a person had ever taken, which is a few hundred
// signed URLs and an unbounded scroll on a screen nobody scrolls to the end of.
const PAGE = 30;

// Every photograph a person has taken, newest first. Read-only on purpose:
// deleting stays on one screen, /settings/data, so there is one place where
// something goes for good.
export default async function OwnPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  // One number from the query string, clamped. A hand-edited `?show=999999`
  // must not turn this into the unbounded page it used to be.
  const asked = Number((await searchParams).show);
  const limit = Number.isFinite(asked)
    ? Math.min(Math.max(Math.trunc(asked), PAGE), PAGE * 20)
    : PAGE;

  const [photos, total] = await Promise.all([
    ownPhotos(user.id, { limit }),
    countOwnPhotos(user.id),
  ]);
  const more = total - photos.length;

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <BackLink fallback="/settings" className="text-[14px] text-muted" />
        <span className="text-[14px] font-semibold tracking-[0.14em]">YOUR PHOTOS</span>
      </header>

      <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
        {photos.length === 0 ? (
          <p className="text-[12.5px] leading-[1.6] text-muted">
            No photos yet. Activities that ask for one keep it here.
          </p>
        ) : (
          <>
            <PhotoGrid photos={photos} />

            {more > 0 ? (
              <Link
                href={`/settings/photos?show=${limit + PAGE}`}
                className="flex h-11 w-full items-center justify-center border border-rule text-[14px] active:opacity-70"
              >
                Load older
              </Link>
            ) : null}

            <p className="text-[11.5px] leading-[1.55] text-muted">
              {more > 0
                ? `${photos.length} of ${total} photos.`
                : `${total} ${total === 1 ? "photo" : "photos"}.`}{" "}
              Each one is deleted {RETENTION_DAYS} days after it was taken. Delete one
              sooner on the delete data screen.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
