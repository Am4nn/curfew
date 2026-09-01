import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import {
  listGroupMembersDetailed,
  listGroupPendingInvites,
  groupBalances,
} from "@/server/groups";
import { getGroupLedgerRows } from "@/server/ledger";
import { groupMemberStreaks } from "@/server/streak";
import { formatMoney } from "@/domain";
import { ActionForm, SubmitButton, ConfirmButton } from "../../ui";
import { inviteAction, leaveGroupAction, revokeInviteAction } from "../../actions";

export default async function GroupOverview({
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

  const [members, invites, balances, streaks, rows] = await Promise.all([
    listGroupMembersDetailed(groupId),
    listGroupPendingInvites(groupId),
    groupBalances(groupId),
    groupMemberStreaks(groupId, user.id),
    getGroupLedgerRows(groupId),
  ]);

  const isOwner = members.find((m) => m.userId === user.id)?.role === "owner";
  const mine = balances.get(user.id);

  // Pairwise net between the viewer and each other member. Positive = viewer owes.
  const pair = new Map<string, { amount: number; currency: string }>();
  for (const r of rows) {
    if (r.fromUserId === user.id) {
      const cur = pair.get(r.toUserId) ?? { amount: 0, currency: r.currency };
      pair.set(r.toUserId, { amount: cur.amount + r.amount, currency: r.currency });
    } else if (r.toUserId === user.id) {
      const cur = pair.get(r.fromUserId) ?? { amount: 0, currency: r.currency };
      pair.set(r.fromUserId, { amount: cur.amount - r.amount, currency: r.currency });
    }
  }

  return (
    <>
      <div className="mb-5 text-[13px]">
        {mine && mine.netOwed > 0 ? (
          <span className="text-penalty">You owe {formatMoney(mine.netOwed, mine.currency)} in this group.</span>
        ) : mine && mine.netOwed < 0 ? (
          <span className="text-pass">You are owed {formatMoney(-mine.netOwed, mine.currency)} in this group.</span>
        ) : (
          <span className="text-muted">Settled in this group.</span>
        )}
      </div>

      <section className="mb-6">
        <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">MEMBERS</div>
        {members.map((m) => {
          const you = m.userId === user.id;
          const streak = streaks.get(m.userId);
          const p = pair.get(m.userId);
          return (
            <div key={m.userId} className="flex items-baseline justify-between gap-3 border-b border-rule py-[11px]">
              <div className="flex flex-col gap-[2px]">
                <span className="text-[14px]">
                  {you ? "You" : m.name}
                  {m.leftAt ? <span className="text-muted"> (left)</span> : null}
                </span>
                <span className="text-[12px] text-muted">
                  {typeof streak === "number" ? `streak ${streak}` : "no streak yet"}
                </span>
              </div>
              <div className="text-[13px] tabular-nums">
                {you ? (
                  <span className="text-muted">{m.role}</span>
                ) : p && p.amount > 0 ? (
                  <span className="text-penalty">you owe {formatMoney(p.amount, p.currency)}</span>
                ) : p && p.amount < 0 ? (
                  <span className="text-pass">owes you {formatMoney(-p.amount, p.currency)}</span>
                ) : (
                  <span className="text-muted">settled</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <Link
        href={`/group/${groupId}/ledger`}
        className="mb-6 flex h-[46px] items-center justify-center border border-fg text-[14px] tracking-[0.04em]"
      >
        Settle up
      </Link>

      <section className="mb-8">
        <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">INVITE</div>
        <ActionForm action={inviteAction} resetOnSuccess className="flex items-center gap-2">
          <input type="hidden" name="groupId" value={groupId} />
          <input
            name="email"
            type="email"
            required
            placeholder="email address"
            className="flex-1 border border-rule bg-transparent px-3 py-[10px] text-[14px]"
          />
          <SubmitButton
            pendingLabel="Sending"
            className="border border-rule bg-surface px-4 py-[10px] text-[14px]"
          >
            Send
          </SubmitButton>
        </ActionForm>
        {invites.map((inv) => (
          <div key={inv.id} className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted">
            <span className="break-all">{inv.email} · pending</span>
            {isOwner ? (
              <ConfirmButton
                action={revokeInviteAction}
                fields={{ inviteId: inv.id, groupId }}
                label="Revoke"
                message={`Withdraw the invite to ${inv.email}?`}
                confirmLabel="Revoke"
              />
            ) : null}
          </div>
        ))}
      </section>

      <ConfirmButton
        action={leaveGroupAction}
        fields={{ groupId }}
        label="Leave this group"
        message="Leave this group? Your balance and history stay."
        confirmLabel="Leave"
      />
    </>
  );
}
