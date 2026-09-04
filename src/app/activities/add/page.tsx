import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { catalogFor } from "@/server/activities";
import { ActivityIcon } from "../../activity-icon";
import { BackLink } from "@/app/back-link";

// The catalog. A type appears only when it has an enabled row in
// activity_types (decision 63), so an admin switching one off removes it from
// here without touching anyone already tracking it.
export default async function CatalogPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const catalog = await catalogFor(user.id);
  const available = catalog.filter((c) => !c.tracked);
  const already = catalog.filter((c) => c.tracked);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <BackLink fallback="/activities" className="text-[14px] text-muted" />
          <span className="text-[14px] font-semibold tracking-[0.14em]">ADD ACTIVITY</span>
        </header>

        <div className="flex flex-col">
          {available.map(({ type }) => (
            <Link
              key={type.key}
              href={`/activities/${type.key}`}
              className="flex items-center gap-3 border-b border-rule py-[14px]"
            >
              <span className="flex flex-none">
                <ActivityIcon name={type.icon} size={20} />
              </span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="text-[14px]">{type.name}</span>
                <span className="text-[11.5px] leading-[1.45] text-muted">
                  {type.description}
                </span>
              </div>
              <span className="flex-none text-[18px] leading-none">+</span>
            </Link>
          ))}
        </div>

        {already.length > 0 ? (
          <section className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">
              ALREADY TRACKING
            </span>
            <div className="flex flex-col">
              {already.map(({ type }) => (
                <Link
                  key={type.key}
                  href={`/activities/${type.key}`}
                  className="flex items-center gap-3 border-b border-rule py-[14px]"
                >
                  <span className="flex flex-none text-muted">
                    <ActivityIcon name={type.icon} size={20} />
                  </span>
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-[14px] text-muted">{type.name}</span>
                    <span className="text-[11.5px] leading-[1.45] text-muted">
                      {type.description}
                    </span>
                  </div>
                  <span className="flex-none text-[11px] text-muted">tracking</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="text-[11.5px] leading-[1.55] text-muted">
          Missing something you track? Ask an admin to add it.
        </div>
      </div>
    </main>
  );
}
