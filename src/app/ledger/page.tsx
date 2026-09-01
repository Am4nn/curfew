import { redirect } from "next/navigation";

// The ledger is per-group now, on the group hub Ledger tab (v2.5). Kept as a
// redirect so any stale link lands on the groups list.
export default function Ledger() {
  redirect("/groups");
}
