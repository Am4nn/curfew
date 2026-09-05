import { PageSkeleton, RowsSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="REPUTATION" back>
      <RowsSkeleton n={6} />
    </PageSkeleton>
  );
}
