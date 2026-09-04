import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { CONSENT, hasConsented } from "@/server/consent";
import { TERMS } from "@/server/policy";
import { acceptConsentAction } from "./consent/actions";
import { SubmitButton } from "@/app/ui";

// The consent gate, over every route, the same way a notice is (decision 58).
//
// It blocks rather than redirects because it has to reach every screen without
// each of them remembering to check, and the layout is the one place that runs
// on all of them. There is no dismiss: reading it is the only way through.
export async function ConsentGate() {
  const user = await getSessionUser();
  if (!user) return null;

  // A pending account has its own screen and nothing to consent to yet.
  if ((await getApprovalStatus(user.id)) !== "approved") return null;
  if (await hasConsented(user.id)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What Curfew stores"
      className="fixed inset-0 z-[60] flex flex-col bg-bg"
    >
      <div className="border-b border-rule px-5 pb-[11px] pt-5">
        <span className="text-[14px] font-semibold tracking-[0.16em]">
          BEFORE YOU START
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        <p className="text-[13px] leading-[1.6]">
          Curfew keeps a record of what you say you did, and shows some of it to
          people you choose. Two things to read: what it stores, and the rules
          you are agreeing to. Both are in Settings afterwards, always.
        </p>

        <span className="text-[11px] tracking-[0.16em] text-fg">
          WHAT CURFEW STORES
        </span>

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
        <span className="mt-2 text-[11px] tracking-[0.16em] text-fg">THE RULES</span>

        {TERMS.map((section) => (
          <section key={section.heading} className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">
              {section.heading}
            </span>
            <ul className="flex flex-col gap-[10px]">
              {section.lines.map((line) => (
                <li key={line} className="flex gap-[9px]">
                  <span className="text-[11px] leading-[1.65] text-muted">&bull;</span>
                  <span className="flex-1 text-[12.5px] leading-[1.6] text-muted">
                    {line.replaceAll("**", "")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="border-t border-rule px-5 pb-5 pt-[14px]">
        <form action={acceptConsentAction}>
          <SubmitButton
            className="h-12 w-full border border-fg bg-fg text-[14px] font-semibold text-bg"
            pendingLabel="Saving"
          >
            I am 18 or older and I agree
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
