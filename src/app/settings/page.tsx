import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { hasAdminAccess } from "@/server/admin";
import { getPersonalSettings } from "@/server/settings";
import { ActionForm, InfoHint, SubmitButton } from "../ui";
import { ThemeToggle } from "../theme-toggle";
import { SignOut } from "../sign-out";
import { TimezoneSelect } from "./timezone-select";
import { updateTimezoneAction, updateWindowsAction } from "./actions";

const WINDOW_FIELDS: [keyof Awaited<ReturnType<typeof getPersonalSettings>>["windows"], string][] = [
  ["night_open", "Night open"],
  ["night_close", "Night close"],
  ["wake_open", "Wake open"],
  ["wake_close", "Wake close"],
  ["confirm_open", "Confirm open"],
  ["confirm_close", "Confirm close"],
];

export default async function Settings() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [personal, admin] = await Promise.all([
    getPersonalSettings(user.id),
    hasAdminAccess(user.id),
  ]);
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const zones = intl.supportedValuesOf
    ? intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];

  return (
    <main className="min-h-dvh px-5 pb-24 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">SETTINGS</h1>
        </header>

        <section className="mb-9">
          <div className="border-b-2 border-fg pb-2">
            <h2 className="text-[14px] font-semibold tracking-[0.08em]">APPEARANCE</h2>
            <p className="mt-1 text-[12px] text-muted">Theme for this device.</p>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-[14px]">Theme</span>
            <ThemeToggle initial={theme} />
          </div>
        </section>

        {/* Personal scope: silent, applies to this person in every group. */}
        <section className="mb-9">
          <div className="border-b-2 border-fg pb-2">
            <h2 className="text-[14px] font-semibold tracking-[0.08em]">
              PERSONAL
              <InfoHint label="How personal windows work">
                Set the night check-in, wake check-in, and confirm check-in windows.
                A check-in counts only when you press its button inside that window.
                Window changes take effect tomorrow, not today.
              </InfoHint>
            </h2>
            <p className="mt-1 text-[12px] text-muted">Yours only. Changes take effect tomorrow.</p>
          </div>

          <ActionForm action={updateTimezoneAction} className="border-b border-rule py-3">
            <label className="text-[14px]">
              Timezone
              <span className="block text-[12px] text-muted">IANA name, e.g. Asia/Kolkata</span>
            </label>
            <div className="mt-2 flex items-start gap-2">
              <TimezoneSelect zones={zones} defaultValue={personal.timezone} />
              <SubmitButton
                pendingLabel="Saving"
                className="border border-fg bg-fg px-3 py-[8px] text-[13px] text-bg"
              >
                Save
              </SubmitButton>
            </div>
          </ActionForm>

          <ActionForm action={updateWindowsAction} className="pt-3">
            {WINDOW_FIELDS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 border-b border-rule py-3">
                <label className="text-[14px]">{label}</label>
                <input
                  type="time"
                  name={key}
                  required
                  defaultValue={personal.windows[key]}
                  className="border border-fg bg-transparent px-2 py-[6px] text-[14px]"
                />
              </div>
            ))}
            <SubmitButton
              pendingLabel="Saving"
              className="mt-3 border border-fg bg-fg px-4 py-[8px] text-[14px] text-bg"
            >
              Save windows
            </SubmitButton>
          </ActionForm>
        </section>

        {admin ? (
          <section className="mb-9">
            <div className="mb-3 text-[11px] tracking-[0.14em] text-muted">ADMIN</div>
            <Link
              href="/admin"
              className="flex items-center justify-between border border-rule px-[14px] py-[13px] text-[14px]"
            >
              Admin console
              <span className="text-muted">›</span>
            </Link>
          </section>
        ) : null}

        <SignOut />
      </div>
    </main>
  );
}
