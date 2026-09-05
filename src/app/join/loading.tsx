import { Bar, LabelBar, PageSkeleton, RowsSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="JOIN" back>
      <Bar w="w-[160px]" h={20} />
      <LabelBar />
      <RowsSkeleton n={4} />
    </PageSkeleton>
  );
}
