import { QuorumMark } from "./mark";

// The route-load fallback. The bottom nav lives in the root layout, so it stays
// put while this renders: header at the top, a centred pulsing mark in the
// middle, matching the Loading mock.
export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-24 pt-5">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
        <header className="-mx-5 flex items-center gap-2 border-b border-rule px-5 pb-[14px]">
          <QuorumMark size={15} />
          <span className="text-[15px] font-semibold tracking-[0.14em]">CURFEW</span>
        </header>
        <div className="flex flex-1 animate-pulse flex-col items-center justify-center gap-[14px]">
          <QuorumMark size={26} />
          <span className="text-[13px] tracking-[0.14em] text-muted">LOADING</span>
        </div>
      </div>
    </main>
  );
}
