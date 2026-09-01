import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { getGroupName, listGroupMembersDetailed } from "@/server/groups";
import { GroupTabs } from "./group-tabs";

// The group hub frame: header, role, and the four sub-tabs. Every tab page
// re-guards with assertMember; the layout guards too so a non-member never sees
// the chrome.
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

  try {
    await assertMember(groupId, user.id);
  } catch {
    notFound();
  }

  const [name, members] = await Promise.all([
    getGroupName(groupId),
    listGroupMembersDetailed(groupId),
  ]);
  if (!name) notFound();

  const role = members.find((m) => m.userId === user.id)?.role ?? "member";

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto max-w-[560px]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/groups" className="flex items-center gap-2 text-[16px] font-semibold tracking-[0.06em]">
            <span className="text-[13px] text-muted">‹</span>
            {name}
          </Link>
          <span className="text-[11px] text-muted">{role}</span>
        </div>
        <GroupTabs groupId={groupId} />
        <div className="pt-[18px]">{children}</div>
      </div>
    </main>
  );
}
