import Link from "next/link";
import { Screen } from "./_screen";

export default function NotFound() {
  return (
    <Screen>
      <p className="text-base text-muted">No such page.</p>
      <div>
        <Link
          href="/"
          className="inline-block border border-fg bg-transparent px-[15px] py-[15px] text-base text-fg"
        >
          Back to dashboard
        </Link>
      </div>
    </Screen>
  );
}
