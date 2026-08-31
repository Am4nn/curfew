import { QuorumMark } from "./mark";

// Shared centred column for the loading, error and not-found states. Uses a
// single min-h-dvh flex container that centres its content, so nothing stacks
// past the viewport and no stray scrollbar appears.
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-7">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[26px]">
        <div className="flex items-center gap-3 text-[30px] font-semibold tracking-[0.2em]">
          <QuorumMark size={26} />
          CURFEW
        </div>
        {children}
      </div>
    </main>
  );
}
