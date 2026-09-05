import { Bar, LabelBar, RowsSkeleton, PageSkeleton } from "@/app/_skeleton";

// Covers the list, the catalog and one activity's own screen: all three open
// with a heading and a run of rows.
export default function Loading() {
  return (
    <PageSkeleton title="ACTIVITIES">
      <div className="flex flex-col gap-[9px]">
        <LabelBar />
        <Bar w="w-[70px]" h={30} />
      </div>
      <RowsSkeleton n={6} />
    </PageSkeleton>
  );
}
