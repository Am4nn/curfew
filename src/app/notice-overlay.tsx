import { getSessionUser } from "@/lib/session";
import { pendingNotices } from "@/server/notices";
import { acknowledgeNoticesAction } from "./notice-actions";
import { SubmitButton } from "@/app/ui";

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

  // The most recent, which is pending[0] now that the list is newest first. It
  // was `at(-1)` and meant the same thing under the old ascending order, so
  // reversing the query silently turned this into the date of the OLDEST thing
  // in the overlay.
  const published = pending[0].createdAt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What changed"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--scrim)" }}
    >
      <div className="flex w-full max-w-[420px] flex-col border border-rule bg-bg">
        <div className="border-b border-rule px-[18px] py-4">
          <span className="text-micro tracking-label text-muted">WHAT CHANGED</span>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-[18px] py-4">
          {pending.map((notice) =>
            // Each change composed by noticeFrom() is one "\n\n"-separated
            // paragraph starting "Name is now state." -- split that headline
            // sentence out so it reads like the confirm sheet it came from,
            // not one flat block.
            notice.body.split("\n\n").map((paragraph, i) => {
              const sentenceEnd = paragraph.indexOf(". ");
              const headline = sentenceEnd === -1 ? paragraph : paragraph.slice(0, sentenceEnd + 1);
              const rest = sentenceEnd === -1 ? "" : paragraph.slice(sentenceEnd + 2);
              return (
                <div key={`${notice.id}-${i}`} className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{headline}</span>
                  {rest ? (
                    <span className="text-xs leading-relaxed text-muted">{rest}</span>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {/* Outside the scroller. This is who sent it and when, which is chrome
            rather than content: inside, a notice long enough to scroll pushed
            it below the fold and the overlay lost its signature exactly when it
            was carrying the most to read. */}
        <div className="px-[18px] pb-3 pt-1 text-micro text-muted">
          {published.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          {" \u00b7 from Curfew"}
        </div>

        <div className="px-[18px] pb-[18px]">
          <form action={acknowledgeNoticesAction}>
            <SubmitButton
              className="h-11 w-full border border-fg bg-fg text-sm font-semibold text-bg"
              pendingLabel="Saving"
            >
              Got it
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
