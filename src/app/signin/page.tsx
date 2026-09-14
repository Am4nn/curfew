"use client";

import Image from "next/image";
import { signIn } from "@/lib/auth-client";
import { QuorumMark } from "../mark";

// The only screen a stranger ever sees.
//
// It used to be the wordmark, one sentence and a button, and the sentence was
// v1's: "a group accountability contract for nightly sleep". Wrong on every
// count by v3, which is a personal habit tracker with twelve types where
// groups are opt-in.
//
// One screen, no scrolling, and it does not explain the product. It states the
// deal, shows three photographs, and names the three things that separate this
// from every other habit tracker. Anybody who wants more than that is already
// signed in, and anybody without an invite cannot act on more than that anyway.
//
// No testimonials, no user count, no logos. There are three users, and an
// invented number would be the one dishonest thing on a page whose whole pitch
// is honesty. For the same reason the photographs are generated and the page
// never calls them real check-ins: members' evidence can never appear here,
// because this is the one screen served to people who are not signed in.

const SHOTS = [
  { src: "/landing/gym.webp", alt: "A barbell on the floor of a gym" },
  { src: "/landing/sleep.webp", alt: "An unmade bed in early morning light" },
  { src: "/landing/food.webp", alt: "A bowl of food on a kitchen table" },
] as const;

function GoogleMark() {
  // Google's own colours, and not recoloured: their branding terms govern the
  // mark once it is on the button.
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" className="flex-none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5.1-4.4 6.7v5.5h7.1c4.1-3.8 6.6-9.5 6.6-16.4Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.2 15.5 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.2-2.9.7-4.3v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.6Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.8 4.5 13.8l7.3 5.7c1.7-5.2 6.5-8.8 12.2-8.8Z"
      />
    </svg>
  );
}

export default function SignIn() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5">
        <div className="flex items-center gap-3 pt-[52px] text-[30px] font-semibold tracking-[0.2em]">
          <QuorumMark size={27} />
          CURFEW
        </div>

        <div className="flex flex-1 flex-col justify-center gap-[26px] py-8">
          <div className="flex flex-col gap-[15px]">
            <h1 className="text-pretty text-[27px] font-semibold leading-[1.22] tracking-[-0.015em]">
              Prove it, or it didn&rsquo;t happen.
            </h1>
            <p className="text-pretty text-[13.5px] leading-[1.7] text-muted">
              Twelve habits on your own schedule. Curfew tells you what a miss
              costs before you miss it, asks for a photograph where one is worth
              having, and keeps the record either way.
            </p>
          </div>

          <div className="flex gap-2">
            {SHOTS.map((shot) => (
              <div key={shot.src} className="relative aspect-square flex-1 bg-surface">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  fill
                  sizes="(max-width: 560px) 33vw, 180px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          <p className="text-[11.5px] leading-[1.6] text-muted">
            Photographs are kept 60 days, then deleted.
          </p>
        </div>

        <div className="flex flex-col gap-3 pb-[34px]">
          <button
            onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}
            className="flex h-[52px] w-full items-center justify-center gap-[11px] border border-fg bg-fg text-[15px] font-semibold text-bg active:opacity-70"
          >
            <GoogleMark />
            Sign in with Google
          </button>
          <p className="text-center text-[11px] text-muted">
            Invite only. New accounts wait for an admin.
          </p>
        </div>
      </div>
    </main>
  );
}
