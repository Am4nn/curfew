import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups, listInvitesForEmail } from "@/server/groups";
import { groupHeader } from "@/server/group-view";
import { standingIn } from "@/server/group-view";
import { QuorumMark } from "../mark";
import { RankScore } from "../rank-icon";
import { ActionForm, SubmitButton } from "../ui";
import { createGroupAction, declineInviteAction } from "../actions";

// Groups are invite-only and nobody finds one by searching, so this is the
// whole surface: what you were invited to, what you are in, and a way to start
// one.
export default async function GroupsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [groups, invites] = await Promise.all([
    listUserGroups(user.id),
    listInvitesForEmail(user.email),
  ]);

  const rows = await Promise.all(
    groups.map(async (g) => {
      const [header, standing] = await Promise.all([
        groupHeader(g.groupId, user.id),
        standingIn(g.groupId, user.id),
      ]);
      return { ...g, moneyOn: header?.moneyOn ?? false, score: standing.score };
    }),
  );

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-5">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <QuorumMark size={15} />
          <h1 className="text-[14px] font-semibold tracking-[0.16em]">GROUPS</h1>
        </header>

        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-[10px] border-l-[3px] border-l-accent bg-surface p-[13px]"
          >
            <span className="text-[13px] leading-[1.5]">
              {invite.inviterName} invited you to{" "}
              <span className="font-semibold">{invite.groupName}</span>.
            </span>
            <div className="flex gap-[9px]">
              {/* Joining is where sharing is chosen, so Accept opens the join
                  screen rather than joining on the spot. */}
              <Link
                href={`/join/${invite.id}`}
                className="flex h-[34px] items-center border border-fg bg-fg px-[14px] text-[12px] font-semibold text-bg"
              >
                Accept
              </Link>
              <ActionForm action={declineInviteAction}>
                <input type="hidden" name="inviteId" value={invite.id} />
                <SubmitButton className="h-[34px] border border-rule px-[14px] text-[12px] text-muted">
                  Decline
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        ))}

        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">YOUR GROUPS</span>
          {rows.length === 0 ? (
            <p className="text-[12.5px] leading-[1.6] text-muted">
              You are not in a group yet. Start one, or wait for an invite.
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((g) => (
                <Link
                  key={g.groupId}
                  href={`/group/${g.groupId}`}
                  className="flex items-center gap-3 border-b border-rule py-[13px]"
                >
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-[14px]">{g.name}</span>
                    <span className="text-[11px] text-muted">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                      {g.moneyOn ? " · money on" : ""}
                    </span>
                  </div>
                  <RankScore score={g.score} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <details className="border border-rule [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center text-[14px] marker:hidden">
            + New group
          </summary>
          <ActionForm action={createGroupAction}>
            <div className="flex flex-col gap-[10px] border-t border-rule p-[10px]">
              <input
                name="name"
                placeholder="Group name"
                required
                maxLength={60}
                autoFocus
                className="border border-rule bg-transparent px-3 py-[11px] text-[14px] text-fg outline-none placeholder:text-muted"
              />
              <SubmitButton className="h-11 w-full border border-fg bg-fg text-[14px] font-semibold text-bg">
                Create
              </SubmitButton>
            </div>
          </ActionForm>
        </details>

        <div className="border-l-[3px] border-l-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
          Groups are invite-only. Nobody finds one by searching.
        </div>
      </div>
    </main>
  );
}
