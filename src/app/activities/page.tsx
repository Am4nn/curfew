import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getActivityType } from "@/domain";
import { listUserActivities, catalogFor } from "@/server/activities";

// Your activities is the manager (decision 21). Home shows today; this is where
// an activity is added, configured or stopped.
export default async function ActivitiesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [mine, catalog] = await Promise.all([
    listUserActivities(user.id),
    catalogFor(user.id),
  ]);

  const tracked = mine.filter((a) => a.enabled);
  const available = catalog.filter((c) => !c.tracked);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-8">
        <h1 className="text-[19px] font-semibold">Activities</h1>

        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">YOU TRACK</span>
          {tracked.length === 0 ? (
            <p className="text-[13px] leading-[1.6] text-muted">
              Nothing yet. Pick something below and set it up how you want it.
            </p>
          ) : (
            <div className="flex flex-col">
              {tracked.map((activity) => {
                const type = getActivityType(activity.typeKey);
                return (
                  <Link
                    key={activity.typeKey}
                    href={`/activities/${activity.typeKey}`}
                    className="flex items-center gap-3 border-b border-rule py-[13px]"
                  >
                    <div className="flex flex-1 flex-col gap-[3px]">
                      <span className="text-[14px]">{type.name}</span>
                      <span className="text-[11px] text-muted">{type.description}</span>
                    </div>
                    <span className="text-[12px] text-muted">&rsaquo;</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">ADD</span>
          {available.length === 0 ? (
            <p className="text-[13px] leading-[1.6] text-muted">
              You are tracking everything the app offers. Ask an admin if something is
              missing.
            </p>
          ) : (
            <div className="flex flex-col">
              {available.map(({ type }) => (
                <Link
                  key={type.key}
                  href={`/activities/${type.key}`}
                  className="flex items-center gap-3 border-b border-rule py-[13px]"
                >
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-[14px] text-muted">{type.name}</span>
                    <span className="text-[11px] text-muted">{type.description}</span>
                  </div>
                  <span className="text-[15px] text-muted">+</span>
                </Link>
              ))}
            </div>
          )}
          <span className="text-[11px] leading-[1.55] text-muted">
            Something missing? Ask an admin. Each type is set up per person, so two people
            tracking the same thing can be held to different things.
          </span>
        </section>
      </div>
    </main>
  );
}
