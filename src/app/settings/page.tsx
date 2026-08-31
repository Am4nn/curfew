import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups } from "@/server/groups";
import {
  getPersonalSettings,
  groupSleepActivity,
  getGroupRules,
} from "@/server/settings";
import { minorUnitExponent } from "@/domain";
import { ActionForm, InfoHint, SubmitButton } from "../ui";
import { ThemeToggle } from "../theme-toggle";
import { TimezoneSelect } from "./timezone-select";
import {
  updateTimezoneAction,
  updateWindowsAction,
  updateGroupRulesAction,
} from "./actions";

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

  const personal = await getPersonalSettings(user.id);
  const groups = await listUserGroups(user.id);
  const theme =
    (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

  // Full IANA list for the timezone search dropdown. Available in modern Node
  // and browsers; falls back to a couple of common zones if not.
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const zones = intl.supportedValuesOf
    ? intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];

  return (
    <main className="min-h-dvh px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">SETTINGS</h1>
          <Link href="/" className="text-[12px] text-muted">‹ dashboard</Link>
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

        {/* Personal scope: silent, applies to this person everywhere. */}
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
            <p className="mt-1 text-[12px] text-muted">
              Yours only. Changes take effect tomorrow.
            </p>
          </div>

          <ActionForm
            action={updateTimezoneAction}
            className="border-b border-rule py-3"
          >
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

        {await Promise.all(
          groups.map(async (g) => {
            const act = await groupSleepActivity(g.groupId);
            if (!act) return null;
            const rules = await getGroupRules(act.activityId);
            const exp = minorUnitExponent(rules.currency);
            return (
              <SharedScope
                key={g.groupId}
                groupId={g.groupId}
                activityId={act.activityId}
                name={g.name}
                fineMajor={(rules.fineAmount / 10 ** exp).toFixed(exp)}
                currency={rules.currency}
                grace={rules.gracePerMonth}
                isOwner={g.role === "owner"}
              />
            );
          }),
        )}
      </div>
    </main>
  );
}

function SharedScope({
  groupId,
  activityId,
  name,
  fineMajor,
  currency,
  grace,
  isOwner,
}: {
  groupId: string;
  activityId: string;
  name: string;
  fineMajor: string;
  currency: string;
  grace: number;
  isOwner: boolean;
}) {
  return (
    <section className="mb-9">
      <div className="border-b-2 border-penalty pb-2">
        <h2 className="text-[14px] font-semibold tracking-[0.08em] text-penalty">
          SHARED · {name}
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Affects everyone in this group, from tomorrow.
        </p>
      </div>

      {isOwner ? (
        <ActionForm action={updateGroupRulesAction} className="pt-3">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="activityId" value={activityId} />
          <div className="flex items-center justify-between gap-3 border-b border-rule py-3">
            <label className="text-[14px]">Fine per failed day</label>
            <span className="flex items-center gap-2">
              <input
                name="fineAmount"
                inputMode="decimal"
                required
                defaultValue={fineMajor}
                className="w-24 border border-fg bg-transparent px-2 py-[6px] text-right text-[14px]"
              />
              <input
                name="currency"
                defaultValue={currency}
                maxLength={3}
                className="w-16 border border-fg bg-transparent px-2 py-[6px] text-center text-[14px] uppercase"
              />
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-rule py-3">
            <label className="text-[14px]">
              Grace tokens per month
              <span className="block text-[12px] text-muted">
                Absorb a miss without breaking the streak. The fine still applies.
              </span>
            </label>
            <input
              name="gracePerMonth"
              type="number"
              min={0}
              required
              defaultValue={grace}
              className="w-20 border border-fg bg-transparent px-2 py-[6px] text-right text-[14px]"
            />
          </div>
          <p className="mt-3 border-l-[3px] border-penalty bg-surface py-[10px] pl-3 text-[13px]">
            Saving changes the stake for both people, starting tomorrow.
          </p>
          <SubmitButton
            pendingLabel="Saving"
            className="mt-3 border border-penalty bg-penalty px-4 py-[8px] text-[14px] text-bg"
          >
            Save shared rules
          </SubmitButton>
        </ActionForm>
      ) : (
        <div className="pt-3 text-[14px]">
          <div className="flex justify-between border-b border-rule py-3">
            <span>Fine per failed day</span>
            <span className="tabular-nums">{fineMajor} {currency}</span>
          </div>
          <div className="flex justify-between border-b border-rule py-3">
            <span>Grace tokens per month</span>
            <span className="tabular-nums">{grace}</span>
          </div>
          <p className="mt-3 text-[12px] text-muted">Only the group owner can change these.</p>
        </div>
      )}
    </section>
  );
}
