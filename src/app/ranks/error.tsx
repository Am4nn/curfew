"use client";

import { RouteError } from "@/app/_route-error";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="REPUTATION" back="/settings" backLabel="Back" />;
}
