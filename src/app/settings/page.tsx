import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { hasAdminAccess } from "@/server/admin";
import { getPersonalSettings } from "@/server/settings";
import { listUserActivities } from "@/server/activities";
import { listUserGroups } from "@/server/groups";
import { RETENTION_DAYS } from "@/server/evidence";
import { consentOf } from "@/server/consent";
import { QuorumMark } from "../mark";
import { ThemeToggle } from "../theme-toggle";
import { SignOut } from "../sign-out";

function Row({ label, value, href }: { label: string; value?: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-rule py-[13px]">
      <span className="flex-1 text-[13.5px]">{label}</span>
      {value ? <span className="text-[11px] text-muted">{value}</span> : null}
      <span className="text-[13px] text-muted">&rsaquo;</span>
    </Link>
  );
}

export default async function Settings() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [personal, admin, activities, groups, consent] = await Promise.all([
    getPersonalSettings(user.id),
    hasAdminAccess(user.id),
    listUserActivities(user.id),
    listUserGroups(user.id),
    consentOf(user.id),
  ]);
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  const tracked = activities.filter((a) => a.enabled).length;

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px]">
          <h1 className="flex items-center gap-[9px] text-[14px] font-semibold tracking-[0.16em]">
            <QuorumMark size={15} />
            SETTINGS
          </h1>
          {admin ? (
            <Link href="/admin" className="text-[11px] text-muted">
              Admin &rsaquo;
            </Link>
          ) : null}
        </header>

        <section className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.16em] text-muted">APPEARANCE</span>
          <ThemeToggle initial={theme} />
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.16em] text-muted">PERSONAL</span>
          <div className="flex flex-col">
            <Row label="Timezone" value={personal.timezone} href="/settings/personal" />
            <Row
              label="Activities"
              value={`${tracked} tracked`}
              href="/activities"
            />
            <Row
              label="What you share"
              value={`${groups.length} ${groups.length === 1 ? "group" : "groups"}`}
              href="/settings/sharing"
            />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.16em] text-muted">YOUR DATA</span>
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-rule py-[13px]">
              <span className="flex-1 text-[13.5px]">Photo retention</span>
              <span className="text-[11px] text-muted">{RETENTION_DAYS} days</span>
            </div>
            <Row label="How reputation works" href="/ranks" />
            <Row
              label="What Curfew stores"
              value={consent ? `accepted ${consent.acceptedAt.toISOString().slice(0, 10)}` : undefined}
              href="/settings/stored"
            />
            <Row label="Delete data" href="/settings/data" />
          </div>
        </section>

        <SignOut />
      </div>
    </main>
  );
}
