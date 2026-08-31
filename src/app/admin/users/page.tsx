import Link from "next/link";
import { listAllUsers } from "@/server/admin";

export default async function AdminUsers() {
  const users = await listAllUsers();

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.1em]">USERS</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-fg text-left text-[11px] uppercase tracking-[0.08em] text-muted">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Groups</th>
              <th className="py-2 pr-3">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-rule align-top">
                <td className="py-2 pr-3">
                  <Link href={`/admin/users/${u.userId}`}>{u.name} ›</Link>
                  <div className="text-[11px] text-muted">{u.email}</div>
                </td>
                <td className="py-2 pr-3">
                  <span className={u.status === "approved" ? "text-pass" : u.status === "rejected" ? "text-penalty" : "text-muted"}>
                    {u.status}
                  </span>
                  {u.role !== "member" ? <span className="ml-1 text-[11px] text-muted">· {u.role}</span> : null}
                  {u.disabled ? <span className="ml-1 text-[11px] text-penalty">· removed</span> : null}
                </td>
                <td className="py-2 pr-3 tabular-nums">{u.groupCount}</td>
                <td className="py-2 pr-3 text-[11px] tabular-nums text-muted">
                  {u.lastEventAt ? new Date(u.lastEventAt).toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
