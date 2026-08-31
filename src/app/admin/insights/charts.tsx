import type { BalanceBar } from "@/server/insights";
import { Figure } from "../../charts";

// Diverging horizontal bars for net balances. TimeChart and Figure live in the
// shared ../../charts module, reused by the member /chart page.
export function BalanceBars({
  data,
  fmt,
}: {
  data: BalanceBar[];
  fmt: (v: number, currency: string) => string;
}) {
  if (data.length === 0) {
    return (
      <Figure title="Outstanding balances">
        <p className="text-[13px] text-muted">Everything is settled.</p>
      </Figure>
    );
  }
  const max = Math.max(...data.map((d) => Math.abs(d.netOwed)));
  return (
    <Figure title="Outstanding balances">
      <div className="flex flex-col gap-2">
        {data.map((b) => {
          const owes = b.netOwed > 0;
          const w = max === 0 ? 0 : (Math.abs(b.netOwed) / max) * 100;
          return (
            <div key={b.name} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 shrink-0 truncate">{b.name}</span>
              <span className="h-[14px] flex-1 bg-surface">
                <span
                  className="block h-full"
                  style={{ width: `${w}%`, background: owes ? "var(--penalty)" : "var(--pass)" }}
                />
              </span>
              <span className={"w-28 shrink-0 text-right tabular-nums " + (owes ? "text-penalty" : "text-pass")}>
                {owes ? "owes " : "owed "}
                {fmt(Math.abs(b.netOwed), b.currency)}
              </span>
            </div>
          );
        })}
      </div>
    </Figure>
  );
}
