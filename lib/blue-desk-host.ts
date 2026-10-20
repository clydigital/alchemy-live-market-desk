/** User-facing URLs only. Internal Next routes are preserved for compatibility. */
export const BLUEBELLY_PRESENTATION_HOST = "bluebelly-desk.vercel.app";
export const LIVE_DESK_PRESENTATION_HOST = "alchemy-live-market-desk.vercel.app";

function normalizedHost(host: string | null | undefined) {
  return (host || "").trim().toLowerCase().replace(/:443$/, "");
}

/** Only the approved public reading hosts use public-clean Blue Desk links. */
export function isBlueDeskPublicReaderHost(host: string | null | undefined) {
  return [BLUEBELLY_PRESENTATION_HOST, LIVE_DESK_PRESENTATION_HOST].includes(normalizedHost(host));
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
  if (pathname === "/") return "/blue-desk";
  if (pathname === "/calendar") return "/blue-desk/calendar";
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
  if (hostname !== BLUEBELLY_PRESENTATION_HOST && hostname !== LIVE_DESK_PRESENTATION_HOST) return "private";

  const publicPage =
    pathname === "/" ||
    pathname === "/calendar" ||
    pathname === "/blue-desk" ||
    pathname === "/blue-desk/calendar" ||
    /^\/(?:blue-desk\/)?stories\/article(?::|%3a)[0-9a-f-]{36}(?::|%3a)[0-9a-f-]{36}$/i.test(pathname);

  return publicPage ? "public" : hostname === BLUEBELLY_PRESENTATION_HOST ? "blocked" : "private";
}
