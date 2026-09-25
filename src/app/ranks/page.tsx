import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { RANKS, IMMACULATE_CLEAN_DAYS, rankFor, isImmaculate } from "@/domain";
import { globalScore } from "@/server/scoring";
import { cleanRunIn } from "@/server/clean-run";
import { RankIcon, RANK_TEXT, rankText } from "../rank-icon";
import { CleanBar } from "@/app/clean-bar";
import { BackLink } from "@/app/back-link";

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

  const [score, cleanDays] = await Promise.all([
    globalScore(user.id),
    cleanRunIn(user.id, null),
  ]);
  const mine = rankFor(score);
  const held = isImmaculate(score, cleanDays);
  const colour = rankText(score, cleanDays);

  return (
    <main className="min-h-dvh px-5 pb-nav pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <BackLink fallback="/settings" className="text-base text-muted" />
          <span className="text-base font-semibold tracking-caps">
            HOW REPUTATION WORKS
          </span>
        </header>

        <div className="flex items-center gap-[13px] border border-rule p-3.5">
          <span className={"flex flex-none " + colour}>
            <RankIcon score={score} cleanDays={cleanDays} size={30} />
          </span>
          <div className="flex flex-1 flex-col gap-[3px]">
            <div className="flex items-baseline gap-[9px]">
              <span className={"text-xl font-semibold " + colour}>
                {Math.round(score)}
              </span>
              <span className={"text-micro tracking-caps " + colour}>
                {held ? "IMMACULATE" : mine.name}
              </span>
            </div>
            <span className="text-micro text-muted">
              Yours, across everything. Nobody else sees it.
            </span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          This number is yours alone and nobody else ever sees it. It sets where you
          start in a group you join, and nothing else. Inside a group you have a
          separate score that only that group can see.
        </p>

        <section className="flex flex-col gap-2.5">
          <span className="text-micro tracking-label text-muted">THE BANDS</span>
          <div className="flex flex-col">
            {[...RANKS].reverse().map((rank, i, reversed) => {
              const upper = i === 0 ? 1000 : reversed[i - 1].from - 1;
              return (
                <div
                  key={rank.key}
                  className="flex items-center gap-[13px] border-b border-rule py-3.5"
                >
                  <span className={"flex flex-none " + RANK_TEXT[rank.key]}>
                    <RankIcon score={rank.from} size={26} />
                  </span>
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <div className="flex items-baseline gap-[9px]">
                      <span className={"text-sm tracking-caps " + RANK_TEXT[rank.key]}>
                        {rank.name}
                      </span>
                      <span className="text-2xs tabular-nums text-muted">
                        {rank.from}-{upper}
                      </span>
                    </div>
                    <span className="text-2xs text-muted">{rank.meaning}</span>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-[13px] border-b border-rule py-3.5">
              <span className="flex flex-none text-gold">
                <CrownIcon size={26} />
              </span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <div className="flex items-baseline gap-[9px]">
                  <span className="text-sm tracking-caps text-gold">IMMACULATE</span>
                  <span className="text-2xs tabular-nums text-muted">
                    UNBROKEN, {IMMACULATE_CLEAN_DAYS} clean days
                  </span>
                </div>
                <span className="text-2xs text-muted">
                  Not a score. A record with nothing missed in it.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* The run itself, because it is the half of IMMACULATE that no number
            on this page shows. A score can be read off the top of the screen;
            "how long since you last let a day go" cannot. */}
        <section className="flex flex-col gap-[11px] border border-rule p-3.5">
          <span className="text-micro tracking-label text-muted">YOUR CLEAN RUN</span>
          {held ? (
            <span className="text-xs text-gold">
              {cleanDays} days, nothing missed.
            </span>
          ) : (
            <CleanBar cleanDays={cleanDays} />
          )}
          <span className="text-2xs leading-relaxed text-muted">
            A missed day sets this back to nothing. A day with nothing scheduled
            does not.
          </span>
        </section>

        <section className="flex flex-col gap-2.5">
          <span className="text-micro tracking-label text-muted">WHAT MOVES IT</span>
          <ul className="flex flex-col gap-2.5">
            {[
              "A day where everything scheduled was done moves it up. The gain shrinks as the number climbs, so 1000 is approached and never reached.",
              "A missed day moves it down by roughly what two clean days were worth at the start, and a week's worth at the top.",
              "Grace protects a streak. Never this number, never a fine, never a clean run.",
              "A group does not count the day you join it. Your streaks and this number do.",
              "Sharing more of what a group accepts raises the ceiling you can climb to. Sharing less lowers it, and the score settles down to meet it rather than dropping.",
              "A newly added activity cannot move it for seven days, so taking on something hard is never a risk to your standing.",
              "Doing nothing for a week starts a slow decay. A high score is a record you keep, not one you reach.",
            ].map((line) => (
              <li key={line} className="flex gap-[9px]">
                <span className="text-2xs leading-loose text-muted">&bull;</span>
                <span className="flex-1 text-xs leading-relaxed text-muted">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
