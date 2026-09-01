import { redirect } from "next/navigation";

// The check-in now lives on Home as a one-tap press (v2.5). This route is kept
// only so any stale link lands somewhere sensible.
export default function Checkin() {
  redirect("/");
}
