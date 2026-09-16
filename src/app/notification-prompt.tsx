import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { hasConsented } from "@/server/consent";
import { pendingNotices } from "@/server/notices";
import { publicKey, pushConfigured } from "@/server/push";
import { NotificationPromptCard } from "./notification-prompt-card";

// Asking for notifications where somebody already is, rather than hoping they
// go looking in Settings.
//
// THE QUEUE. Three things can want the screen on a launch, and without an order
// a new member's first launch is a stack of modals:
//
//   1. The consent gate. Blocking, no dismiss, z-60.
//   2. The notice overlay. Blocking, one press clears it, z-50.
//   3. This. Dismissible, z-40.
//
// So a new account sees consent, then this, and nothing else: notices published
// before an account existed are never shown to it (decision 80), so there is
// no third step for somebody who joined today. An existing member sees what
// changed first, then this.
//
// The gates below are what enforce that order. Returning null while either of
// the others is up is cheaper and more honest than stacking and relying on
// z-index, because a card behind a modal is still a card somebody can tab into.
export async function NotificationPrompt() {
  if (!pushConfigured()) return null;

  const user = await getSessionUser();
  if (!user) return null;
  if ((await getApprovalStatus(user.id)) !== "approved") return null;

  // The consent gate is up. It blocks everything and has no dismiss, so there
  // is nothing to be gained by rendering underneath it.
  if (!(await hasConsented(user.id))) return null;

  // The notice overlay is up. What changed comes before what to turn on.
  if ((await pendingNotices(user.id)).length > 0) return null;

  // Whether THIS DEVICE needs asking is a browser fact, and the server cannot
  // know it: an account with notifications on their phone still needs asking on
  // their laptop. The card decides and renders nothing when it should not.
  return <NotificationPromptCard vapidPublicKey={publicKey()} />;
}
