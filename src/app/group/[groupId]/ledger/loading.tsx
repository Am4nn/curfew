import { PageSkeleton, RowsSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="LEDGER" back>
      <RowsSkeleton n={8} icon={false} />
    </PageSkeleton>
  );
}
