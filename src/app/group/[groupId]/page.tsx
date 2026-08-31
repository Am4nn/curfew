import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import {
  getGroupName,
  listGroupMembersDetailed,
  listGroupPendingInvites,
  groupBalances,
} from "@/server/groups";
import { formatMoney } from "@/domain";
import { ActionForm, SubmitButton, ConfirmButton } from "../../ui";
import { inviteAction, leaveGroupAction, revokeInviteAction } from "../../actions";

export default async function GroupDetail({
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

  const [name, members, invites, balances] = await Promise.all([
    getGroupName(groupId),
    listGroupMembersDetailed(groupId),
    listGroupPendingInvites(groupId),
    groupBalances(groupId),
  ]);
  if (!name) notFound();

  const isOwner = members.find((m) => m.userId === user.id)?.role === "owner";

  return (
    <main className="min-h-dvh px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between gap-3 border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">{name}</h1>
          <span className="flex items-baseline gap-3 text-[12px] text-muted">
            <Link href="/ledger" className="underline">ledger</Link>
            <Link href="/settings" className="underline">rules</Link>
            <Link href="/" className="underline">dashboard</Link>
          </span>
        </header>

        <section className="mb-8">
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">MEMBERS</h2>
          {members.map((m) => {
            const bal = balances.get(m.userId);
            const you = m.userId === user.id;
            return (
              <div key={m.userId} className="border-b border-rule py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[14px]">
                    {m.name}
                    {you ? <span className="text-muted"> (you)</span> : null}
                    <span className="ml-2 text-[12px] text-muted">{m.role}</span>
                  </div>
                  <div className="text-[13px] tabular-nums">
                    {bal && bal.netOwed > 0 ? (
                      <span className="text-penalty">owes {formatMoney(bal.netOwed, bal.currency)}</span>
                    ) : bal && bal.netOwed < 0 ? (
                      <span className="text-pass">owed {formatMoney(-bal.netOwed, bal.currency)}</span>
                    ) : (
                      <span className="text-muted">settled</span>
                    )}
                  </div>
                </div>
                <div className="text-[12px] text-muted">
                  joined {m.joinedAt}
                  {m.leftAt ? ` · left ${m.leftAt}` : ""}
                </div>
              </div>
            );
          })}
        </section>

        {invites.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">PENDING INVITES</h2>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 border-b border-rule py-3 text-[14px]">
                <span className="break-all">{inv.email}</span>
                {isOwner ? (
                  <ConfirmButton
                    action={revokeInviteAction}
                    fields={{ inviteId: inv.id, groupId }}
                    label="Revoke"
                    message={`Withdraw the invite to ${inv.email}?`}
                    confirmLabel="Revoke"
                  />
                ) : (
                  <span className="text-[12px] text-muted">pending</span>
                )}
              </div>
            ))}
          </section>
        ) : null}

        <section className="mb-8">
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">INVITE</h2>
          <ActionForm action={inviteAction} resetOnSuccess className="flex items-center gap-2">
            <input type="hidden" name="groupId" value={groupId} />
            <input
              name="email"
              type="email"
              required
              placeholder="email"
              className="flex-1 border border-fg bg-transparent px-3 py-[8px] text-[14px]"
            />
            <SubmitButton
              pendingLabel="Inviting"
              className="border border-fg bg-fg px-4 py-[8px] text-[14px] text-bg"
            >
              Invite
            </SubmitButton>
          </ActionForm>
        </section>

        <ConfirmButton
          action={leaveGroupAction}
          fields={{ groupId }}
          label="Leave this group"
          message={`Leave ${name}? Your balance and history stay.`}
          confirmLabel="Leave"
        />
      </div>
    </main>
  );
}
