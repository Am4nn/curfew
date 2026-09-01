import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  listUserGroups,
  listInvitesForEmail,
  userBalances,
  type PendingInvite,
} from "@/server/groups";
import { hasAdminAccess } from "@/server/admin";
import { getCheckinState, type CheckinState } from "@/server/checkin";
import { getPersonalStreak } from "@/server/streak";
import { formatMoney } from "@/domain";
import { QuorumMark } from "./mark";
import { CheckinButton } from "./checkin-button";
import { ActionForm, SubmitButton, ConfirmButton } from "./ui";
import {
  createGroupAction,
  acceptInviteAction,
  declineInviteAction,
} from "./actions";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [groups, invites, admin] = await Promise.all([
    listUserGroups(user.id),
    listInvitesForEmail(user.email),
    hasAdminAccess(user.id),
  ]);

  const header = (
    <header className="-mx-5 mb-7 flex items-center justify-between gap-3 border-b border-rule px-5 pb-[10px]">
      <h1 className="flex items-center gap-2 text-[15px] font-semibold tracking-[0.14em]">
        <QuorumMark size={15} />
        CURFEW
      </h1>
      {admin ? (
        <Link href="/admin" className="text-[12px] text-muted">
          Admin ›
        </Link>
      ) : null}
    </header>
  );

  // New user with no group: the invite is the hero, else the create prompt.
  if (groups.length === 0) {
    return (
      <Shell>
        {header}
        {invites.length > 0 ? <InviteHero invite={invites[0]} /> : <NoGroup />}
      </Shell>
    );
  }

  const [balances, checkin, streak] = await Promise.all([
    userBalances(user.id),
    getCheckinState(user.id),
    getPersonalStreak(user.id),
  ]);

  return (
    <Shell>
      {header}
      {invites.length > 0 ? (
        <Link
          href="/groups"
          className="mb-6 flex items-center justify-between gap-3 border border-rule bg-surface px-[14px] py-3 text-[13px]"
        >
          <span>
            <Highlight>{invites[0].groupName}</Highlight> invite waiting
          </span>
          <span className="whitespace-nowrap text-accent">View ›</span>
        </Link>
      ) : null}

      <StreakBlock current={streak.current} best={streak.best} />
      <CheckinHero state={checkin} />
      <Balances balances={balances} />
      <GroupsList groups={groups} balances={balances} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto max-w-[560px]">{children}</div>
    </main>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="bg-rule px-[6px] py-[1px] font-semibold">{children}</span>;
}

// STREAK: personal, generic across activities. No "nights", no group. The flame
// carries warm fire tones (a two-tone icon, not a broad UI gradient), and the
// row spans the width so the number and "best" anchor each end.
function Flame({ size = 34 }: { size?: number }) {
  return (
    <svg className="flame" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="flame-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ffc24b" />
          <stop offset="55%" stopColor="#ff7a2f" />
          <stop offset="100%" stopColor="#e4574b" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c2.5 3.5 4.6 5.6 4.6 9.1a4.6 4.6 0 0 1-9.2 0c0-1.5.5-2.6 1.5-3.7C10.4 8.6 12 6.1 12 2Z"
        fill="url(#flame-grad)"
      />
      <path
        d="M12 12.4c1 .9 1.6 1.7 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-.8.5-1.6 1.6-2.8Z"
        fill="#ffe6a1"
      />
    </svg>
  );
}

function StreakBlock({ current, best }: { current: number; best: number }) {
  return (
    <section className="mb-7">
      <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">STREAK</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[12px]">
          <Flame />
          <span className="text-[40px] font-semibold leading-none tabular-nums">{current}</span>
        </div>
        <span className="text-[12px] text-muted">best {best}</span>
      </div>
    </section>
  );
}

