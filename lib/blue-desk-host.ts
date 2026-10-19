/** User-facing URLs only. Internal Next routes are preserved for compatibility. */
export const BLUEBELLY_PRESENTATION_HOST = "bluebelly-desk.vercel.app";

export function blueDeskPublicHref(path: string, host: string | null | undefined) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const normalizedHost = (host || "").trim().toLowerCase().replace(/:443$/, "");
  if (normalizedHost !== BLUEBELLY_PRESENTATION_HOST) return path;
  if (path === "/blue-desk") return "/";
  if (path.startsWith("/blue-desk/")) return path.slice("/blue-desk".length);
  return path;
}

/** Exact Bluebelly routes only. API, auth, research, and legacy pages never rewrite. */
export function blueDeskPresentationTarget(pathname: string, host: string | null | undefined) {
  const hostname = (host || "").trim().toLowerCase().replace(/:443$/, "");
  if (hostname !== BLUEBELLY_PRESENTATION_HOST) return null;
  if (pathname === "/") return "/blue-desk";
  if (pathname === "/calendar") return "/blue-desk/calendar";
  if (/^\/stories\/[^/]+$/.test(pathname)) return "/blue-desk" + pathname;
  return null;
}

/**
 * Routing authority for the dedicated Bluebelly public hostname.
 * Other aliases must not silently inherit the public route allowlist.
 * Private pages and APIs remain available only through the owner/operation
 * hostname, where middleware and route-level authentication apply.
 */
export function blueDeskHostAccess(pathname: string, host: string | null | undefined):
  "public" | "blocked" | "private" {
  const hostname = (host || "").trim().toLowerCase().replace(/:443$/, "");
  if (hostname === "alchemy-blue-desk.vercel.app") return "blocked";
  if (hostname !== BLUEBELLY_PRESENTATION_HOST) return "private";

  const publicPage =
    pathname === "/" ||
    pathname === "/calendar" ||
    pathname === "/blue-desk" ||
    pathname === "/blue-desk/calendar" ||
    /^\/(?:blue-desk\/)?stories\/article(?::|%3a)[0-9a-f-]{36}(?::|%3a)[0-9a-f-]{36}$/i.test(pathname);

  return publicPage ? "public" : "blocked";
}
