"use client";

import { RouteError } from "./_route-error";

// The last boundary: Home itself, and any segment without one of its own.
// There is no "back" here, because Home is where back would go.
export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="CURFEW" />;
}
