import { InnerSkeleton, LabelBar, RowsSkeleton, TilesSkeleton } from "@/app/_skeleton";

// Inside the admin layout, which holds the header and the nav across every tab.
export default function Loading() {
  return (
    <InnerSkeleton className="flex flex-col gap-5">
      <TilesSkeleton n={4} />
      <LabelBar />
      <RowsSkeleton n={6} icon={false} />
    </InnerSkeleton>
  );
}
