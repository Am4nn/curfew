import { LabelBar, PageSkeleton, RowsSkeleton } from "@/app/_skeleton";

// Covers Settings and everything under it: sharing, photos, data, personal,
// stored and rules are all a heading over a list.
export default function Loading() {
  return (
    <PageSkeleton title="SETTINGS">
      <LabelBar />
      <RowsSkeleton n={4} icon={false} />
      <LabelBar />
      <RowsSkeleton n={4} icon={false} />
    </PageSkeleton>
  );
}
