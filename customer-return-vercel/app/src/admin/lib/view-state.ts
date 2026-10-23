import { useEffect } from "react";

import { pagePath } from "../../shared/page-path";

/**
 * Which request the admin Returns page shows: `?id=RET-1001` → detail,
 * nothing → list. Kept in the URL so an editor recompile, a reload or a
 * shared link lands on the same screen; pushState (not replace) so the
 * browser Back button returns to the list, which admins expect.
 */
export function readSelectedId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("id") ?? "";
}

export function pushSelectedId(pageName: string, requestId: string): void {
  const next = requestId
    ? pagePath(pageName, `id=${encodeURIComponent(requestId)}`)
    : pagePath(pageName);
  const current = window.location.pathname + window.location.search;
  if (next !== current) window.history.pushState(null, "", next);
}

/** Re-sync React state when the user navigates with Back / Forward. */
export function usePopstate(onChange: (requestId: string) => void): void {
  useEffect(() => {
    const handler = () => onChange(readSelectedId());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [onChange]);
}
