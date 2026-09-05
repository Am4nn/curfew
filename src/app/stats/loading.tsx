import { Bar, LabelBar, PageSkeleton, RowsSkeleton, TilesSkeleton } from "@/app/_skeleton";

// Stats: the month's figure, three tiles, the heatmap, then a row per activity.
export default function Loading() {
  return (
    <PageSkeleton title="STATS">
      <div className="flex flex-col gap-[9px]">
        <LabelBar />
        <Bar w="w-[128px]" h={34} />
      </div>
      <TilesSkeleton n={3} />
      <div className="flex flex-col gap-[11px]">
        <LabelBar />
        <div className="flex gap-[3px]">
          {Array.from({ length: 8 }, (_, w) => (
            <div key={w} className="flex flex-1 flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, d) => (
                <div key={d} className="aspect-square w-full bg-rule" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <RowsSkeleton n={4} />
    </PageSkeleton>
  );
}
