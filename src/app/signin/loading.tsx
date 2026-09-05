import { Bar, PageSkeleton } from "@/app/_skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="CURFEW">
      <Bar w="w-[210px]" h={18} />
      <Bar h={46} />
    </PageSkeleton>
  );
}
