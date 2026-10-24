import { BLUEBELLY_PRESENTATION_HOST } from "./blue-desk-host.ts";

/**
 * Owner Presenter links are clean only on the exact Bluebelly reader hostname.
 * Canonical Live and private preview hosts have no clean full-prep rewrite,
 * so they must use their existing internal page paths.
 *
 * This helper changes links only; host routing, middleware and RLS are unchanged.
 */
export function bluebellyOwnerPresenterHref(
  page: "current" | "history",
  host: string | null | undefined,
): string {
  const normalized = (host || "").trim().toLowerCase().replace(/:443$/, "");
  const isBluebelly = normalized === BLUEBELLY_PRESENTATION_HOST;
  if (page === "current") {
    return isBluebelly ? "/presenter" : "/blue-desk/presenter";
  }
  return isBluebelly ? "/presenter/full-prep" : "/blue-desk/presenter/full-prep";
}
