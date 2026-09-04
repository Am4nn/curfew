import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getActivityType, registeredKeys } from "@/domain";
import { getAppConfig } from "@/server/app-config";
import { getUserActivity, defaultsFor } from "@/server/activities";
import { standingFor } from "@/server/standing";
import { ActivityIcon } from "../../activity-icon";
import { ConfigureForm } from "./configure-form";
import { BackLink } from "@/app/back-link";

// Both entry points land here (decision 31): a tracked activity opens with its
// own settings and a stop control, an untracked one with the type's defaults
// prefilled and a start button.
export default async function ConfigurePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ from?: string; invite?: string }>;
}) {
  const { key } = await params;
  const { from, invite } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  if (!registeredKeys().includes(key)) notFound();

  const [{ enabledTypes }, mine] = await Promise.all([
    getAppConfig(),
    getUserActivity(user.id, key),
  ]);

  const tracked = mine?.enabled === true;

  // A retired type stays configurable for anyone already tracking it, and is
  // unreachable for everyone else (ACTIVITIES.md, "switching things off").
  if (!enabledTypes.includes(key) && !tracked) notFound();

  const type = getActivityType(key);
  const state = mine ?? defaultsFor(key);
  const standing = tracked ? await standingFor(user.id, key) : null;

  return (
    <main className="flex min-h-dvh flex-col pb-16">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px] pt-5">
        <div className="flex items-center gap-[9px]">
          <BackLink fallback="/activities" className="text-[14px] text-muted" />
          <span className="text-[14px] font-semibold tracking-[0.14em]">
            {type.name.toUpperCase()}
          </span>
        </div>
        <span className="text-muted">
          <ActivityIcon name={type.icon} />
        </span>
      </header>

      <ConfigureForm
        typeKey={key}
        name={type.name}
        description={type.description}
        initialSchedule={state.schedule}
        initialConfig={state.config}
        tracked={tracked}
        returnTo={from === "join" && invite ? `/join/${invite}` : undefined}
        streak={standing?.streak ?? 0}
        best={standing?.best ?? 0}
        graceLeft={standing?.graceLeft ?? null}
      />
    </main>
  );
}
