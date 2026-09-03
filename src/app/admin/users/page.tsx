import { listAllUsers } from "@/server/admin";
import { UsersDirectory } from "./users-directory";

export default async function AdminUsers() {
  const users = await listAllUsers();

  return (
    <section className="flex flex-col gap-[14px]">
      <UsersDirectory users={users} />
    </section>
  );
}
