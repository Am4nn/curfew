import { LabelBar, PageSkeleton, RowsSkeleton, TilesSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="BALANCES" back>
      <TilesSkeleton n={2} />
      <LabelBar />
      <RowsSkeleton n={4} icon={false} />
    </PageSkeleton>
  );
}
