import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { ownPhotos } from "@/server/own-photos";
import { RETENTION_DAYS } from "@/server/evidence";
import { PhotoGrid } from "../../photo-tile";

// Every photograph a person has taken, newest first. Read-only on purpose:
// deleting stays on one screen, /settings/data, so there is one place where
// something goes for good.
export default async function OwnPhotosPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const photos = await ownPhotos(user.id);

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <Link href="/settings" className="text-[14px] text-muted">
          &lsaquo;
        </Link>
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
            <p className="text-[11.5px] leading-[1.55] text-muted">
              {photos.length} {photos.length === 1 ? "photo" : "photos"}. Each one is
              deleted {RETENTION_DAYS} days after it was taken. Delete one sooner on
              the delete data screen.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
