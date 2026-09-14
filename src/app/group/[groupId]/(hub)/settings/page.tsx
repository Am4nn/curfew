import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getActivityType, registeredKeys } from "@/domain";
import { acceptedTypes, sharesFor, fineRuleFor } from "@/server/sharing";
import { groupHeader, standingIn } from "@/server/group-view";
import { getAppConfig, resolveAppSettingAt } from "@/server/app-config";
import { listUserActivities } from "@/server/activities";
import { standingFor } from "@/server/standing";
import { listGroupMembers } from "@/server/ledger";
import { groupRoster, listGroupInvites } from "@/server/groups";
import { userDay } from "@/server/config";
import { now } from "@/lib/clock";
import { SettingsForm, type ShareRow, type AcceptedRow, type Panel } from "./settings-form";

const PANELS: Panel[] = ["sharing", "cost", "types", "money", "members"];

export default async function GroupSettingsTab({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  // Which half is showing and which panel is open. In the URL rather than in
  // component state so Back leaves a panel instead of the group, and a link to
  // one half is a link somebody can send.
  searchParams: Promise<{ half?: string; panel?: string }>;
}) {
  const { groupId } = await params;
  const { half: halfParam, panel: panelParam } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [header, accepted, shares, mine, members, appConfig, appMoney] = await Promise.all([
    groupHeader(groupId, user.id),
    acceptedTypes(groupId),
    sharesFor(groupId, user.id),
    listUserActivities(user.id),
    listGroupMembers(groupId, user.id),
    getAppConfig(),
    resolveAppSettingAt("money", await now()),
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
      const rule = await fineRuleFor(groupId, a.typeKey, await userDay(user.id));
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

  // Who runs the group, and what it has out. Both are member-scoped in the
  // query layer (invariant 10); the screen only decides what to draw.
  const [memberRows, inviteRows] = await Promise.all([
    groupRoster(groupId, user.id),
    listGroupInvites(groupId, user.id),
  ]);

  // A type can be accepted only if the app offers it and the group has not
  // already taken it.
  const already = new Set(accepted.map((a) => a.typeKey));
  const addable = registeredKeys()
    .filter((key) => appConfig.enabledTypes.includes(key) && !already.has(key))
    .map((key) => {
      const type = getActivityType(key);
      return { typeKey: key, name: type.name, icon: type.icon };
    });

  // Your ceiling here, the same number the nightly pass computes, so the
  // sentence at the top of Yours says what the scoring actually does rather
  // than describing it in general terms.
  const standing = await standingIn(groupId, user.id);

  const isOwner = header.role === "owner";
  // A member has no second half, so a link to it must not show them one.
  const half = halfParam === "group" && isOwner ? "group" : "yours";
  const asked = PANELS.find((p) => p === panelParam) ?? null;
  // The owner-only panels are refused to a member here, not hidden in the
  // component: a hidden control that still renders on a typed URL is not a
  // permission, it is a decoration.
  const panel =
    asked && !isOwner && (asked === "types" || asked === "money" || asked === "members")
      ? null
      : asked;

  return (
    <SettingsForm
      groupId={groupId}
      groupName={header.name}
      viewerId={user.id}
      members={memberRows}
      invites={inviteRows}
      isOwner={isOwner}
      moneyOn={header.moneyOn}
      appMoneyOn={appMoney === true}
      shares={shareRows}
      accepted={acceptedRows}
      addable={addable}
      ceiling={standing.ceiling}
      half={half}
      panel={panel}
    />
  );
}
