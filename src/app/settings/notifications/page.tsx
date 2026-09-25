import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { quietFor, reminderSettings } from "@/server/reminders";
import { deviceCount, publicKey, pushConfigured } from "@/server/push";
import { BackLink } from "@/app/back-link";
import { InfoHint } from "@/app/ui";
import { NotificationsForm } from "./notifications-form";

// Notifications: the one screen that turns Curfew from a thing you open into a
// thing that reaches you.
//
// The VAPID public key is handed down as a PROP rather than exposed as a
// NEXT_PUBLIC_ variable. It is public either way, so this buys no secrecy. What
// it buys is one convention instead of two: every other key in this app is read
// once, on the server, through src/lib/env.ts, and a single NEXT_PUBLIC_ would
// have been the start of a second way to do it.

export default async function Notifications() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if ((await getApprovalStatus(user.id)) !== "approved") redirect("/pending");

  const configured = pushConfigured();
  const [activities, devices, quiet] = await Promise.all([
    reminderSettings(user.id),
    deviceCount(user.id),
    quietFor(user.id),
  ]);

  return (
    <main className="min-h-dvh px-5 pb-nav pt-5">
      <div className="mx-auto max-w-[560px]">
        <header className="-mx-5 border-b border-rule px-5 pb-[11px]">
          <BackLink fallback="/settings" label="settings" />
          <h1 className="mt-3 text-base font-semibold tracking-label">
            NOTIFICATIONS
          </h1>
        </header>

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Curfew can remind you before a window closes, and say what the rest of
          your group has already logged.
          <InfoHint label="How reminders work">
            Reminders are per device, so turning them on here turns them on for
            the phone you are holding and not for your other ones. One arrives
            at a time and each is about one activity: what is left, and by when.
            <br />
            <br />
            Curfew will not say the same thing twice. A reminder only repeats
            once something has changed, so an activity you have made progress on
            reads differently the next time it comes up.
            <br />
            <br />
            Nothing is sent about an activity you have already done, one that is
            not scheduled today, any day inside a declared pause, or at any time
            inside your quiet hours.
            <br />
            <br />
            A group line only ever names what that group can already see. An
            activity you have not shared with a group is invisible to it here
            too.
          </InfoHint>
        </p>

        {configured ? (
          <NotificationsForm
            vapidPublicKey={publicKey()}
            devices={devices}
            activities={activities}
            quiet={quiet}
          />
        ) : (
          <p className="mt-6 border border-rule p-4 text-xs leading-relaxed text-muted">
            Push is not configured in this environment. VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY and VAPID_SUBJECT are unset, so there is nothing
            to subscribe to.
          </p>
        )}
      </div>
    </main>
  );
}
