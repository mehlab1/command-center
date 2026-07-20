import { useEffect, useState } from "react";
import { UseQueryResult } from "@tanstack/react-query";

const SLOW_THRESHOLD_MS = 3000;

// Dashboard panels fire several queries in parallel on mount, so no single
// apiFetch onSlow callback covers "the page as a whole is taking a while."
// This shows one shared banner if nothing has come back yet after 3s, and
// hides it the moment anything does — docs/07-frontend-design-system.md.
export function useColdStartBanner(queries: UseQueryResult[]): boolean {
  const [waking, setWaking] = useState(false);
  const anySettled = queries.some((q) => q.isSuccess || q.isError);
  const allLoading = queries.length > 0 && queries.every((q) => q.isLoading);

  useEffect(() => {
    if (anySettled) {
      setWaking(false);
      return;
    }
    if (!allLoading) return;

    const timer = setTimeout(() => setWaking(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [allLoading, anySettled]);

  return waking && !anySettled;
}
