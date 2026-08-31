import { Screen } from "./_screen";

export default function Loading() {
  return (
    <Screen>
      <p className="flex items-center gap-3 text-[13px] uppercase tracking-[0.14em] text-muted">
        <span className="h-[10px] w-[10px] animate-pulse bg-muted" aria-hidden />
        Loading
      </p>
    </Screen>
  );
}
