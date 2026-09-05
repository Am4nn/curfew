import { LabelBar, PageSkeleton, RowsSkeleton, TilesSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="STATS" back>
      <TilesSkeleton n={3} />
      <LabelBar />
      <RowsSkeleton n={4} icon={false} />
    </PageSkeleton>
  );
}
