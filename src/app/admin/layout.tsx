import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getCapabilities, hasAdminAccess } from "@/server/admin";
import type { Capability } from "@/lib/capabilities";

const TABS: [string, string, Capability | null][] = [
  ["/admin", "Overview", null],
  ["/admin/users", "Users", "users.view"],
  ["/admin/groups", "Groups", "groups.view"],
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
    <main className="min-h-dvh px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[720px]">
        <header className="mb-4 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">ADMIN</h1>
          <Link href="/" className="text-[12px] text-muted underline">dashboard</Link>
        </header>
        <nav className="mb-7 flex flex-wrap gap-4 text-[13px]">
          {tabs.map(([href, label]) => (
            <Link key={href} href={href} className="text-muted underline">{label}</Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
