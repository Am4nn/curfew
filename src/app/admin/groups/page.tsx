import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can, listAllGroups } from "@/server/admin";
import { moneyOverrides } from "@/server/group-controls";
import { GroupRow } from "./group-row";

export default async function AdminGroups() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await can(user.id, "groups.view"))) redirect("/admin");

  const [groups, overrides, canWrite, canArchive] = await Promise.all([
    listAllGroups(),
    moneyOverrides(),
    can(user.id, "settings.write"),
    can(user.id, "groups.archive"),
  ]);

  return (
    <section className="flex flex-col gap-[10px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">GROUPS</span>

      {groups.length === 0 ? (
        <p className="text-[14px] text-muted">No groups.</p>
      ) : (
        <div className="flex flex-col">
          {groups.map((group) => (
            <GroupRow
              key={group.groupId}
              group={group}
              override={overrides.get(group.groupId) ?? null}
              canWrite={canWrite}
              canArchive={canArchive}
            />
          ))}
        </div>
      )}

      <span className="text-[11.5px] leading-[1.55] text-muted">
        Money set here beats the app-wide switch for one group, and the group owner still
        decides within what it allows. Archiving takes a group out of circulation and
        deletes nothing: money already owed is still owed.
      </span>
    </section>
  );
}
