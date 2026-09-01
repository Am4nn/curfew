import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { hasAdminAccess } from "@/server/admin";
import { getPersonalSettings } from "@/server/settings";
import { ThemeToggle } from "../theme-toggle";
import { SignOut } from "../sign-out";

export default async function Settings() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [personal, admin] = await Promise.all([
    getPersonalSettings(user.id),
    hasAdminAccess(user.id),
  ]);
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto max-w-[560px]">
        <header className="-mx-5 mb-7 border-b border-rule px-5 pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">SETTINGS</h1>
        </header>

        <section className="mb-8">
          <div className="mb-3 text-[11px] tracking-[0.14em] text-muted">APPEARANCE</div>
          <div className="flex items-center justify-between">
            <span className="text-[14px]">Theme</span>
            <ThemeToggle initial={theme} />
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[11px] tracking-[0.14em] text-muted">PERSONAL</span>
            <span className="text-[11px] text-muted">effective tomorrow</span>
          </div>
          <Link
            href="/settings/personal"
            className="flex items-center justify-between border-b border-rule py-3"
          >
            <span className="text-[13px] text-muted">Timezone</span>
            <span className="text-[14px]">{personal.timezone}</span>
          </Link>
          <Link href="/settings/personal" className="flex items-center justify-between py-3">
            <span className="text-[13px] text-muted">Sleep windows</span>
            <span className="text-[13px] text-accent">edit ›</span>
          </Link>
        </section>

        {admin ? (
          <section className="mb-8">
            <div className="mb-3 text-[11px] tracking-[0.14em] text-muted">ADMIN</div>
            <Link
              href="/admin"
              className="flex items-center justify-between border border-rule px-[14px] py-[13px] text-[14px]"
            >
              Admin console
              <span className="text-muted">›</span>
            </Link>
          </section>
        ) : null}

        <SignOut className="h-[44px] w-full border border-rule bg-transparent text-[14px] text-muted" />
      </div>
    </main>
  );
}
