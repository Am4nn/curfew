import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType, formatMoney } from "@/domain";
import { deletionSummary, typesWithHistory } from "@/server/deletion";
import { ownPhotos } from "@/server/own-photos";
import { DeleteForm, type HistoryRow } from "./delete-form";
import { BackLink } from "@/app/back-link";

/** One page of the delete picker. Mirrors /settings/photos.
 *  Not exported: Next allows a page file to export only its own known keys,
 *  and anything else fails the build's generated types. */
const PHOTO_PAGE = 30;

export default async function DeleteDataPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [summary, types, singlePhotos] = await Promise.all([
    deletionSummary(user.id),
    typesWithHistory(user.id),
    // The picker shows a page at a time and asks the server for more, so this
    // never signs a few hundred URLs to fill a sheet nobody scrolls to the
    // end of. `summary.photos` is the real total, and the sheet says so.
    ownPhotos(user.id, { limit: PHOTO_PAGE }),
  ]);

  const activities: HistoryRow[] = types.map((key) => {
    const type = getActivityType(key);
    return { typeKey: key, name: type.name, icon: type.icon };
  });

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <BackLink fallback="/settings" className="text-[14px] text-muted" />
        <span className="text-[14px] font-semibold tracking-[0.14em]">DELETE DATA</span>
      </header>

      <DeleteForm
        photos={summary.photos}
        singlePhotos={singlePhotos}
        totalPhotos={summary.photos}
        activities={activities}
        outstanding={summary.outstanding.map(
          (o) => `${formatMoney(o.amount, o.currency)} in ${o.groupName}`,
        )}
      />
    </main>
  );
}
