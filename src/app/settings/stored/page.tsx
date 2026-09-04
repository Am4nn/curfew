import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { CONSENT, CONSENT_VERSION, consentOf } from "@/server/consent";
import { BackLink } from "@/app/back-link";

// Everything a user consented to, visible later and not only at signup
// (TRUST-SAFETY.md). Same text, one source.
export default async function StoredPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const consent = await consentOf(user.id);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <BackLink fallback="/settings" className="text-[14px] text-muted" />
          <span className="text-[14px] font-semibold tracking-[0.14em]">
            WHAT CURFEW STORES
          </span>
        </header>

        {CONSENT.map((section) => (
          <section key={section.heading} className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">
              {section.heading}
            </span>
            <ul className="flex flex-col gap-[10px]">
              {section.lines.map((line) => (
                <li key={line} className="flex gap-[9px]">
                  <span className="text-[11px] leading-[1.65] text-muted">&bull;</span>
                  <span className="flex-1 text-[12.5px] leading-[1.6] text-muted">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="text-[11.5px] leading-[1.55] text-muted">
          {consent
            ? `You accepted version ${consent.version} of this on ${consent.acceptedAt.toISOString().slice(0, 10)}. This is version ${CONSENT_VERSION}.`
            : "You have not accepted this yet."}
        </div>
      </div>
    </main>
  );
}
