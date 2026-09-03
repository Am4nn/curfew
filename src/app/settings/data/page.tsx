import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType, formatMoney } from "@/domain";
import { deletionSummary, typesWithHistory } from "@/server/deletion";
import { listOwnPhotos, readUrl } from "@/server/evidence";
import { DeleteForm, type HistoryRow, type PhotoRow } from "./delete-form";

export default async function DeleteDataPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [summary, types, ownPhotos] = await Promise.all([
    deletionSummary(user.id),
    typesWithHistory(user.id),
    listOwnPhotos(user.id),
  ]);

  const activities: HistoryRow[] = types.map((key) => {
    const type = getActivityType(key);
    return { typeKey: key, name: type.name, icon: type.icon };
  });

  // A presign failure (a stale key, a storage outage) must not take down the
  // whole delete-data screen over one bad photo; skip it, the nightly sweep
  // and the bulk-delete rows below are unaffected either way.
  const singlePhotos: PhotoRow[] = [];
  for (const p of ownPhotos) {
    try {
      const type = getActivityType(p.typeKey);
      singlePhotos.push({
        id: p.id,
        url: readUrl(p.objectKey),
        typeKey: p.typeKey,
        name: type.name,
        icon: type.icon,
        date: DateTime.fromISO(p.periodStart).toFormat("d LLL"),
      });
    } catch {
      // Skip it.
    }
  }

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <Link href="/settings" className="text-[14px] text-muted">
          &lsaquo;
        </Link>
        <span className="text-[14px] font-semibold tracking-[0.14em]">DELETE DATA</span>
      </header>

      <DeleteForm
        photos={summary.photos}
        singlePhotos={singlePhotos}
        activities={activities}
        outstanding={summary.outstanding.map(
          (o) => `${formatMoney(o.amount, o.currency)} in ${o.groupName}`,
        )}
      />
    </main>
  );
}
