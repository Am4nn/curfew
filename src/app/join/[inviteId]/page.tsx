import { notFound, redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { getActivityType } from "@/domain";
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

  const [accepted, mine] = await Promise.all([
    acceptedTypes(invite.groupId),
    listUserActivities(user.id),
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
    <main className="min-h-dvh pb-24">
      <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
        <BackLink fallback="/groups" className="text-[14px] text-muted" />
        <span className="text-[14px] font-semibold tracking-[0.14em]">
          JOIN {invite.groupName.toUpperCase()}
        </span>
      </header>

      <JoinForm
        inviteId={inviteId}
        groupId={invite.groupId}
        groupName={invite.groupName}
        rows={rows}
      />
    </main>
  );
}
