/** User-facing URLs only. Internal Next routes are preserved for compatibility. */
export const BLUEBELLY_PRESENTATION_HOST = "bluebelly-desk.vercel.app";
/** Branch-bound V6 review hostname; never a production hostname. */
export const BLUEBELLY_V6_REVIEW_HOST = "bluebelly-v6-review.vercel.app";
export const LIVE_DESK_PRESENTATION_HOST = "alchemy-live-market-desk.vercel.app";

function normalizedHost(host: string | null | undefined) {
  return (host || "").trim().toLowerCase().replace(/:443$/, "");
}

export function isBluebellyReaderHost(host: string | null | undefined) {
  return [BLUEBELLY_PRESENTATION_HOST, BLUEBELLY_V6_REVIEW_HOST].includes(normalizedHost(host));
}

/** Only the approved public reading hosts use public-clean Blue Desk links. */
export function isBlueDeskPublicReaderHost(host: string | null | undefined) {
  return isBluebellyReaderHost(host) || normalizedHost(host) === LIVE_DESK_PRESENTATION_HOST;
}

export function blueDeskPublicHref(path: string, host: string | null | undefined) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (!isBlueDeskPublicReaderHost(host)) return path;
  if (path === "/blue-desk") return "/";
  if (path.startsWith("/blue-desk/")) return path.slice("/blue-desk".length);
  return path;
}

/** Exact Bluebelly routes only. API, auth, research, and legacy pages never rewrite. */
export function blueDeskPresentationTarget(pathname: string, host: string | null | undefined) {
  if (!isBlueDeskPublicReaderHost(host)) return null;
  // The old canonical Live overview URL is a public read-only alias only.
  // The operational owner workspace stays protected on private hosts.
  if (normalizedHost(host) === LIVE_DESK_PRESENTATION_HOST && pathname === "/owner/live") {
    return "/blue-desk";
  }
  if (pathname === "/") return "/blue-desk";
  if (pathname === "/calendar") return "/blue-desk/calendar";
  if (pathname === "/learn") return "/blue-desk/learn";
  if (pathname === "/markets") return "/blue-desk/markets";
  if (pathname === "/key-stories") return "/blue-desk/key-stories";
  if (pathname === "/rates") return "/blue-desk/rates";
  if (pathname === "/what-changed") return "/blue-desk/what-changed";
  if (pathname === "/presenter") return "/blue-desk/presenter";
  if (pathname === "/presenter/editorial") return "/blue-desk/presenter/editorial";
  if (pathname === "/presenter/dossier") return "/blue-desk/dossier";
  if (pathname === "/presenter/changes") return "/blue-desk/changes";
  if (pathname === "/presenter/full-prep") return "/hybrid-output/prepare";
  if (/^\/stories\/[^/]+$/.test(pathname)) return "/blue-desk" + pathname;
  return null;
}

/**
 * Routing authority for the dedicated Bluebelly public hostname.
 * Canonical Live hostname also serves approved public reader routes while all
 * other Live paths remain private. Other aliases do not inherit the allowlist.
 * Private pages and APIs remain available only through the owner/operation
 * hostname, where middleware and route-level authentication apply.
 */
export function blueDeskHostAccess(pathname: string, host: string | null | undefined):
  "public" | "blocked" | "private" {
  const hostname = normalizedHost(host);
  if (hostname === "alchemy-blue-desk.vercel.app") return "blocked";
  if (!isBluebellyReaderHost(hostname) && hostname !== LIVE_DESK_PRESENTATION_HOST) return "private";

  // Explicitly approved, read-only full Markets terminal. This exception
  // applies to the exact Live hostname/path only; do not open other owner
  // routes, API handlers, aliases, or the dedicated Bluebelly hostname.
  // Canonical Live bookmarks use the existing source-limited Blue Desk
  // overview. No owner operations, Dossier write surfaces or APIs are exposed.
  if (hostname === LIVE_DESK_PRESENTATION_HOST && pathname === "/owner/live") {
    return "public";
  }
  if (hostname === LIVE_DESK_PRESENTATION_HOST && pathname === "/owner/markets") {
    return "public";
  }

  // Auth routes for the precise Bluebelly domain only. The private Presenter
  // is still enforced by the existing Supabase claims + active allowlist gate.
  // No other Bluebelly owner routes, research APIs or machine jobs are opened.
  if (isBluebellyReaderHost(hostname)) {
    if (["/login", "/auth/google", "/auth/callback", "/auth/signout"].includes(pathname)) return "public";
    if (["/presenter", "/presenter/editorial", "/presenter/dossier", "/presenter/changes", "/presenter/full-prep", "/api/presenter/technical-checks"].includes(pathname)) return "private";
  }

  const publicPage =
    pathname === "/" ||
    pathname === "/calendar" ||
    pathname === "/learn" ||
    pathname === "/blue-desk/learn" ||
    pathname === "/blue-desk" ||
    pathname === "/blue-desk/calendar" ||
    pathname === "/markets" ||
    pathname === "/key-stories" ||
    pathname === "/blue-desk/key-stories" ||
    pathname === "/rates" ||
    pathname === "/blue-desk/rates" ||
    pathname === "/what-changed" ||
    pathname === "/blue-desk/what-changed" ||
    pathname === "/blue-desk/markets" ||
    /^\/(?:blue-desk\/)?stories\/article(?::|%3a)[0-9a-f-]{36}(?::|%3a)[0-9a-f-]{36}$/i.test(pathname);

  return publicPage ? "public" : isBluebellyReaderHost(hostname) ? "blocked" : "private";
}

/**
 * Old Live Desk query bookmarks should land on a public read-only surface,
 * never an owner-only operational route that demands sign-in. This function
 * intentionally maps to a small allowlist; it cannot be an open redirect.
 */
export function publicLiveLegacyTabDestination(tab: string | null): string {
  const key = (tab || "").trim().toLowerCase();
  if (["markets", "market", "prices", "price observations"].includes(key)) return "/owner/markets";
  if (["calendar", "economic calendar", "economic-calendar"].includes(key)) return "/calendar";
  if (["rates", "yields", "bonds"].includes(key)) return "/rates";
  if (["stories", "key stories"].includes(key)) return "/key-stories";
  if (["motion", "what changed", "changes"].includes(key)) return "/what-changed";
  return "/";
}
