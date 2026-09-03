import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType } from "@/domain";
import { listUserGroups } from "@/server/groups";
import { acceptedTypes, sharesFor } from "@/server/sharing";
import { standingFor } from "@/server/standing";
import { SharingForm, type GroupShares } from "./sharing-form";

// Every group, every accepted type, in one place. The same two toggles as the
// group's own settings tab, and they mean the same thing here (decision 16).
export default async function SharingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const groups = await listUserGroups(user.id);
  const blocks: GroupShares[] = [];

  for (const g of groups) {
    const [accepted, shares] = await Promise.all([
      acceptedTypes(g.groupId),
      sharesFor(g.groupId, user.id),
    ]);
    const byKey = new Map(shares.map((s) => [s.typeKey, s]));

    const rows = [];
    for (const a of accepted) {
      const type = getActivityType(a.typeKey);
      const share = byKey.get(a.typeKey);
      const shared = share?.shared === true;
      const standing = shared ? await standingFor(user.id, a.typeKey) : null;
      rows.push({
        typeKey: a.typeKey,
        name: a.name,
        icon: a.icon,
        shared,
        shareEvidence: share?.shareEvidence === true,
        takesEvidence: type.evidence.level !== "none",
        sub: shared ? `${standing?.streak ?? 0} day streak` : "private here",
      });
    }

    blocks.push({ groupId: g.groupId, groupName: g.name, rows });
  }

  return (
    <main className="min-h-dvh pb-24">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <Link href="/settings" className="text-[14px] text-muted">
          &lsaquo;
        </Link>
        <span className="text-[14px] font-semibold tracking-[0.14em]">
          WHAT YOU SHARE
        </span>
      </header>

      <SharingForm blocks={blocks} />
    </main>
  );
}
