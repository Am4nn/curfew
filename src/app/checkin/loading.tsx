import { Bar, LabelBar, PageSkeleton } from "@/app/_skeleton";

// The check-in screen. A photo-only step goes straight to the camera and never
// renders this, so what is drawn here is the slot-and-fields shape.
export default function Loading() {
  return (
    <PageSkeleton title="CHECK IN" back>
      <div className="flex flex-col gap-[9px]">
        <LabelBar />
        <Bar h={186} />
      </div>
      <div className="flex flex-col gap-[9px]">
        <LabelBar />
        <Bar h={44} />
      </div>
    </PageSkeleton>
  );
}
