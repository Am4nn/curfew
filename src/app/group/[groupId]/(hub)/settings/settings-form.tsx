"use client";

import { useOptimistic, useState } from "react";
import Link from "next/link";
import { formatMoney, minorUnitExponent } from "@/domain";
import { ActivityIcon } from "../../../../activity-icon";
import { CheckRow, SubmitButton, Toggle, useServerAction } from "@/app/ui";
import {
  setShareAction,
  setAcceptedAction,
  setMoneyAction,
  setFineAction,
  setMemberRoleAction,
  cancelInviteAction,
  leaveGroupAction,
} from "./actions";

// Group settings, as a hub rather than a scroll.
//
// It was 581 lines and five labelled sections in one column, and it mixed what
// only you can change with what only an owner can, without separating them. A
// member scrolled past the group's accepted types, its fine table, its roster
// and its outstanding invitations to reach their own two switches.
//
// Two things fix that, and they are the same two the configure screen settled
// on, which is the point: one vocabulary for both.
//
//   A SWITCH, not a heading.  Yours and The group are different jobs for
//   different people. A member sees the switch with the right half absent, not
//   greyed, because a greyed control is a thing you might one day press.
//
//   PROSE, then one thing at a time.  Each half opens on a sentence saying
//   where you stand, and under it a list where every row is one decision. The
//   controls still exist and are one press away; what is gone is all of them
//   being in front of everybody at once.
//
// A panel is a query parameter rather than a route, so the whole screen is one
// page component with one set of queries, and Back works without a layout that
// has to know whether to draw the hub's tabs.

interface MemberRow {
  userId: string;
  name: string;
  role: "owner" | "member";
}

interface InviteRow {
  id: string;
  email: string;
  invitedByName: string;
  canCancel: boolean;
}

export interface ShareRow {
  typeKey: string;
  name: string;
  icon: string;
  accepted: boolean;
  shared: boolean;
  /** Whether the viewer actually tracks this. An untracked type has no
   *  schedule to check in against, so sharing it could only ever be a miss.
   *  The server refuses it too. */
  tracked: boolean;
  shareEvidence: boolean;
  takesEvidence: boolean;
  /** "18 day streak", or why it is not shared. */
  sub: string;
}

/** One share row's new state, applied before the server has agreed to it. */
type SharePatch = { typeKey: string } & Partial<Pick<ShareRow, "shared" | "shareEvidence">>;

export interface AcceptedRow {
  typeKey: string;
  name: string;
  icon: string;
  sharers: number;
  fineAmount: number;
  currency: string;
}

export type Panel = "sharing" | "cost" | "types" | "money" | "members";

interface Props {
  groupId: string;
  groupName: string;
  isOwner: boolean;
  moneyOn: boolean;
  appMoneyOn: boolean;
  shares: ShareRow[];
  accepted: AcceptedRow[];
  addable: { typeKey: string; name: string; icon: string }[];
  members: MemberRow[];
  invites: InviteRow[];
  viewerId: string;
  /** Your ceiling here, already computed the way the nightly pass computes it. */
  ceiling: number;
  /** Which half is showing, and which panel is open inside it. */
  half: "yours" | "group";
  panel: Panel | null;
}

