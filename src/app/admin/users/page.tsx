import { listAllUsers } from "@/server/admin";
import { UsersDirectory } from "./users-directory";

export default async function AdminUsers() {
  const users = await listAllUsers();

  return (
    <section className="flex flex-col gap-[14px]">
      <span className="text-[10px] tracking-[0.16em] text-muted">USERS</span>
      <UsersDirectory users={users} />
    </section>
  );
}
