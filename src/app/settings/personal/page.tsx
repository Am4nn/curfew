import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getPersonalSettings } from "@/server/settings";
import { supportedZones } from "@/lib/zones";
import { ActionForm, InfoHint, SubmitButton } from "../../ui";
import { TimezoneSelect } from "../timezone-select";
import { updateTimezoneAction } from "../actions";

// SLEEP WINDOWS used to be on this screen, four `<input type="time">` rows and
// a Save of their own. They were a leftover from the version where sleep WAS
// the app: this screen is v2's, written on 2026-08-31, when there was one
// activity and its windows were as personal as the timezone.
//
// v3 made sleep one of twelve types, each configured on one screen drawn from
// the module's own `fields()`, and sleep declares Night window, Wake window and
// Confirm there. So this was a second way to set the same two things, and the
// only screen in the app that knew what `night_open` means outside the sleep
// module, which invariant 6 exists to prevent.
//
// It was not harmless. Saving here wrote the module's half as the whole config
// blob and broke Home for that person with a ZodError until a save through the
// configure screen put a wrapped row back (v3.2, defect 2). Reading here parsed
// the stored shape wrongly and 500'd this screen permanently for anyone who had
// saved sleep settings once (drift REPORT.md, 18th bug). Two separate defects,
// both from one duplicate.
//
// Sleep's windows are at /activities/sleep. The timezone stays: it is genuinely
// personal, it belongs to no module, and every activity reads it.

export default async function PersonalSettings() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const personal = await getPersonalSettings(user.id);

  const zones = supportedZones();

  return (
    <main className="min-h-dvh px-5 pb-nav pt-5">
      <div className="mx-auto max-w-[560px]">
        <header className="-mx-5 mb-6 flex items-center justify-between border-b border-rule px-5 pb-2.5">
          <h1 className="flex items-center text-base font-semibold tracking-caps">
            PERSONAL
            <InfoHint label="How your timezone is used">
              Every activity is judged in this zone: when a day starts, when a window
              opens, and which day a check-in belongs to. It is the same across every
              group. A change takes effect tomorrow, so a day already being judged is
              not re-judged in a different zone. Each activity keeps its own times on
              its own screen, under Activities.
            </InfoHint>
          </h1>
          <Link href="/settings" className="text-xs text-muted">‹ settings</Link>
        </header>

        <p className="mb-6 text-xs text-muted">Yours only. Changes take effect tomorrow.</p>

        <ActionForm action={updateTimezoneAction} className="mb-8">
          <label className="text-base">
            Timezone
            <span className="block text-xs text-muted">IANA name, e.g. Asia/Kolkata</span>
          </label>
          <div className="mt-2 flex items-start gap-2">
            <TimezoneSelect zones={zones} defaultValue={personal.timezone} />
            <SubmitButton
              pendingLabel="Saving"
              className="border border-fg bg-fg px-3 py-2 text-sm text-bg"
            >
              Save
            </SubmitButton>
          </div>
        </ActionForm>

      </div>
    </main>
  );
}
