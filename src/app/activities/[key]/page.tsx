import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getActivityType, registeredKeys, measureOf, periodUnit } from "@/domain";
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
    // `pb-nav`, not `pb-16`. The tab bar is `fixed bottom-0` over every route
    // and every other screen reserves `calc(6rem + safe-area)` for it. This one
    // reserved 4rem, so about 32px plus the home-indicator inset of the screen
    // sat under the bar. On the setup flow that is the Next button: the page
    // then scrolls, by roughly the height of what is hidden, while the panel
    // above it is visibly half empty.
    <main className="flex min-h-dvh flex-col pb-nav">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px] pt-5">
        <div className="flex items-center gap-[9px]">
          <BackLink fallback="/activities" className="text-base text-muted" />
          <span className="text-base font-semibold tracking-caps">
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
        measure={measureOf(type, state.config)}
        established={
          standing?.consistency
            ? {
                percent: standing.consistency.percent,
                repsToAutomatic: standing.consistency.repsToAutomatic,
                usual: standing.consistency.usual,
              }
            : null
        }
        periodUnit={periodUnit(state.schedule.schedule)}
      />
    </main>
  );
}
