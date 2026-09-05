import { InnerSkeleton, LabelBar, RowsSkeleton } from "@/app/_skeleton";

// Inside the hub, whose layout already holds the group name and the tabs. Only
// the panel under them is unknown, so only the panel is grey.
export default function Loading() {
  return (
    <InnerSkeleton>
      <LabelBar />
      <RowsSkeleton n={4} icon={false} />
    </InnerSkeleton>
  );
}
