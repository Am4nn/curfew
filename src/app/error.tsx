"use client";

import { useEffect } from "react";
import { Screen } from "./_screen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to the server logs / console for diagnosis.
    console.error(error);
  }, [error]);

  return (
    <Screen>
      <div>
        <p className="text-[14px] text-penalty">Something failed while loading this page.</p>
        {error.digest ? (
          <p className="mt-1 text-[12px] text-muted">Reference {error.digest}</p>
        ) : null}
      </div>
      <div>
        <button
          onClick={reset}
          className="border border-fg bg-transparent px-[15px] py-[15px] text-[14px] text-fg"
        >
          Try again
        </button>
      </div>
    </Screen>
  );
}
