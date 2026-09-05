import { PageSkeleton, RowsSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="GROUPS">
      <RowsSkeleton n={3} icon={false} />
    </PageSkeleton>
  );
}
