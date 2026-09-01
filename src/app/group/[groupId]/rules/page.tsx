import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { listGroupMembersDetailed } from "@/server/groups";
import { groupSleepActivity, getGroupRules, getPersonalSettings } from "@/server/settings";
import { minorUnitExponent } from "@/domain";
import { ActionForm, SubmitButton, InfoHint } from "../../../ui";
import { updateGroupRulesAction } from "../../../settings/actions";

const WINDOWS: [keyof Awaited<ReturnType<typeof getPersonalSettings>>["windows"], string][] = [
  ["night_open", "Night check-in"],
  ["wake_open", "Wake check-in"],
  ["confirm_open", "Confirm check-in"],
];

export default async function GroupRulesTab({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");
  try {
    await assertMember(groupId, user.id);
  } catch {
    notFound();
  }

  const [act, members, personal] = await Promise.all([
    groupSleepActivity(groupId),
    listGroupMembersDetailed(groupId),
    getPersonalSettings(user.id),
  ]);
  if (!act) notFound();

  const rules = await getGroupRules(act.activityId);
  const exp = minorUnitExponent(rules.currency);
  const fineMajor = (rules.fineAmount / 10 ** exp).toFixed(exp);
  const isOwner = members.find((m) => m.userId === user.id)?.role === "owner";
  const w = personal.windows;

  return (
    <>
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[11px] tracking-[0.14em] text-muted">SHARED · OWNER</span>
          <span className="text-[11px] text-muted">effective tomorrow</span>
        </div>

        {isOwner ? (
          <ActionForm action={updateGroupRulesAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="activityId" value={act.activityId} />
            <div className="flex items-center justify-between gap-3 border-b border-rule py-3">
              <label className="text-[13px] text-muted">Fine per miss</label>
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
                  defaultValue={rules.currency}
                  maxLength={3}
                  className="w-16 border border-fg bg-transparent px-2 py-[6px] text-center text-[14px] uppercase"
                />
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-rule py-3">
              <label className="text-[13px] text-muted">
                Grace per month
                <span className="block text-[12px] text-muted">
                  Absorbs a miss without breaking the streak. The fine still applies.
                </span>
              </label>
              <input
                name="gracePerMonth"
                type="number"
                min={0}
                required
                defaultValue={rules.gracePerMonth}
                className="w-20 border border-fg bg-transparent px-2 py-[6px] text-right text-[14px]"
              />
            </div>
            <p className="mt-3 border-l-[3px] border-penalty bg-surface py-[10px] pl-3 text-[13px]">
              Saving changes the stake for everyone in this group, starting tomorrow.
            </p>
            <SubmitButton
              pendingLabel="Saving"
              className="mt-3 border border-penalty bg-penalty px-4 py-[8px] text-[14px] text-bg"
            >
              Save shared rules
            </SubmitButton>
          </ActionForm>
        ) : (
          <>
            <Row label="Fine per miss" value={`${fineMajor} ${rules.currency}`} />
            <Row label="Grace per month" value={String(rules.gracePerMonth)} />
            <p className="mt-3 text-[12px] text-muted">Only the group owner can change these.</p>
          </>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] tracking-[0.14em] text-muted">YOUR WINDOWS</span>
          <InfoHint label="How your windows work">
            Your three nightly windows: night check-in, wake check-in, and confirm check-in.
            A check-in counts only when you press its button inside that window. These are
            personal and the same across every group. Changes take effect tomorrow.
          </InfoHint>
        </div>
        {WINDOWS.map(([openKey, label]) => {
          const closeKey = openKey.replace("_open", "_close") as keyof typeof w;
          return <Row key={openKey} label={label} value={`${w[openKey]} – ${w[closeKey]}`} />;
        })}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12px] text-muted">Changes take effect tomorrow.</span>
          <Link href="/settings" className="text-[13px] text-accent">edit ›</Link>
        </div>
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule py-3">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[14px] tabular-nums">{value}</span>
    </div>
  );
}
