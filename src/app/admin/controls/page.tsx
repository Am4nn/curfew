import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { can } from "@/server/admin";
import { getControlsState } from "@/server/controls";
import { ControlsForm } from "./controls-form";

export default async function ControlsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await can(user.id, "settings.view"))) redirect("/admin");

  const state = await getControlsState();
  const writable = await can(user.id, "settings.write");

  return <ControlsForm state={state} writable={writable} />;
}
