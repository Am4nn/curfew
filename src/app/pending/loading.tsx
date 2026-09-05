import { Bar, PageSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="CURFEW">
      <Bar w="w-[180px]" h={18} />
      <Bar w="w-[80%]" h={12} />
    </PageSkeleton>
  );
}
