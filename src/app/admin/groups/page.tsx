import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can, listAllGroups } from "@/server/admin";
import { moneyOverrides } from "@/server/group-controls";
import { getAppConfig } from "@/server/app-config";
import { GroupsDirectory } from "./groups-directory";

export default async function AdminGroups() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await can(user.id, "groups.view"))) redirect("/admin");

  const [groups, overrides, appConfig, canWrite, canArchive] = await Promise.all([
    listAllGroups(),
    moneyOverrides(),
    getAppConfig(),
    can(user.id, "settings.write"),
    can(user.id, "groups.archive"),
  ]);

  const appWideMoneyOn = appConfig.settings.money === true;

  // The override → label mapping the row control shows, worked out here so
  // the client component gets plain data rather than a Map (which does not
  // survive the server/client boundary) and doesn't need to know the
  // app-wide/override precedence rule itself.
  const rows = groups.map((group) => {
    const override = overrides.get(group.groupId) ?? null;
    const moneyOn = override ?? appWideMoneyOn;
    const moneyLabel = !moneyOn
      ? null
      : override === true && !appWideMoneyOn
        ? "Money, on by exception"
        : "Money";
    return { group, override, moneyOn, moneyLabel };
  });

  return (
    <section className="flex flex-col gap-[10px]">
      <GroupsDirectory
        rows={rows}
        appWideMoneyOn={appWideMoneyOn}
        canWrite={canWrite}
        canArchive={canArchive}
      />

      <span className="text-[11.5px] leading-[1.55] text-muted">
        Archiving freezes a group: no check-ins count toward it, no fines, nobody can
        join. Nothing is deleted and it can be brought back.
      </span>
    </section>
  );
}
