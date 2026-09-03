import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType, formatMoney } from "@/domain";
import { deletionSummary, typesWithHistory } from "@/server/deletion";
import { DeleteForm, type HistoryRow } from "./delete-form";

export default async function DeleteDataPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [summary, types] = await Promise.all([
    deletionSummary(user.id),
    typesWithHistory(user.id),
  ]);

  const activities: HistoryRow[] = types.map((key) => {
    const type = getActivityType(key);
    return { typeKey: key, name: type.name, icon: type.icon };
  });

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
        activities={activities}
        outstanding={summary.outstanding.map(
          (o) => `${formatMoney(o.amount, o.currency)} in ${o.groupName}`,
        )}
      />
    </main>
  );
}
