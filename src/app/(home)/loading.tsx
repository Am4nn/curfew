import { Bar, LabelBar, RowsSkeleton, PageSkeleton } from "@/app/_skeleton";

// Home, before it lands: the day's count, the bar under it, and the rows.
//
// Home sits in a (home) route group for one reason: this. A loading.tsx at the
// app root is an ancestor boundary for every route, so a Home-shaped skeleton
// there flashed on the way to Stats and Settings too, header and all. In the
// group it belongs to Home alone, and every other segment shows its own.
export default function Loading() {
  return (
    <PageSkeleton title="CURFEW">
      <div className="flex flex-col gap-[9px]">
        <LabelBar />
        <Bar w="w-[92px]" h={34} />
        <div className="mt-[6px] flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[3px] flex-1 bg-rule" />
          ))}
        </div>
      </div>
      <RowsSkeleton n={5} />
    </PageSkeleton>
  );
}
