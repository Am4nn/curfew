import { getSessionUser } from "@/lib/session";
import { pendingNotices } from "@/server/notices";
import { acknowledgeNoticesAction } from "./notice-actions";

// The blocking overlay (decision 58). It sits over every route and the app does
// nothing until it is acknowledged. There is no cross and no dismiss, only
// "Got it": acknowledging is final.
//
// Everything the viewer has not seen is in ONE overlay (decision 81), so there
// is never a queue to work through. One press clears all of it.
export async function NoticeOverlay() {
  const user = await getSessionUser();
  if (!user) return null;

  const pending = await pendingNotices(user.id);
  if (pending.length === 0) return null;

  const published = pending.at(-1)!.createdAt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What changed"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-6"
    >
      <div className="flex w-full max-w-[420px] flex-col border border-rule bg-bg">
        <div className="border-b border-rule px-[18px] py-4">
          <span className="text-[10px] tracking-[0.16em] text-muted">WHAT CHANGED</span>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-[18px] py-4">
          {pending.map((notice) => (
            <p key={notice.id} className="text-[12px] leading-[1.6] text-muted">
              {notice.body}
            </p>
          ))}
          <span className="text-[10.5px] text-muted">
            {published.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {" \u00b7 from Curfew"}
          </span>
        </div>

        <div className="px-[18px] pb-[18px]">
          <form action={acknowledgeNoticesAction}>
            <button
              type="submit"
              className="h-11 w-full border border-fg bg-fg text-[13.5px] font-semibold text-bg"
            >
              Got it
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
