import { QuorumMark } from "./mark";

// The shapes every route's loading state is built from.
//
// A spinner in the middle of an empty screen tells a person nothing except
// that something is happening, and the one this replaced also threw away the
// header of the page being navigated to, so the whole app blinked on every
// tap. These draw the chrome that is already known (the title, the tabs, the
// row rhythm) and leave only the unknown part grey, so a screen arrives in
// place instead of appearing.
//
// Nothing here is animated beyond one shared pulse, and it respects
// prefers-reduced-motion through Tailwind's own animate-pulse.

/** One grey block. `w` is a Tailwind width class, `h` a pixel height. */
export function Bar({ w = "w-full", h = 13 }: { w?: string; h?: number }) {
  return <div className={`bg-rule ${w}`} style={{ height: h }} />;
}

/** The label above a block, at the size the real one is set in. */
export function LabelBar() {
  return <Bar w="w-[110px]" h={8} />;
}

/** A list of rows the shape Home, Activities and the group lists all use. */
export function RowsSkeleton({ n = 5, icon = true }: { n?: number; icon?: boolean }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-rule py-[15px]">
          {icon ? <Bar w="w-[20px]" h={20} /> : null}
          <div className="flex flex-1 flex-col gap-[7px]">
            <Bar w={i % 3 === 0 ? "w-[45%]" : i % 3 === 1 ? "w-[60%]" : "w-[52%]"} h={12} />
            <Bar w={i % 2 === 0 ? "w-[72%]" : "w-[58%]"} h={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A row of the bordered figures Home, Stats and Standing all use. */
export function TilesSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="flex gap-[10px]">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex flex-1 flex-col gap-[9px] border border-rule p-3">
          <Bar w="w-[55%]" h={16} />
          <Bar w="w-[80%]" h={8} />
        </div>
      ))}
    </div>
  );
}

/**
 * A whole screen, with the header it is going to have.
 *
 * `title` is the destination's own, so the words at the top do not change when
 * the content lands. `back` draws the chevron for a screen that has one.
 */
export function PageSkeleton({
  title,
  back = false,
  children,
}: {
  title: string;
  back?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh px-5 pb-24 pt-5" aria-busy="true">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          {back ? (
            <span className="text-[14px] text-muted">&lsaquo;</span>
          ) : (
            <QuorumMark size={15} />
          )}
          <span className="text-[14px] font-semibold tracking-[0.16em]">{title}</span>
        </header>
        <div className="flex animate-pulse flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}

/**
 * The body only, for a segment whose layout already draws the header.
 *
 * The admin console and the group hub both render their chrome in a layout, so
 * a loading state inside them must not draw a second one.
 */
export function InnerSkeleton({
  children,
  className = "flex flex-col gap-5 px-5 py-[18px]",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`animate-pulse ${className}`} aria-busy="true">
      {children}
    </div>
  );
}

/** The default body: a label, a few rows. Used where nothing more is known. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <LabelBar />
      <RowsSkeleton n={rows} />
    </>
  );
}
