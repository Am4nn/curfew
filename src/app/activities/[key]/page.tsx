import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getActivityType, registeredKeys } from "@/domain";
import { getAppConfig } from "@/server/app-config";
import { getUserActivity, defaultsFor } from "@/server/activities";
import { ConfigureForm } from "./configure-form";

// Both entry points land here (decision 31): a tracked activity opens with its
// own settings and a stop control, an untracked one with the type's defaults
// prefilled and a start button.
export default async function ConfigurePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
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

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto max-w-[560px]">
        <Link href="/activities" className="text-[12px] text-muted">
          &lsaquo; activities
        </Link>
        <div className="mt-4">
          <ConfigureForm
            typeKey={key}
            name={type.name}
            description={type.description}
            evidence={type.evidence}
            fields={type.fields}
            initialSchedule={state.schedule}
            initialConfig={state.config}
            tracked={tracked}
            streak={0}
          />
        </div>
      </div>
    </main>
  );
}
