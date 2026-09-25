import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { catalogFor, conditionsEnabled } from "@/server/activities";
import { ActivityIcon } from "../../activity-icon";
import { BackLink } from "@/app/back-link";
import { WriteYourOwn } from "./write-your-own";

// The catalog. A type appears only when it has an enabled row in
// activity_types (decision 63), so an admin switching one off removes it from
// here without touching anyone already tracking it.
export default async function CatalogPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [catalog, canWrite] = await Promise.all([catalogFor(user.id), conditionsEnabled()]);
  const available = catalog.filter((c) => !c.tracked);
  const already = catalog.filter((c) => c.tracked);

  return (
    <main className="min-h-dvh px-5 pb-nav pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <BackLink fallback="/activities" className="text-base text-muted" />
          <span className="text-base font-semibold tracking-caps">ADD ACTIVITY</span>
        </header>

        <div className="flex flex-col">
          {available.map(({ type }) => (
            <Link
              key={type.key}
              href={`/activities/${type.key}`}
              className="flex items-center gap-3 border-b border-rule py-3.5"
            >
              <span className="flex flex-none">
                <ActivityIcon name={type.icon} size={20} />
              </span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="text-base">{type.name}</span>
                <span className="text-2xs leading-normal text-muted">
                  {type.description}
                </span>
              </div>
              <span className="flex-none text-lg leading-none">+</span>
            </Link>
          ))}

          {/* Last, under everything we offer. Somebody looking for a condition
              looks through what exists before writing one (1.19). */}
          {canWrite ? <WriteYourOwn /> : null}
        </div>

        {already.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <span className="text-micro tracking-label text-muted">
              ALREADY TRACKING
            </span>
            <div className="flex flex-col">
              {already.map(({ type }) => (
                <Link
                  key={type.key}
                  href={`/activities/${type.key}`}
                  className="flex items-center gap-3 border-b border-rule py-3.5"
                >
                  <span className="flex flex-none text-muted">
                    <ActivityIcon name={type.icon} size={20} />
                  </span>
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-base text-muted">{type.name}</span>
                    <span className="text-2xs leading-normal text-muted">
                      {type.description}
                    </span>
                  </div>
                  <span className="flex-none text-2xs text-muted">tracking</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="text-2xs leading-relaxed text-muted">
          {canWrite
            ? "Missing something you track? Write your own, or ask an admin to add it."
            : "Missing something you track? Ask an admin to add it."}
        </div>
      </div>
    </main>
  );
}
