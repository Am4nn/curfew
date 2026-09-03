import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { RANKS, IMMACULATE_FROM, rankFor, isImmaculate } from "@/domain";
import { globalScore } from "@/server/scoring";
import { RankIcon, RANK_TEXT } from "../rank-icon";

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

        <div className="flex items-center gap-[15px]">
          <span className={"flex flex-none " + RANK_TEXT[mine.key]}>
            <RankIcon score={score} size={42} />
          </span>
          <div className="flex flex-col gap-[5px]">
            <span className={"text-[32px] font-semibold leading-none " + RANK_TEXT[mine.key]}>
              {Math.round(score)}
            </span>
            <span className="text-[10.5px] tracking-[0.14em] text-muted">
              YOUR SCORE, ACROSS EVERYTHING
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
            {RANKS.map((rank) => (
              <div
                key={rank.key}
                className="flex items-center gap-[11px] border-b border-rule py-3"
              >
                <span className={"flex flex-none " + RANK_TEXT[rank.key]}>
                  <RankIcon score={rank.from} size={20} />
                </span>
                <div className="flex flex-1 flex-col gap-[3px]">
                  <span className={"text-[13.5px] tracking-[0.1em] " + RANK_TEXT[rank.key]}>
                    {rank.name}
                  </span>
                  <span className="text-[11px] text-muted">{rank.meaning}</span>
                </div>
                <span className="flex-none text-[11px] tabular-nums text-muted">
                  {rank.from}
                  {rank.key === "unbroken" ? "+" : ""}
                </span>
              </div>
            ))}

            <div className="flex items-center gap-[11px] border-b border-rule py-3">
              <span className="flex flex-none text-fg">
                <RankIcon score={IMMACULATE_FROM} size={20} />
              </span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="text-[13.5px] tracking-[0.1em] text-fg">IMMACULATE</span>
                <span className="text-[11px] text-muted">
                  A title inside UNBROKEN, not a band of its own
                </span>
              </div>
              <span className="flex-none text-[11px] tabular-nums text-muted">
                {IMMACULATE_FROM}+
              </span>
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
