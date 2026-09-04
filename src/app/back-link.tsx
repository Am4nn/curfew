"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The `‹` in a screen header. Goes back to where you actually came from.
 *
 * Every one of these used to be a hardcoded link to the screen someone assumed
 * you had arrived from, which is wrong the moment a screen has two ways in.
 * Ranks sent you to Settings even when you opened it from a group's standing;
 * an activity sent you to the activity list even when you tapped its icon on
 * Home.
 *
 * `fallback` is not decoration. A tab opened straight onto this URL, a reload,
 * or a follow from outside all have no history to go back to, and `history.back()`
 * would leave the person on whatever was in the tab before, or do nothing at
 * all. So the parent screen is still named, and used whenever there is no
 * in-app history to return to.
 */
export function BackLink({
  fallback,
  className = "text-[14px] text-muted",
  label = "Back",
  children,
}: {
  /** Where to go when there is nothing to go back to. */
  fallback: string;
  className?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  // history.length counts entries in this tab, and a fresh tab lands on 1.
  // Read after mount, because the server has no history to read and rendering
  // two different things would hydrate wrong.
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  if (!canGoBack) {
    return (
      <Link href={fallback} className={className} aria-label={label}>
        {children ?? "‹"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className + " active:opacity-70"}
      aria-label={label}
    >
      {children ?? "‹"}
    </button>
  );
}
