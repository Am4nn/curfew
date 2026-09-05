import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getPersonalSettings } from "@/server/settings";
import { supportedZones } from "@/lib/zones";
import { ActionForm, InfoHint, SubmitButton } from "../../ui";
import { TimezoneSelect } from "../timezone-select";
import { updateTimezoneAction, updateWindowsAction } from "../actions";

const WINDOW_FIELDS: [keyof Awaited<ReturnType<typeof getPersonalSettings>>["windows"], string][] = [
  ["night_open", "Night open"],
  ["night_close", "Night close"],
  ["wake_open", "Wake open"],
  ["wake_close", "Wake close"],
  ["confirm_open", "Confirm open"],
  ["confirm_close", "Confirm close"],
];

export default async function PersonalSettings() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const personal = await getPersonalSettings(user.id);

  const zones = supportedZones();

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto max-w-[560px]">
        <header className="-mx-5 mb-6 flex items-center justify-between border-b border-rule px-5 pb-[10px]">
          <h1 className="flex items-center text-[15px] font-semibold tracking-[0.14em]">
            PERSONAL
            <InfoHint label="How personal windows work">
              Set the night check-in, wake check-in, and confirm check-in windows.
              A check-in counts only when you press its button inside that window.
              These are personal and the same across every group. Changes take effect
              tomorrow, not today.
            </InfoHint>
          </h1>
          <Link href="/settings" className="text-[12px] text-muted">‹ settings</Link>
        </header>

        <p className="mb-6 text-[12px] text-muted">Yours only. Changes take effect tomorrow.</p>

        <ActionForm action={updateTimezoneAction} className="mb-8">
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

        <div className="mb-3 text-[11px] tracking-[0.14em] text-muted">SLEEP WINDOWS</div>
        <ActionForm action={updateWindowsAction}>
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
      </div>
    </main>
  );
}
