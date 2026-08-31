import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { isAdmin } from "@/server/admin";

const TABS = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/groups", "Groups"],
  ["/admin/ops", "Ops"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  if (!(await isAdmin(user.id))) redirect("/");

  return (
    <main className="min-h-dvh px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[720px]">
        <header className="mb-4 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">ADMIN</h1>
          <Link href="/" className="text-[12px] text-muted underline">dashboard</Link>
        </header>
        <nav className="mb-7 flex flex-wrap gap-4 text-[13px]">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} className="text-muted underline">
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
