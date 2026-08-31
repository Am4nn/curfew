import Link from "next/link";
import { listAllGroups } from "@/server/admin";
import { formatMoney } from "@/domain";

export default async function AdminGroups() {
  const groups = await listAllGroups();

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.1em]">GROUPS</h2>
      {groups.length === 0 ? (
        <p className="text-[14px] text-muted">No groups.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-fg text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Members</th>
                <th className="py-2 pr-3">Total fined</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.groupId} className="border-b border-rule">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/groups/${g.groupId}`}>{g.name} ›</Link>
                    {g.archived ? <span className="ml-1 text-[11px] text-muted">· archived</span> : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{g.memberCount}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatMoney(g.totalFined, "INR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
