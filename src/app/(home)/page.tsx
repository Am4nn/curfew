import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { listUserGroups, listInvitesForEmail, userBalances } from "@/server/groups";
import { hasAdminAccess, pendingApprovalCount } from "@/server/admin";
import { todayFor, todayDate } from "@/server/today";
import { standingIn } from "@/server/group-view";
import { formatMoney, getActivityType, registeredKeys } from "@/domain";
import { QuorumMark } from "@/app/mark";
import { ActivityIcon } from "@/app/activity-icon";
import { RankScore } from "@/app/rank-icon";
import { TodayBoard } from "@/app/today-board";
import { InviteRows } from "@/app/invite-rows";
import { buttonClass } from "@/app/button-style";

// Home is the day: how much of it is done, every activity with where it stands
// and the one thing to do about it, then money and groups.
//
// Every status line is written by the activity's own module, so nothing here
// knows what a meal or a window is (invariant 6).
export default async function Home({
  searchParams,
}: {
  // `?done=<typeKey>` is set by the check-in screen on its way back here, and
  // says which row to mark. It records nothing and never could: a check-in is
  // a POST (invariant 9), and this is read only to decide what to draw.
  searchParams: Promise<{ done?: string }>;
}) {
  const { done: doneParam } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const [today, groups, invites, admin, date] = await Promise.all([
    todayFor(user.id),
    listUserGroups(user.id),
    listInvitesForEmail(user.email),
    hasAdminAccess(user.id),
    todayDate(user.id),
  ]);

  const pendingAdminWork = admin ? await pendingApprovalCount() : 0;

  const [balances, standings] = await Promise.all([
    userBalances(user.id),
    Promise.all(
      groups.map(async (g) => {
        const standing = await standingIn(g.groupId, user.id);
        return {
          ...g,
          score: standing.score,
          cleanDays: standing.cleanDays,
          grace: standing.grace,
        };
      }),
    ),
  ]);

  // A user whose groups all have money off never sees money at all
  // (decision 43).
  const owe = balances.reduce((s, b) => s + Math.max(b.netOwed, 0), 0);
  const owed = balances.reduce((s, b) => s + Math.max(-b.netOwed, 0), 0);
  const currency = balances.find((b) => b.currency)?.currency ?? "INR";
  const showMoney = balances.length > 0;

  // The activities that were due today, for the stamp's one line of icons. Not
  // "every activity": a rest day is not a miss, and an activity that was never
  // scheduled was never part of the day.
  const dueIcons = today.rows.filter((r) => r.scheduled).map((r) => r.icon);
  // The stamp's own line. Formatted here because the day is the server's, in
  // the user's own zone (invariant 8): a client clock could stamp yesterday.
  const dateLabel = new Date(`${date}T12:00:00Z`)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    .toUpperCase();

  // A row was marked from the URL only if it is a row that exists.
  const recorded =
    doneParam && today.rows.some((r) => r.typeKey === doneParam) ? doneParam : null;

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
          <TodayBoard
            rows={today.rows}
            done={today.done}
            of={today.of}
            initialRecorded={recorded}
            dateLabel={dateLabel}
            dueIcons={dueIcons}
          />
        )}

        {/* A group that has not started counting you yet, said once, where the
            day is. Otherwise a member checks in all day for a group that is
            not looking, or worse, does not and expects to be fined. */}
        {standings
          .filter((g) => g.grace)
          .map((g) => (
            <div key={g.groupId} className="flex flex-col gap-[5px] border border-accent p-[13px]">
              <div className="flex items-baseline justify-between gap-[10px]">
                <span className="text-[12.5px] text-accent">
                  {g.name} starts counting you at midnight.
                </span>
                <span className="flex-none text-[11px] text-accent">
                  {g.grace!.hoursLeft}h
                </span>
              </div>
              <span className="text-[11.5px] leading-[1.55] text-muted">
                Nothing there can cost you money or reputation yet. Your streaks
                count today as normal.
              </span>
            </div>
          ))}

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
                  {g.grace ? (
                    <span className="flex-none border border-accent px-[7px] py-[3px] text-[10px] tracking-[0.12em] text-accent">
                      GRACE
                    </span>
                  ) : (
                    <RankScore score={g.score} cleanDays={g.cleanDays} size={15} />
                  )}
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