/** A list of English words: "Sleep, Gym and Food". */
function listOf(names: string[]): string {
  if (names.length === 0) return "nothing yet";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function SettingsForm(props: Props) {
  const { groupId, half, panel } = props;
  const base = `/group/${groupId}/settings`;
  const here = half === "group" ? `${base}?half=group` : base;

  if (panel) return <PanelView {...props} back={here} />;

  return (
    <div className="flex flex-col gap-[22px] px-5 pb-6 pt-3.5">
      {/* A member owns nothing, so there is no second half to switch to. */}
      {props.isOwner ? (
        <div className="flex">
          <Link
            href={base}
            className={
              "flex h-[38px] flex-1 items-center justify-center border text-xs tracking-wider " +
              (half === "yours"
                ? "border-fg bg-fg text-bg"
                : "border-rule text-muted")
            }
          >
            YOURS
          </Link>
          <Link
            href={`${base}?half=group`}
            className={
              "flex h-[38px] flex-1 items-center justify-center border border-l-0 text-xs tracking-wider " +
              (half === "group"
                ? "border-fg bg-fg text-bg"
                : "border-rule text-muted")
            }
          >
            THE GROUP
          </Link>
        </div>
      ) : null}

      {half === "group" ? <GroupHalf {...props} /> : <YourHalf {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yours
// ---------------------------------------------------------------------------

function YourHalf({
  groupId,
  groupName,
  shares,
  accepted,
  moneyOn,
  appMoneyOn,
  ceiling,
}: Props) {
  const sharedCount = shares.filter((s) => s.shared).length;
  const withFines = accepted.filter((a) => a.fineAmount > 0);
  const base = `/group/${groupId}/settings`;

  const cost =
    !appMoneyOn || !moneyOn
      ? "no money here"
      : withFines.length === 0
        ? "no fines set"
        : listOf(withFines.map((a) => `${a.name} ${formatMoney(a.fineAmount, a.currency)}`));

  return (
    <>
      <Rule>
        <p className="text-lg leading-relaxed">
          {groupName} accepts {listOf(shares.map((s) => s.name))}.
        </p>
        <p className="text-xs leading-loose text-muted">
          You share {sharedCount === 0 ? "none" : sharedCount} of{" "}
          {shares.length === 1 ? "it" : `the ${shares.length}`}, so your ceiling here is{" "}
          {ceiling}. Sharing more raises it. Stopping does not erase what you earned,
          it settles to the lower number.
        </p>
      </Rule>

      <Section title="CHANGE ONE THING">
        <Row
          href={`${base}?panel=sharing`}
          label="What this group sees"
          value={`${sharedCount} of ${shares.length}`}
        />
        <Row href={`${base}?panel=cost`} label="What it costs you" value={cost} />
      </Section>

      <LeaveGroup groupId={groupId} />
    </>
  );
}

// ---------------------------------------------------------------------------
// The group
// ---------------------------------------------------------------------------

function GroupHalf({
  groupId,
  accepted,
  members,
  invites,
  moneyOn,
  appMoneyOn,
}: Props) {
  const base = `/group/${groupId}/settings`;
  const out = invites.length;

  return (
    <>
      <Rule>
        <p className="text-lg leading-relaxed">
          You own this group, so these are yours to set.
        </p>
        <p className="text-xs leading-loose text-muted">
          Every member feels them. Nothing here touches what you personally share,
          which is on the other side.
        </p>
      </Rule>

      <Section title="CHANGE ONE THING">
        <Row
          href={`${base}?panel=types`}
          label="Activities it accepts"
          value={listOf(accepted.map((a) => a.name))}
        />
        <Row
          href={`${base}?panel=members`}
          label="Members"
          value={
            out === 0
              ? `${members.length}`
              : `${members.length}, ${out} invite${out === 1 ? "" : "s"} out`
          }
        />
        {appMoneyOn ? (
          <Row
            href={`${base}?panel=money`}
            label="Fines"
            value={moneyOn ? "on" : "off"}
          />
        ) : null}
      </Section>

      <p className="text-2xs leading-relaxed text-muted">
        A change to a fine starts tomorrow, never today. A period already running is
        judged on the rule it began under.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// The panels: the old sections, one screen each
// ---------------------------------------------------------------------------

function PanelView(props: Props & { back: string }) {
  const { panel, back } = props;
  const title: Record<Panel, string> = {
    sharing: "What this group sees",
    cost: "What it costs you",
    types: "Activities it accepts",
    money: "Fines",
    members: "Members",
  };

  return (
    <div className="flex flex-col gap-[18px] px-5 pb-6 pt-3.5">
      <Link href={back} className="flex items-center gap-[9px] text-sm text-muted">
        <span className="text-base">&#8249;</span>
        Back
      </Link>
      <h2 className="text-lg font-semibold">{title[panel!]}</h2>
      {panel === "sharing" ? <SharingPanel {...props} /> : null}
      {panel === "cost" ? <CostPanel {...props} /> : null}
      {panel === "types" ? <TypesPanel {...props} /> : null}
      {panel === "money" ? <MoneyPanel {...props} /> : null}
      {panel === "members" ? <MembersPanel {...props} /> : null}
    </div>
  );
}

function SharingPanel({ groupId, shares }: Props) {
  const { run: runAction, pending: busy, error } = useServerAction();

  // What you share is yours and reversible, so these two controls move on the
  // press. Everything an owner changes waits for the real answer instead.
  const [view, patch] = useOptimistic(shares, (state, p: SharePatch) =>
    state.map((r) => (r.typeKey === p.typeKey ? { ...r, ...p } : r)),
  );

  function run(fn: () => Promise<void>, optimistic?: SharePatch) {
    runAction(async () => {
      if (optimistic) patch(optimistic);
      await fn();
    });
  }

  if (view.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        This group accepts nothing yet, so there is nothing to share.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {view.map((row) => (
          <div key={row.typeKey} className="flex flex-col border-b border-rule">
            <div
              className={
                "flex items-center gap-[11px] pt-[13px] " +
                (row.shared && row.takesEvidence ? "pb-[9px]" : "pb-[13px]")
              }
            >
              <span className={"flex flex-none " + (row.shared ? "text-fg" : "text-muted")}>
                <ActivityIcon name={row.icon} />
              </span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="text-sm">{row.name}</span>
                <span className="text-2xs text-muted">{row.sub}</span>
              </div>
              {row.tracked ? (
                <Toggle
                  on={row.shared}
                  onClick={() =>
                    run(
                      () =>
                        setShareAction({
                          groupId,
                          typeKey: row.typeKey,
                          shared: !row.shared,
                          shareEvidence: row.shareEvidence,
                        }),
                      { typeKey: row.typeKey, shared: !row.shared },
                    )
                  }
                />
              ) : (
                // The join screen's affordance: the way out of an untracked row
                // is to set the activity up, not a switch that cannot mean
                // anything.
                <Link
                  href={`/activities/${row.typeKey}`}
                  className="flex-none text-2xs text-accent underline underline-offset-2"
                >
                  Set it up first
                </Link>
              )}
            </div>

            {row.shared && row.takesEvidence ? (
              <CheckRow
                on={row.shareEvidence}
                className="pb-[13px] pl-[29px]"
                onClick={() =>
                  run(
                    () =>
                      setShareAction({
                        groupId,
                        typeKey: row.typeKey,
                        shared: true,
                        shareEvidence: !row.shareEvidence,
                      }),
                    { typeKey: row.typeKey, shareEvidence: !row.shareEvidence },
                  )
                }
              >
                Share evidence with this group
              </CheckRow>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-2xs leading-relaxed text-muted">
        A group only ever sees what you switch on here, and nothing from before you
        joined it. Stopping tracking an activity stops sharing it too.
      </p>
      <Err error={error} />
      <Busy busy={busy} />
    </>
  );
}

function CostPanel({ accepted, moneyOn, appMoneyOn }: Props) {
  if (!appMoneyOn || !moneyOn) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        This group does not track money, so nothing here costs anything.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {accepted.map((row) => (
          <div
            key={row.typeKey}
            className="flex items-center justify-between gap-3 border-b border-rule py-3"
          >
            <span className="text-sm">{row.name}</span>
            <span
              className={
                "text-xs " + (row.fineAmount > 0 ? "text-penalty" : "text-muted")
              }
            >
              {row.fineAmount > 0
                ? formatMoney(row.fineAmount, row.currency)
                : "no fine"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-2xs leading-relaxed text-muted">
        A fine is owed between members and split among whoever passed. Curfew never
        collects anything. Only an owner can change these.
      </p>
    </>
  );
}

function TypesPanel({ groupId, accepted, addable }: Props) {
  const { run: runAction, pending: busy, error } = useServerAction();
  const [adding, setAdding] = useState(false);
  const run = (fn: () => Promise<void>) => runAction(fn);

  return (
    <>
      <div className="flex flex-col">
        {accepted.map((row) => (
          <div
            key={row.typeKey}
            className="flex items-center gap-[11px] border-b border-rule py-3"
          >
            <span className="flex flex-none">
              <ActivityIcon name={row.icon} />
            </span>
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-sm">{row.name}</span>
              <span className="text-2xs text-muted">
                {row.sharers} {row.sharers === 1 ? "member shares" : "members share"}
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => setAcceptedAction({ groupId, typeKey: row.typeKey, accepted: false }))
              }
              className="flex-none text-2xs text-penalty disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="flex flex-col">
          {addable.map((t) => (
            <button
              key={t.typeKey}
              type="button"
              onClick={() => {
                setAdding(false);
                run(() => setAcceptedAction({ groupId, typeKey: t.typeKey, accepted: true }));
              }}
              disabled={busy}
              className="flex items-center gap-[11px] border-b border-rule py-3 text-left active:opacity-70 disabled:opacity-40"
            >
              <ActivityIcon name={t.icon} />
              <span className="flex-1 text-sm">{t.name}</span>
              <span className="text-2xs text-muted">Accept</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={addable.length === 0 || busy}
          onClick={() => setAdding(true)}
          className="h-11 w-full border border-rule text-base active:opacity-70 disabled:opacity-40"
        >
          + Accept another activity
        </button>
      )}
      <p className="text-2xs leading-relaxed text-muted">
        Removing a type stops it counting here. Nothing anybody already earned is
        rewritten.
      </p>
      <Err error={error} />
    </>
  );
}

function MoneyPanel({ groupId, accepted, moneyOn }: Props) {
  const { run: runAction, pending: busy, error } = useServerAction();
  const run = (fn: () => Promise<void>) => runAction(fn);

  return (
    <>
      <div className="flex items-center gap-[11px] border-b border-rule py-3">
        <div className="flex flex-1 flex-col gap-[3px]">
          <span className="text-sm">Track money</span>
          <span className="text-2xs leading-relaxed text-muted">
            Fines are owed between members, never collected by Curfew
          </span>
        </div>
        <Toggle
          on={moneyOn}
          label="Track money in this group"
          disabled={busy}
          pending={busy}
          onClick={() => run(() => setMoneyAction({ groupId, on: !moneyOn }))}
        />
      </div>

      {moneyOn
        ? accepted.map((row) => (
            <FineRow
              key={row.typeKey}
              row={row}
              onSave={(amount) =>
                run(() =>
                  setFineAction({
                    groupId,
                    typeKey: row.typeKey,
                    amount,
                    currency: row.currency,
                  }),
                )
              }
            />
          ))
        : null}

      <p className="text-2xs leading-relaxed text-muted">
        A change starts tomorrow at the earliest. A period already running is judged
        on the rule it began under.
      </p>
      <Err error={error} />
    </>
  );
}

function MembersPanel({ groupId, members, invites, viewerId }: Props) {
  const { run: runAction, pending: busy, error } = useServerAction();
  const run = (fn: () => Promise<void>) => runAction(fn);

  return (
    <>
      <div className="flex flex-col">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-[11px] border-b border-rule py-3">
            <div className="flex flex-1 flex-col gap-[3px]">
              {/* One string, not a name and a suffix beside it. Two text nodes
                  render the same but cannot be matched as one, which is a
                  needless way to make the row hard to address. */}
              <span className="text-sm">
                {m.userId === viewerId ? `${m.name} (you)` : m.name}
              </span>
              <span className="text-2xs text-muted">
                {m.role === "owner" ? "Owner" : "Member"}
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setMemberRoleAction({
                    groupId,
                    userId: m.userId,
                    role: m.role === "owner" ? "member" : "owner",
                  });
                })
              }
              className="h-[34px] flex-none border border-rule px-[13px] text-xs active:opacity-70 disabled:opacity-60"
            >
              {m.role === "owner" ? "Step down" : "Make owner"}
            </button>
          </div>
        ))}
      </div>

      {invites.length > 0 ? (
        <>
          <span className="pt-2 text-micro tracking-label text-muted">INVITES OUT</span>
          <div className="flex flex-col">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-[11px] border-b border-rule py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-sm">{invite.email}</span>
                  <span className="text-2xs text-muted">
                    Invited by {invite.invitedByName}
                  </span>
                </div>
                {invite.canCancel ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await cancelInviteAction({ groupId, inviteId: invite.id });
                      })
                    }
                    className="h-[34px] flex-none border border-rule px-[13px] text-xs active:opacity-70 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="text-2xs leading-relaxed text-muted">
        A group always keeps one owner: the last one cannot step down. Cancelling an
        invite stops the link working, nobody is told, and the same address can be
        invited again.
      </p>
      <Err error={error} />
    </>
  );
}

// ---------------------------------------------------------------------------
// The small shared pieces
// ---------------------------------------------------------------------------

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-rule bg-surface">
      <div className="border-b border-rule px-4 py-3">
        <span className="text-micro tracking-label text-muted">WHERE YOU STAND</span>
      </div>
      <div className="flex flex-col gap-[11px] p-4">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className="text-micro tracking-label text-muted">{title}</span>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Row({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 border-b border-rule py-[15px] first:border-t active:opacity-70"
    >
      <span className="flex-none text-sm">{label}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-sm text-muted">{value}</span>
        <span className="flex-none text-base text-muted">&#8250;</span>
      </span>
    </Link>
  );
}

function Err({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-2xs leading-relaxed text-penalty">{error}</p>;
}

function Busy({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <p className="text-2xs text-muted">Saving</p>;
}

function LeaveGroup({ groupId }: { groupId: string }) {
  const [leaving, setLeaving] = useState(false);

  // Leaving used to happen on one press, with its consequence sitting on the
  // page as permanent text. It asks now, and the consequence is in the
  // question, which is where a consequence belongs.
  if (!leaving) {
    return (
      <button
        type="button"
        onClick={() => setLeaving(true)}
        className="h-11 w-full border border-rule text-base text-penalty active:opacity-70"
      >
        Leave group
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-[11px] border border-penalty p-[13px]">
      <span className="text-xs leading-relaxed">
        Leave this group? What you owe and what you are owed stay. Your streaks,
        standing and photos stop being visible here at once.
      </span>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setLeaving(false)}
          className="h-11 flex-1 border border-rule text-base active:opacity-70"
        >
          Stay
        </button>
        <form action={leaveGroupAction.bind(null, groupId)} className="flex-1">
          {/* A bare <form action> never sets this component's own transition
              flag, so useFormStatus is the only thing that knows this press
              happened. */}
          <SubmitButton
            className="h-11 w-full border border-penalty bg-penalty text-base font-semibold text-bg"
            pendingLabel="Leaving"
          >
            Leave
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function FineRow({
  row,
  onSave,
}: {
  row: AcceptedRow;
  onSave: (amount: number) => void;
}) {
  const exponent = minorUnitExponent(row.currency);
  const [value, setValue] = useState(
    row.fineAmount > 0 ? String(row.fineAmount / 10 ** exponent) : "",
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule py-[11px]">
      <span className="text-sm">{row.name}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          placeholder="no fine"
          aria-label={`${row.name} fine`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const n = Number(value);
            if (value !== "" && Number.isFinite(n)) onSave(n);
          }}
          className="w-24 border border-rule bg-transparent px-2 py-1.5 text-right text-xs tabular-nums text-fg outline-none placeholder:text-muted"
        />
        <span className="text-2xs text-muted">
          {row.fineAmount > 0 ? formatMoney(row.fineAmount, row.currency) : row.currency}
        </span>
      </div>
    </div>
  );
}
