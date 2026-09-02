import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getCapabilities, hasAdminAccess } from "@/server/admin";
import type { Capability } from "@/lib/capabilities";
import { AdminNav } from "./admin-nav";
import { APP_VERSION } from "@/lib/version";

const TABS: [string, string, Capability | null][] = [
  ["/admin", "Overview", null],
  ["/admin/insights", "Insights", "insights.view"],
  ["/admin/users", "Users", "users.view"],
  ["/admin/groups", "Groups", "groups.view"],
  ["/admin/controls", "Controls", "settings.view"],
  ["/admin/ops", "Ops", "ops.score"],
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
        <header className="-mx-5 mb-4 flex items-baseline justify-between border-b-2 border-fg px-5 pb-[10px]">
          <div className="flex items-baseline gap-[10px]">
            <h1 className="text-[15px] font-semibold tracking-[0.14em]">ADMIN</h1>
            <span className="text-[11px] text-muted" title="Deployed version">
              v{APP_VERSION}
            </span>
          </div>
          <Link href="/" className="text-[12px] text-muted">‹ dashboard</Link>
        </header>
        <AdminNav tabs={tabs.map(([href, label]) => [href, label])} />
        {children}
      </div>
    </main>
  );
}
