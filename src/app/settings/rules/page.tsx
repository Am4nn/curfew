import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { TERMS } from "@/server/policy";
import { CONSENT_VERSION, consentOf } from "@/server/consent";
import { BackLink } from "@/app/back-link";

// The rules, always readable. Everything a member agreed to has to be visible
// later and not only at the gate (TRUST-SAFETY.md).
export default async function RulesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const consent = await consentOf(user.id);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <BackLink fallback="/settings" className="text-[14px] text-muted" />
          <span className="text-[14px] font-semibold tracking-[0.14em]">THE RULES</span>
        </header>

        {TERMS.map((section) => (
          <section key={section.heading} className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">
              {section.heading}
            </span>
            <ul className="flex flex-col gap-[10px]">
              {section.lines.map((line) => {
                const strong = line.startsWith("**");
                return (
                  <li key={line} className="flex gap-[9px]">
                    <span className="text-[11px] leading-[1.65] text-muted">&bull;</span>
                    <span
                      className={
                        "flex-1 text-[12.5px] leading-[1.6] " +
                        (strong ? "text-fg" : "text-muted")
                      }
                    >
                      {line.replaceAll("**", "")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="text-[11.5px] leading-[1.55] text-muted">
          {consent
            ? `You agreed to version ${consent.version} of this on ${consent.acceptedAt.toISOString().slice(0, 10)}. This is version ${CONSENT_VERSION}.`
            : "You have not agreed to this yet."}
        </div>
      </div>
    </main>
  );
}
