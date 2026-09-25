import type { TypeRate, AbandonRate, GroupsSummary } from "@/server/insights";
import { ActivityIcon } from "../../activity-icon";

function SectionHeader({ title }: { title: string }) {
  return <div className="text-micro tracking-label text-muted">{title}</div>;
}

// Per-type pass rate, worst last, each with a thin fill bar. Mirrors the
// "WHAT PEOPLE ACTUALLY HOLD" list in the mock.
export function TypeBreakdown({
  title,
  rates,
  caption,
}: {
  title: string;
  rates: TypeRate[];
  caption: string | null;
}) {
  if (rates.length === 0) {
    return (
      <section className="mb-8 flex flex-col gap-2.5">
        <SectionHeader title={title} />
        <p className="text-sm text-muted">No scored periods yet.</p>
      </section>
    );
  }
  return (
    <section className="mb-8 flex flex-col gap-2.5">
      <SectionHeader title={title} />
      <div className="flex flex-col">
        {rates.map((r) => (
          <div key={r.typeKey} className="flex items-center gap-[11px] border-b border-rule py-[11px]">
            <span className="flex-none text-muted">
              <ActivityIcon name={r.icon} size={17} />
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-[9px]">
                <span className="text-sm">{r.name}</span>
                <span className="text-2xs text-muted">{r.percent}% pass</span>
              </div>
              <div className="h-[3px] bg-surface">
                <div className="h-[3px] bg-fg" style={{ width: `${r.percent}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {caption ? <p className="text-2xs leading-relaxed text-muted">{caption}</p> : null}
    </section>
  );
}

// A plain "label / detail / percent" row, reused for abandonment.
function Row({ label, detail, value }: { label: string; detail: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-rule py-[11px]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-sm">{label}</span>
        <span className="text-micro text-muted">{detail}</span>
      </div>
      <span className="flex-none text-2xs text-muted">{value}</span>
    </div>
  );
}

export function AbandonmentList({ title, rows }: { title: string; rows: AbandonRate[] }) {
  if (rows.length === 0) {
    return (
      <section className="mb-8 flex flex-col gap-2.5">
        <SectionHeader title={title} />
        <p className="text-sm text-muted">Nobody has dropped a type this early yet.</p>
      </section>
    );
  }
  return (
    <section className="mb-8 flex flex-col gap-2.5">
      <SectionHeader title={title} />
      <div className="flex flex-col">
        {rows.map((r) => (
          <Row key={r.typeKey} label={r.name} detail={`${r.percent}% stop tracking it`} value={`${r.percent}%`} />
        ))}
      </div>
    </section>
  );
}

export function GroupsSummaryRows({ title, stats }: { title: string; stats: GroupsSummary }) {
  return (
    <section className="mb-8 flex flex-col gap-2.5">
      <SectionHeader title={title} />
      <div className="flex flex-col">
        <Row
          label="Active this week"
          detail="at least one shared check-in"
          value={`${stats.activeThisWeek.count} of ${stats.activeThisWeek.of}`}
        />
        <Row label="Dormant a month" detail="no check-ins from anyone" value={String(stats.dormantAMonth)} />
        <Row
          label="Tracking money"
          detail="the rest are reputation only"
          value={`${stats.trackingMoney.count} of ${stats.trackingMoney.of}`}
        />
        <Row label="Median size" detail="members per group" value={String(stats.medianSize)} />
      </div>
    </section>
  );
}
