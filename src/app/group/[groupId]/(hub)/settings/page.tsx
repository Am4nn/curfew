import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getActivityType, registeredKeys } from "@/domain";
import { acceptedTypes, sharesFor, fineRuleFor } from "@/server/sharing";
import { groupHeader } from "@/server/group-view";
import { getAppConfig, resolveAppSettingAt } from "@/server/app-config";
import { listUserActivities } from "@/server/activities";
import { standingFor } from "@/server/standing";
import { listGroupMembers } from "@/server/ledger";
import { SettingsForm, type ShareRow, type AcceptedRow } from "./settings-form";

export default async function GroupSettingsTab({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [header, accepted, shares, mine, members, appConfig, appMoney] = await Promise.all([
    groupHeader(groupId, user.id),
    acceptedTypes(groupId),
    sharesFor(groupId, user.id),
    listUserActivities(user.id),
    listGroupMembers(groupId, user.id),
    getAppConfig(),
    resolveAppSettingAt("money", new Date()),
  ]);
  if (!header) redirect("/groups");

  const tracked = new Map(mine.filter((a) => a.enabled).map((a) => [a.typeKey, a]));
  const shareByKey = new Map(shares.map((s) => [s.typeKey, s]));

  const shareRows: ShareRow[] = [];
  for (const a of accepted) {
    const type = getActivityType(a.typeKey);
    const share = shareByKey.get(a.typeKey);
    const shared = share?.shared === true;
    const standing = tracked.has(a.typeKey)
      ? await standingFor(user.id, a.typeKey)
      : null;

    shareRows.push({
      typeKey: a.typeKey,
      name: a.name,
      icon: a.icon,
      accepted: true,
      shared,
      // Computed here already, but until now it only reached the subtitle: the
      // row said "you do not track this yet" and still offered a live switch
      // beside it, which the server accepted.
      tracked: tracked.has(a.typeKey),
      shareEvidence: share?.shareEvidence === true,
      takesEvidence: type.evidence.level !== "none",
      sub: !tracked.has(a.typeKey)
        ? "you do not track this yet"
        : shared
          ? `${standing?.streak ?? 0} day streak`
          : "you track this, it stays private here",
    });
  }

  const acceptedRows: AcceptedRow[] = [];
  if (header.role === "owner") {
    for (const a of accepted) {
      let sharers = 0;
      for (const m of members) {
        const theirs = await sharesFor(groupId, m.userId);
        if (theirs.some((s) => s.typeKey === a.typeKey && s.shared)) sharers += 1;
      }
      const rule = await fineRuleFor(
        groupId,
        a.typeKey,
        new Date().toISOString().slice(0, 10),
      );
      acceptedRows.push({
        typeKey: a.typeKey,
        name: a.name,
        icon: a.icon,
        sharers,
        fineAmount: rule.fineAmount,
        currency: rule.currency,
      });
    }
  }

  // A type can be accepted only if the app offers it and the group has not
  // already taken it.
  const already = new Set(accepted.map((a) => a.typeKey));
  const addable = registeredKeys()
    .filter((key) => appConfig.enabledTypes.includes(key) && !already.has(key))
    .map((key) => {
      const type = getActivityType(key);
      return { typeKey: key, name: type.name, icon: type.icon };
    });

  return (
    <SettingsForm
      groupId={groupId}
      isOwner={header.role === "owner"}
      moneyOn={header.moneyOn}
      appMoneyOn={appMoney === true}
      shares={shareRows}
      accepted={acceptedRows}
      addable={addable}
    />
  );
}
