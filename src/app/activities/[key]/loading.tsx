import { Bar, LabelBar, PageSkeleton, TilesSkeleton } from "@/app/_skeleton";

// Configure: the type at the top, its figures, then its own controls.
export default function Loading() {
  return (
    <PageSkeleton title="ACTIVITY" back>
      <div className="flex items-center gap-3">
        <Bar w="w-[22px]" h={22} />
        <Bar w="w-[120px]" h={17} />
      </div>
      <TilesSkeleton n={3} />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-[9px]">
          <LabelBar />
          <Bar h={44} />
        </div>
      ))}
    </PageSkeleton>
  );
}
