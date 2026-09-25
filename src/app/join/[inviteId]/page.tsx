import { notFound, redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType, joiningScore } from "@/domain";
import { globalScore } from "@/server/scoring";
import { listInvitesForEmail } from "@/server/groups";
import { acceptedTypes } from "@/server/sharing";
import { listUserActivities } from "@/server/activities";
import { standingFor } from "@/server/standing";
import { JoinForm, type JoinRow } from "./join-form";
import { BackLink } from "@/app/back-link";

// Joining is where sharing is chosen, so the invite has to show exactly what
// the group accepts before anything is agreed to. A type the person does not
// track offers to set it up first: the activity becomes theirs either way.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const invites = await listInvitesForEmail(user.email);
  const invite = invites.find((i) => i.id === inviteId);
  if (!invite) notFound();

  // The number this screen promises has to be the number the engine opens on.
  // `scoreUser` opens a group scope at `joiningScore(global as of the join
  // date)`, so that is what is computed here rather than a constant.
  const [accepted, mine, global] = await Promise.all([
    acceptedTypes(invite.groupId),
    listUserActivities(user.id),
    globalScore(user.id),
  ]);
  const tracked = new Set(mine.filter((a) => a.enabled).map((a) => a.typeKey));

  const rows: JoinRow[] = [];
  for (const a of accepted) {
    const type = getActivityType(a.typeKey);
    const isTracked = tracked.has(a.typeKey);
    const standing = isTracked ? await standingFor(user.id, a.typeKey) : null;
    rows.push({
      typeKey: a.typeKey,
      name: a.name,
      icon: a.icon,
      tracked: isTracked,
      takesEvidence: type.evidence.level !== "none",
      sub: isTracked
        ? `you track this · ${standing?.streak ?? 0} day streak`
        : "You do not track this yet",
    });
  }

  return (
    <main className="min-h-dvh pb-nav">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <BackLink fallback="/groups" className="text-base text-muted" />
        <span className="text-base font-semibold tracking-caps">
          JOIN {invite.groupName.toUpperCase()}
        </span>
      </header>

      <JoinForm
        inviteId={inviteId}
        groupId={invite.groupId}
        groupName={invite.groupName}
        rows={rows}
        opening={joiningScore(global)}
      />
    </main>
  );
}
