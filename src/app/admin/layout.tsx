import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getCapabilities, hasAdminAccess } from "@/server/admin";
import type { Capability } from "@/lib/capabilities";
import { QuorumMark } from "../mark";
import { AdminNav } from "./admin-nav";
import { APP_VERSION } from "@/lib/version";

// Order matches the mocks (V3Admin*.dc.html): Overview, Users, Groups,
// Insights, Controls, Ops. Reports has no mock of its own (Phase 9 built it
// after the design set was drawn), so it goes last rather than displacing
// any of the six the screens were actually reviewed against.
const TABS: [string, string, Capability | null][] = [
  ["/admin", "Overview", null],
  ["/admin/users", "Users", "users.view"],
  ["/admin/groups", "Groups", "groups.view"],
  ["/admin/insights", "Insights", "insights.view"],
  ["/admin/controls", "Controls", "settings.view"],
  ["/admin/ops", "Ops", "ops.score"],
  ["/admin/reports", "Reports", "users.disable"],
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  if (!(await hasAdminAccess(user.id))) redirect("/");

  const caps = new Set(await getCapabilities(user.id));
  const tabs = TABS.filter(([, , cap]) => cap === null || caps.has(cap));

  return (
    <main className="min-h-dvh px-5 pb-20 pt-5">
      <div className="mx-auto max-w-[720px]">
        <header className="mb-[15px] flex items-center gap-[9px]">
          <QuorumMark size={15} />
          <h1 className="text-[14px] font-semibold tracking-[0.16em]">ADMIN</h1>
          <span className="text-[11px] text-muted" title="Deployed version">
            v{APP_VERSION}
          </span>
          <Link href="/" className="ml-auto text-[11px] text-muted">
            Back to app &rsaquo;
          </Link>
        </header>
        <AdminNav tabs={tabs.map(([href, label]) => [href, label])} />
        {children}
      </div>
    </main>
  );
}
