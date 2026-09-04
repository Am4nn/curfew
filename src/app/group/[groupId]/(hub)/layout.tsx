import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { groupHeader } from "@/server/group-view";
import { GroupTabs } from "./group-tabs";
import { BackLink } from "@/app/back-link";

// The hub: one line for the group, four tabs under it, nothing competing.
// Membership is checked here as well as in every query behind it (invariant 10).
export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const header = await groupHeader(groupId, user.id).catch(() => null);
  if (!header) notFound();

  return (
    <main className="min-h-dvh pb-24">
      <div className="flex items-center gap-[10px] px-5 pb-[15px] pt-5">
        <BackLink fallback="/groups" className="text-[15px] text-muted" />
        <span className="text-[16px] font-semibold">{header.name}</span>
      </div>
      <GroupTabs groupId={groupId} />
      {children}
    </main>
  );
}
