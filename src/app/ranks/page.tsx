import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { RANKS, IMMACULATE_FROM, rankFor, isImmaculate } from "@/domain";
import { globalScore } from "@/server/scoring";
import { RankIcon, RANK_TEXT } from "../rank-icon";

// A crown, gold, glowing: the mock's own icon for IMMACULATE, deliberately
// distinct from UNBROKEN's mountain even though it is "a title inside
// UNBROKEN, not a band of its own" -- on this one explanatory list, telling
// the two apart at a glance matters more than the literal domain model.
function CrownIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 6px var(--gold))" }}
    >
      <path d="M3.5 18h17" />
      <path d="M4.5 18 3 8l5 4 4-7 4 7 5-4-1.5 10Z" />
    </svg>
  );
}

// What the number means, in the app rather than in a document. Reached from a
// standing screen and from Settings.
export default async function RanksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const score = await globalScore(user.id);
  const mine = rankFor(score);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <Link href="/settings" className="text-[14px] text-muted">
            &lsaquo;
          </Link>
          <span className="text-[14px] font-semibold tracking-[0.14em]">
            HOW REPUTATION WORKS
          </span>
        </header>

        <div className="flex items-center gap-[13px] border border-rule p-[14px]">
          <span className={"flex flex-none " + RANK_TEXT[mine.key]}>
            <RankIcon score={score} size={30} />
          </span>
          <div className="flex flex-1 flex-col gap-[3px]">
            <div className="flex items-baseline gap-[9px]">
              <span className={"text-[20px] font-semibold " + RANK_TEXT[mine.key]}>
                {Math.round(score)}
              </span>
              <span className={"text-[10.5px] tracking-[0.14em] " + RANK_TEXT[mine.key]}>
                {mine.name}
              </span>
            </div>
            <span className="text-[10.5px] text-muted">
              Yours, across everything. Nobody else sees it.
            </span>
          </div>
        </div>

        <p className="text-[12.5px] leading-[1.6] text-muted">
          This number is yours alone and nobody else ever sees it. It sets where you
          start in a group you join, and nothing else. Inside a group you have a
          separate score that only that group can see.
        </p>

        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">THE BANDS</span>
          <div className="flex flex-col">
            {[...RANKS].reverse().map((rank, i, reversed) => {
              const upper = i === 0 ? 1000 : reversed[i - 1].from - 1;
              return (
                <div
                  key={rank.key}
                  className="flex items-center gap-[13px] border-b border-rule py-[14px]"
                >
                  <span className={"flex flex-none " + RANK_TEXT[rank.key]}>
                    <RankIcon score={rank.from} size={26} />
                  </span>
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <div className="flex items-baseline gap-[9px]">
                      <span className={"text-[13.5px] tracking-[0.12em] " + RANK_TEXT[rank.key]}>
                        {rank.name}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted">
                        {rank.from}-{upper}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted">{rank.meaning}</span>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-[13px] border-b border-rule py-[14px]">
              <span className="flex flex-none text-gold">
                <CrownIcon size={26} />
              </span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <div className="flex items-baseline gap-[9px]">
                  <span className="text-[13.5px] tracking-[0.12em] text-gold">IMMACULATE</span>
                  <span className="text-[11px] tabular-nums text-muted">
                    {IMMACULATE_FROM}+
                  </span>
                </div>
                <span className="text-[11px] text-muted">
                  A title inside UNBROKEN, not a rank of its own
                </span>
              </div>
            </div>
          </div>
          {isImmaculate(score) ? (
            <span className="text-[11.5px] leading-[1.55] text-muted">
              Yours is glowing. It is the only glow in the app.
            </span>
          ) : null}
        </section>

        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">WHAT MOVES IT</span>
          <ul className="flex flex-col gap-[10px]">
            {[
              "A day where everything scheduled was done moves it up. The gain shrinks as the number climbs, so 1000 is approached and never reached.",
              "A missed day moves it down by roughly what two clean days were worth at the start, and a week's worth at the top.",
              "Grace protects a streak. It never protects this number, and it never waives a fine.",
              "Sharing more of what a group accepts raises the ceiling you can climb to. Sharing less lowers it, and the score settles down to meet it rather than dropping.",
              "A newly added activity cannot move it for seven days, so taking on something hard is never a risk to your standing.",
              "Doing nothing for a week starts a slow decay. A high score is a record you keep, not one you reach.",
            ].map((line) => (
              <li key={line} className="flex gap-[9px]">
                <span className="text-[11px] leading-[1.65] text-muted">&bull;</span>
                <span className="flex-1 text-[12px] leading-[1.6] text-muted">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
