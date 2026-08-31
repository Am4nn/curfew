import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  listUserGroups,
  listInvitesForEmail,
  userBalances,
} from "@/server/groups";
import { isAdmin } from "@/server/admin";
import { getCheckinState } from "@/server/checkin";
import { formatMoney } from "@/domain";
import { SignOut } from "./sign-out";
import {
  createGroupAction,
  inviteAction,
  acceptInviteAction,
  declineInviteAction,
  leaveGroupAction,
} from "./actions";

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [groups, invites, balances, admin] = await Promise.all([
    listUserGroups(user.id),
    listInvitesForEmail(user.email),
    userBalances(user.id),
    isAdmin(user.id),
  ]);
  const netByGroup = new Map(balances.map((b) => [b.groupId, b]));
  const checkin = groups.length > 0 ? await getCheckinState(user.id) : null;

  return (
    <main className="min-h-screen px-5 pb-20 pt-7">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-7 flex items-baseline justify-between border-b-2 border-fg pb-[10px]">
          <h1 className="text-[15px] font-semibold tracking-[0.14em]">CURFEW</h1>
          <span className="flex items-baseline gap-3 text-[12px] text-muted">
            {admin ? (
              <Link href="/admin" className="underline">
                admin
              </Link>
            ) : null}
            <span>{user.email}</span>
          </span>
        </header>

        {checkin ? (
          <Link
            href="/checkin"
            className="mb-7 block border-2 border-fg bg-fg px-[18px] py-4 text-bg"
          >
            <div className="text-[13px] uppercase tracking-[0.1em] opacity-80">
              Check-in
            </div>
            <div className="mt-1 text-[16px]">{summary(checkin)}</div>
          </Link>
        ) : null}

        {invites.length > 0 ? (
          <section className="mb-7">
            <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">INVITES</h2>
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between border-b border-rule py-3 text-[14px]"
              >
                <span>{inv.groupName}</span>
                <span className="flex gap-2">
                  <form action={acceptInviteAction}>
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <button className="border border-fg bg-fg px-3 py-[6px] text-[13px] text-bg">
                      Accept
                    </button>
                  </form>
                  <form action={declineInviteAction}>
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <button className="border border-fg px-3 py-[6px] text-[13px]">
                      Decline
                    </button>
                  </form>
                </span>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mb-7">
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">GROUPS</h2>
          {groups.length === 0 ? (
            <p className="text-[14px] text-muted">
              No groups yet. Create one below, or wait for an invite.
            </p>
          ) : (
            groups.map((g) => {
              const bal = netByGroup.get(g.groupId);
              return (
                <div key={g.groupId} className="border-b border-rule py-4">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[15px]">{g.name}</div>
                    <div className="text-[12px] text-muted">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"} · {g.role}
                    </div>
                  </div>

                  <div className="mt-1 text-[13px]">
                    {bal && bal.netOwed > 0 ? (
                      <span className="text-penalty">
                        You owe {formatMoney(bal.netOwed, bal.currency)}
                      </span>
                    ) : bal && bal.netOwed < 0 ? (
                      <span className="text-pass">
                        You are owed {formatMoney(-bal.netOwed, bal.currency)}
                      </span>
                    ) : (
                      <span className="text-muted">Settled</span>
                    )}
                    <Link href="/ledger" className="ml-3 text-muted underline">
                      ledger
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={inviteAction} className="flex items-center gap-2">
                      <input type="hidden" name="groupId" value={g.groupId} />
                      <input
                        name="email"
                        type="email"
                        placeholder="invite email"
                        className="w-40 border border-fg bg-transparent px-2 py-[6px] text-[13px]"
                      />
                      <button className="border border-fg px-3 py-[6px] text-[13px]">
                        Invite
                      </button>
                    </form>
                    <form action={leaveGroupAction}>
                      <input type="hidden" name="groupId" value={g.groupId} />
                      <button className="border border-rule px-3 py-[6px] text-[13px] text-muted">
                        Leave
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-[13px] font-semibold tracking-[0.1em]">
            NEW GROUP
          </h2>
          <form action={createGroupAction} className="flex items-center gap-2">
            <input
              name="name"
              placeholder="group name"
              className="flex-1 border border-fg bg-transparent px-3 py-[8px] text-[14px]"
            />
            <button className="border border-fg bg-fg px-4 py-[8px] text-[14px] text-bg">
              Create
            </button>
          </form>
        </section>

        <SignOut />
      </div>
    </main>
  );
}

function summary(state: Awaited<ReturnType<typeof getCheckinState>>): string {
  const a = state.action;
  if (a.kind === "open") return `${a.label} window open, closes ${a.closesLabel}`;
  if (a.kind === "waiting")
    return a.next
      ? `${a.label} recorded ${a.recordedLabel}. Next: ${a.next.label} ${a.next.opensLabel}`
      : `${a.label} recorded ${a.recordedLabel}`;
  return a.next
    ? `Next: ${a.next.label}, ${a.next.opensLabel}–${a.next.closesLabel}`
    : "Nothing open right now";
}