// The one-tap check-in, on Home for every window. Tonight's three steps read as
// status, not buttons; only the open window shows a press.
function CheckinHero({ state }: { state: CheckinState }) {
  const { action, steps } = state;
  const done = steps.filter((s) => s.at !== null).length;

  return (
    <section className="mb-7 border border-rule bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className={"text-[11px] tracking-[0.14em] " + (action.kind === "open" ? "text-pass" : "text-muted")}>
          {action.kind === "open" ? "CHECK-IN OPEN" : action.kind === "waiting" ? "RECORDED" : "NO WINDOW OPEN"}
        </div>
        <div className="text-[11px] tabular-nums text-muted">{done} of 3 recorded</div>
      </div>

      {action.kind === "open" ? (
        <div className="mt-3">
          <div className="text-[16px] font-medium">{action.label} check-in</div>
          <div className="mt-1 text-[13px] text-muted">
            Window closes {action.closesLabel}. Miss it and last night does not count.
          </div>
        </div>
      ) : action.kind === "waiting" ? (
        <div className="mt-3">
          <div className="text-[16px] font-medium">{action.label} check-in</div>
          <div className="mt-1 text-[13px] text-muted">
            Recorded {action.recordedLabel}.
            {action.next ? ` Next: ${action.next.label} ${action.next.opensLabel}.` : ""}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[13px] text-muted">
          {action.next
            ? `Next: ${action.next.label}, ${action.next.opensLabel}–${action.next.closesLabel}.`
            : "Nothing more tonight."}
        </div>
      )}

      <div className="mt-3 flex items-center gap-[18px] py-[2px]">
        {steps.map((s) => {
          const isOpen = action.kind === "open" && action.step === s.key;
          const cls =
            s.at !== null
              ? "bg-pass"
              : isOpen
                ? "bg-fg"
                : "border border-muted";
          return (
            <span key={s.key} className="flex items-center gap-[7px]">
              <span className={"h-2 w-2 " + cls} />
              <span className={"text-[12px] " + (s.at !== null || isOpen ? "text-fg" : "text-muted")}>
                {s.label}
              </span>
            </span>
          );
        })}
      </div>

      {action.kind === "open" ? (
        <div className="mt-3">
          <CheckinButton
            label="Check in"
            className="h-12 w-full border border-fg bg-fg text-[15px] font-semibold tracking-[0.04em] text-bg disabled:opacity-60"
          />
        </div>
      ) : null}
    </section>
  );
}

type Balance = { groupId: string; currency: string; netOwed: number };

function Balances({ balances }: { balances: Balance[] }) {
  const currency = balances.find((b) => b.currency)?.currency ?? "INR";
  const owe = balances.reduce((s, b) => s + Math.max(b.netOwed, 0), 0);
  const owed = balances.reduce((s, b) => s + Math.max(-b.netOwed, 0), 0);
  if (owe === 0 && owed === 0) return null;

  return (
    <section className="mb-7">
      <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">BALANCES</div>
      <div className="grid grid-cols-2 gap-[10px]">
        <BalanceTile label="YOU OWE" amount={owe} currency={currency} color="text-penalty" />
        <BalanceTile label="YOU ARE OWED" amount={owed} currency={currency} color="text-pass" />
      </div>
    </section>
  );
}

function BalanceTile({
  label,
  amount,
  currency,
  color,
}: {
  label: string;
  amount: number;
  currency: string;
  color: string;
}) {
  return (
    <Link href="/balances" className="flex flex-col gap-[6px] border border-rule p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"text-[18px] tabular-nums " + color}>{formatMoney(amount, currency)}</div>
      <div className="text-[12px] text-muted">see who ›</div>
    </Link>
  );
}

function GroupsList({ groups, balances }: { groups: Awaited<ReturnType<typeof listUserGroups>>; balances: Balance[] }) {
  const byGroup = new Map(balances.map((b) => [b.groupId, b]));
  return (
    <section>
      <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">GROUPS</div>
      {groups.map((g) => {
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
      })}
    </section>
  );
}

// No group, no invite.
function NoGroup() {
  return (
    <>
      <div className="border border-rule bg-surface p-[18px]">
        <div className="text-[16px]">You are not in a group yet.</div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Curfew holds you to a sleep routine with a group. Your check-ins and streak begin once you are in one.
        </p>
        <ActionForm action={createGroupAction} resetOnSuccess className="mt-4 flex items-center gap-2">
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
      </div>
      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        Invited by someone? Ask them to use this email. Invites appear at the top of this screen.
      </p>
    </>
  );
}

// No group, but an invite is waiting: it is the hero.
function InviteHero({ invite }: { invite: PendingInvite }) {
  return (
    <>
      <div className="mb-6">
        <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">INVITE</div>
        <div className="border border-rule bg-surface p-4">
          <div className="text-[15px] leading-relaxed">
            You are invited to <span className="font-semibold">{invite.groupName}</span>.
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Accept to join and your nightly check-ins start tomorrow.
          </p>
          <div className="mt-4 flex gap-2">
            <ActionForm action={acceptInviteAction} className="flex-1">
              <input type="hidden" name="inviteId" value={invite.id} />
              <SubmitButton
                pendingLabel="Joining"
                className="h-[46px] w-full border border-fg bg-fg text-[14px] font-semibold text-bg"
              >
                Accept
              </SubmitButton>
            </ActionForm>
            <ConfirmButton
              action={declineInviteAction}
              fields={{ inviteId: invite.id }}
              label="Decline"
              message={`Decline the invite to ${invite.groupName}?`}
              confirmLabel="Decline"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-[10px] text-[11px] tracking-[0.14em] text-muted">OR START YOUR OWN</div>
        <ActionForm action={createGroupAction} resetOnSuccess className="flex items-center gap-2">
          <input
            name="name"
            required
            maxLength={60}
            placeholder="group name"
            className="flex-1 border border-rule bg-transparent px-3 py-[10px] text-[14px]"
          />
          <SubmitButton
            pendingLabel="Creating"
            className="border border-rule bg-surface px-4 py-[10px] text-[14px]"
          >
            Create
          </SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
