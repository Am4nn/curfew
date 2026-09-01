import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups, listInvitesForEmail, userBalances } from "@/server/groups";
import { formatMoney } from "@/domain";
import { ActionForm, SubmitButton, ConfirmButton } from "../ui";
import { createGroupAction, acceptInviteAction, declineInviteAction } from "../actions";

// The full groups surface: invites to answer, the groups you are in, and a new
// group. Home only summarizes; management lives here.
export default async function Groups() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [groups, invites, balances] = await Promise.all([
    listUserGroups(user.id),
    listInvitesForEmail(user.email),
    userBalances(user.id),
  ]);
  const byGroup = new Map(balances.map((b) => [b.groupId, b]));

  return (
    <main className="min-h-dvh px-5 pb-24 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">GROUPS</h1>
        </header>

        {invites.length > 0 ? (
          <section className="mb-7">
            <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">INVITES</div>
            {invites.map((inv) => (
              <div key={inv.id} className="mb-3 border border-rule bg-surface p-[14px]">
                <div className="text-[14px]">
                  You are invited to <span className="font-semibold">{inv.groupName}</span>.
                </div>
                <div className="mt-3 flex gap-2">
                  <ActionForm action={acceptInviteAction} className="flex-1">
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <SubmitButton
                      pendingLabel="Joining"
                      className="h-[42px] w-full border border-fg bg-fg text-[14px] font-semibold text-bg"
                    >
                      Accept
                    </SubmitButton>
                  </ActionForm>
                  <ConfirmButton
                    action={declineInviteAction}
                    fields={{ inviteId: inv.id }}
                    label="Decline"
                    message={`Decline the invite to ${inv.groupName}?`}
                    confirmLabel="Decline"
                  />
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mb-7">
          <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">YOUR GROUPS</div>
          {groups.length === 0 ? (
            <p className="text-[14px] text-muted">No groups yet. Create one below, or wait for an invite.</p>
          ) : (
            groups.map((g) => {
              const bal = byGroup.get(g.groupId);
              return (
                <Link key={g.groupId} href={`/group/${g.groupId}`} className="block border-b border-rule py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px]">{g.name}</span>
                    <span className="text-[12px] text-muted">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"} · {g.role} ›
                    </span>
                  </div>
                  <div className="mt-1 text-[13px]">
                    {bal && bal.netOwed > 0 ? (
                      <span className="text-penalty">you owe {formatMoney(bal.netOwed, bal.currency)}</span>
                    ) : bal && bal.netOwed < 0 ? (
                      <span className="text-pass">you are owed {formatMoney(-bal.netOwed, bal.currency)}</span>
                    ) : (
                      <span className="text-muted">settled</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </section>

        <section>
          <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">NEW GROUP</div>
          <ActionForm action={createGroupAction} resetOnSuccess className="flex items-center gap-2">
            <input
              name="name"
              required
              maxLength={60}
              placeholder="group name"
              className="flex-1 border border-fg bg-transparent px-3 py-[10px] text-[14px]"
            />
            <SubmitButton
              pendingLabel="Creating"
              className="border border-fg bg-fg px-4 py-[10px] text-[14px] font-semibold text-bg"
            >
              Create
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
    </main>
  );
}
