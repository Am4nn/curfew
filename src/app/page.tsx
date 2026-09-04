import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups, listInvitesForEmail, userBalances } from "@/server/groups";
import { hasAdminAccess, pendingApprovalCount } from "@/server/admin";
import { todayFor } from "@/server/today";
import { standingIn } from "@/server/group-view";
import { formatMoney, getActivityType, registeredKeys } from "@/domain";
import { QuorumMark } from "./mark";
import { ActivityIcon, Flame } from "./activity-icon";
import { RankScore } from "./rank-icon";
import { CheckinButton } from "./checkin-button";
import { InviteRows } from "./invite-rows";
import { buttonClass } from "./ui";

// Home is the day: how much of it is done, every activity with where it stands
// and the one thing to do about it, then money and groups.
//
// Every status line is written by the activity's own module, so nothing here
// knows what a meal or a window is (invariant 6).
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [today, groups, invites, admin] = await Promise.all([
    todayFor(user.id),
    listUserGroups(user.id),
    listInvitesForEmail(user.email),
    hasAdminAccess(user.id),
  ]);

  const pendingAdminWork = admin ? await pendingApprovalCount() : 0;

  const [balances, standings] = await Promise.all([
    userBalances(user.id),
    Promise.all(
      groups.map(async (g) => ({
        ...g,
        score: (await standingIn(g.groupId, user.id)).score,
      })),
    ),
  ]);

  // A user whose groups all have money off never sees money at all
  // (decision 43).
  const owe = balances.reduce((s, b) => s + Math.max(b.netOwed, 0), 0);
  const owed = balances.reduce((s, b) => s + Math.max(-b.netOwed, 0), 0);
  const currency = balances.find((b) => b.currency)?.currency ?? "INR";
  const showMoney = balances.length > 0;

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center justify-between gap-3 border-b border-rule px-5 pb-[11px]">
          <h1 className="flex items-center gap-[9px] text-[14px] font-semibold tracking-[0.16em]">
            <QuorumMark size={15} />
            CURFEW
          </h1>
          {admin ? (
            <Link href="/admin" className="flex items-center gap-[5px] text-[11px] text-muted">
              Admin
              {pendingAdminWork > 0 ? (
                <span
                  className="h-[5px] w-[5px] self-start bg-penalty"
                  style={{ borderRadius: "50%" }}
                />
              ) : null}
              <span>&rsaquo;</span>
            </Link>
          ) : null}
        </header>

        {invites.length > 0 ? <InviteRows invites={invites} /> : null}

        {today.rows.length === 0 ? (
          <NewUser inAGroup={groups.length > 0} />
        ) : (
          <>
            <section className="flex flex-col gap-[6px]">
              <span className="text-[10px] tracking-[0.16em] text-muted">TODAY</span>
              <div className="flex items-baseline gap-[10px]">
                <span className="text-[38px] font-semibold leading-none tabular-nums">
                  {today.done}
                </span>
                <span className="text-[15px] text-muted">of {today.of} done</span>
              </div>
              <div className="mt-[6px] flex gap-1">
                {Array.from({ length: today.of }, (_, i) => (
                  <div
                    key={i}
                    className={"h-[3px] flex-1 " + (i < today.done ? "bg-fg" : "bg-rule")}
                  />
                ))}
              </div>
            </section>

            <section className="flex flex-col">
              {today.rows.map((row) => (
                <div
                  key={row.typeKey}
                  className={
                    "flex items-center gap-3 border-b border-rule py-[13px] " +
                    (row.scheduled ? "" : "opacity-[0.42]")
                  }
                >
                  <Link
                    href={`/activities/${row.typeKey}`}
                    className={"flex flex-none " + (row.scheduled ? "text-fg" : "text-muted")}
                  >
                    <ActivityIcon name={row.icon} size={20} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div className="flex items-center gap-[9px]">
                      <span className="text-[14px]">{row.name}</span>
                      {row.scheduled && row.streak > 0 ? (
                        <span className="flex items-center gap-1">
                          <Flame size={13} />
                          <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff7a2f] to-[#e4574b] bg-clip-text text-[12px] font-medium leading-none text-transparent tabular-nums">
                            {row.streak}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <span className="truncate text-[11.5px] text-muted">{row.status}</span>
                  </div>

                  {row.done ? (
                    <span className="flex flex-none items-center gap-[6px] text-[12px] text-pass">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
                        <path d="M4 12.5 9 17.5 20 6.5" />
                      </svg>
                      done
                    </span>
                  ) : row.open && row.step ? (
                    row.kind === "counter" ? (
                      <CheckinButton
                        label="+1"
                        typeKey={row.typeKey}
                        step={row.step}
                        className="flex h-[34px] flex-none items-center border border-fg bg-fg px-[13px] text-[12px] font-semibold text-bg disabled:opacity-60"
                      />
                    ) : (
                      <Link
                        href={`/checkin/${row.typeKey}`}
                        className="flex h-[34px] flex-none items-center gap-[6px] border border-fg bg-fg px-[13px] text-[12px] font-semibold text-bg"
                      >
                        {row.kind === "camera" ? "Log" : "Check in"}
                      </Link>
                    )
                  ) : null}
                </div>
              ))}
            </section>
          </>
        )}

        {showMoney ? (
          <section className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">BALANCES</span>
            <div className="flex gap-[10px]">
              <Link href="/balances" className="flex flex-1 flex-col gap-1 border border-rule p-3">
                <span className="text-[10px] text-muted">YOU OWE</span>
                <span
                  className={"text-[19px] tabular-nums " + (owe === 0 ? "text-muted" : "text-penalty")}
                >
                  {formatMoney(owe, currency)}
                </span>
              </Link>
              <Link href="/balances" className="flex flex-1 flex-col gap-1 border border-rule p-3">
                <span className="text-[10px] text-muted">OWED TO YOU</span>
                <span
                  className={"text-[19px] tabular-nums " + (owed === 0 ? "text-muted" : "text-pass")}
                >
                  {formatMoney(owed, currency)}
                </span>
              </Link>
            </div>
          </section>
        ) : null}

        {standings.length > 0 ? (
          <section className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">GROUPS</span>
            <div className="flex flex-col">
              {standings.map((g) => (
                <Link
                  key={g.groupId}
                  href={`/group/${g.groupId}`}
                  className="flex items-center gap-3 border-b border-rule py-[13px]"
                >
                  <span className="flex-1 text-[14px]">{g.name}</span>
                  <RankScore score={g.score} size={15} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

// Nothing tracked yet. The mock is V3HomeStart, and V3HomeStartInvite for the
// same screen with an invite waiting.
//
// This led with a paragraph and a button reading "Add an activity", which
// answers neither question a new arrival actually has: what does this track,
// and what happens if I miss. Four real activities naming what they measure,
// each going straight to its own setup, answer both without prose.
//
// The four are chosen here rather than by the modules, because "which four to
// show a stranger first" is a decision about this screen, not a property of a
// type. Nothing here reads a type's config or its detail (invariant 6): the
// name and the line under it are the module's own words.
const FIRST_FOUR = ["sleep", "water", "gym", "steps"];

function NewUser({ inAGroup }: { inAGroup: boolean }) {
  const available = new Set(registeredKeys());
  const starters = FIRST_FOUR.filter((key) => available.has(key)).map((key) => {
    const type = getActivityType(key);
    return { key, name: type.name, description: type.description, icon: type.icon };
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-[3px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">TODAY</span>
        <span className="text-[22px] font-semibold leading-tight">
          You are tracking nothing.
        </span>
      </div>

      <div className="flex flex-col gap-[11px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">
          PICK ONE TO START
        </span>
        <div className="flex flex-col">
          {starters.map((s) => (
            <Link
              key={s.key}
              href={`/activities/${s.key}`}
              className="flex items-center gap-3 border-b border-rule py-[14px]"
            >
              <span className="flex flex-none">
                <ActivityIcon name={s.icon} size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[14px]">{s.name}</span>
                <span className="text-[11.5px] leading-[1.45] text-muted">
                  {s.description}
                </span>
              </div>
              <span className="flex-none text-[13px] text-muted">&rsaquo;</span>
            </Link>
          ))}
          {/* The catalog, not /activities: a person tracking nothing has an
              empty list of their own, and the thing to show them is the menu. */}
          <Link
            href="/activities/add"
            className="flex items-center gap-3 border-b border-rule py-[14px]"
          >
            <span className="flex-1 text-[13.5px] text-muted">
              See every activity
            </span>
            <span className="flex-none text-[13px] text-muted">&rsaquo;</span>
          </Link>
        </div>
      </div>

      {/* Making a group is the other half of the app, and a new arrival had no
          way to reach it from here at all.

          Both of these go once someone is already in a group: the sentence is
          an explanation of what groups are, and it stops being news the moment
          you are in one. The whole block goes once anything is tracked, since
          this branch only renders on an empty day. */}
      {inAGroup ? null : (
        <>
          <Link
            href="/groups"
            className={buttonClass("secondary", "lg", "w-full")}
          >
            Create a group
          </Link>
          <p className="text-[11.5px] leading-[1.55] text-muted">
            Groups are invite-only, and they only ever see the activities you
            choose to share. Make one and invite the people who will notice when
            you stop.
          </p>
        </>
      )}
    </section>
  );
}
