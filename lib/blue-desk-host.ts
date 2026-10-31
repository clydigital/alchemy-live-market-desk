/** User-facing URLs only. Internal Next routes are preserved for compatibility. */
export const BLUEBELLY_PRESENTATION_HOST = "bluebelly-desk.vercel.app";
export const LIVE_DESK_PRESENTATION_HOST = "alchemy-live-market-desk.vercel.app";

// Only the explicitly listed public editorial lens IDs are reachable anonymously.
// Do not expose arbitrary dynamic segments on the public presentation hosts.
const PUBLIC_LEARN_DECK_PATH = /^\/(?:blue-desk\/)?learn\/decks\/(?:d02|d06|d08|d13|d15|d17|d23|d24|d26)$/;

const PUBLIC_REGIME_LENS_PATH = /^\/(?:blue-desk\/)?regime-watch\/(?:fed|bonds|ai|china|energy|yen|breadth|gold|housing)$/;

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
  // The old canonical Live overview URL is a public read-only alias only.
  // The operational owner workspace stays protected on private hosts.
  if (normalizedHost(host) === LIVE_DESK_PRESENTATION_HOST && pathname === "/owner/live") {
    return "/blue-desk";
  }
  if (pathname === "/") return "/blue-desk";
  if (pathname === "/calendar") return "/blue-desk/calendar";
  if (pathname === "/daily-report") return "/blue-desk/daily-report";
  if (pathname === "/learn") return "/blue-desk/learn";
  if (PUBLIC_LEARN_DECK_PATH.test(pathname) && pathname.startsWith("/learn/decks/")) return "/blue-desk" + pathname;
  if (pathname === "/key-stories") return "/blue-desk/key-stories";
  if (pathname === "/newsroom") return "/blue-desk/newsroom";
  if (pathname === "/hormuz") return "/blue-desk/hormuz";
  if (pathname === "/regime-watch") return "/blue-desk/regime-watch";
  if (pathname === "/crash-opportunity") return "/blue-desk/crash-opportunity";
  if (pathname.startsWith("/regime-watch/") && PUBLIC_REGIME_LENS_PATH.test(pathname)) return "/blue-desk" + pathname;
  if (pathname === "/features/asia-equities" || pathname === "/features/global-bonds") return "/blue-desk" + pathname;
  // Temporary auth-free development lab uses strictly synthetic browser-local
  // inputs. Real owner pages, APIs and source records remain private.
  if (normalizedHost(host) === BLUEBELLY_PRESENTATION_HOST &&
      pathname === "/editorial-lab") return "/blue-desk/editorial-lab";
  if (pathname === "/markets") return "/blue-desk/markets";
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

  // One strictly bounded public X discovery handoff for the existing ChatGPT
  // MacroPulse reader. It is a READ-ONLY redacted view of public original X
  // posts; never expose owner pages, raw operational data, tokens or write APIs.
  if(hostname===BLUEBELLY_PRESENTATION_HOST &&
     pathname==="/api/x-wire/discovery")return "public";

  // Narrow approved-owner enclave on the Bluebelly hostname. This is
  // NOT a public page: the normal middleware session+allowlist gate applies.
  // Only exact paths can be used; legacy operational owner routes and all
  // unrelated APIs remain blocked on the public presentation hostname.
  if(hostname === BLUEBELLY_PRESENTATION_HOST && [
    "/my-reports", "/login", "/auth/google", "/auth/callback",
    "/auth/signout", "/api/owner/automated-report-pdf",
    // Native Bluebelly owner tools only; every path still requires a
    // valid Supabase session and the active user allowlist in middleware.
    "/owner/editorial", "/owner/presenter", "/owner/research", "/owner/x-wire", "/market-tools",
    "/owner/presenter/editions",
    // Exactly scoped private report and research review readback paths.
    "/owner/daily-report", "/api/owner/macropulse-briefs",
    "/api/owner/daily-research",
    "/api/owner/editorial-generate", "/api/owner/editorial-investigate",
    "/api/presenter/technical-checks",
  ].includes(pathname)) return "private";

  // Temporary development-only UI viewer on the dedicated public host.
  // No owner API, private provider data, canonical DB, secrets or writes.
  if (hostname === BLUEBELLY_PRESENTATION_HOST &&
      (pathname === "/editorial-lab" || pathname === "/blue-desk/editorial-lab"))
    return "public";

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

  const publicPage =
    pathname === "/" ||
    pathname === "/calendar" ||
    pathname === "/learn" || pathname === "/blue-desk/learn" ||
    PUBLIC_LEARN_DECK_PATH.test(pathname) ||
    pathname === "/daily-report" ||
    pathname === "/blue-desk/daily-report" ||
    pathname === "/blue-desk" ||
    pathname === "/blue-desk/calendar" ||
    pathname === "/key-stories" ||
    pathname === "/blue-desk/key-stories" ||
    pathname === "/newsroom" || pathname === "/blue-desk/newsroom" ||
    pathname === "/hormuz" || pathname === "/blue-desk/hormuz" ||
    pathname === "/regime-watch" || pathname === "/blue-desk/regime-watch" ||
    pathname === "/crash-opportunity" || pathname === "/blue-desk/crash-opportunity" ||
    PUBLIC_REGIME_LENS_PATH.test(pathname) ||
    pathname === "/features/asia-equities" ||
    pathname === "/features/global-bonds" ||
    pathname === "/blue-desk/features/asia-equities" ||
    pathname === "/blue-desk/features/global-bonds" ||
    pathname === "/markets" ||
    pathname === "/blue-desk/markets" ||
    /^\/(?:blue-desk\/)?stories\/article(?::|%3a)[0-9a-f-]{36}(?::|%3a)[0-9a-f-]{36}$/i.test(pathname);

  return publicPage ? "public" : hostname === BLUEBELLY_PRESENTATION_HOST ? "blocked" : "private";
}

/**
 * Reversible retirement of the old human-facing Live hostname. The underlying
 * Vercel project remains essential to research, cron, provider, owner and API
 * services. Only the exact public presentation allowlist is redirected.
 *
 * Never translate historical edition / evidence selectors into today's page.
 * A null result retains the original gated route for a later exact-replay
 * migration, instead of producing an inaccurate current-market substitute.
 */
export function retiredLivePublicDestination(
 pathname: string, host: string | null | undefined, search = "",
): string | null {
 if (normalizedHost(host) !== LIVE_DESK_PRESENTATION_HOST
   || blueDeskHostAccess(pathname,host) !== "public"
   || typeof search !== "string" || search.length > 1024) return null;
 const query=new URLSearchParams(search.startsWith("?")?search.slice(1):search);
 for(const key of ["edition","dossier","story","motion","regime","event","research_run","article","snapshot"]){
  if(query.has(key)) return null;
 }
 let clean=pathname;
 if(pathname==="/owner/live")clean="/";
 else if(pathname==="/owner/markets")clean="/markets";
 else if(pathname==="/blue-desk")clean="/";
 else if(pathname.startsWith("/blue-desk/"))clean=pathname.slice("/blue-desk".length);
 const dest=new URL(clean,"https://"+BLUEBELLY_PRESENTATION_HOST);
 // Carry only bounded, known public filter state. Discard unknown parameters;
 // never forward token/credential-style query data to the public product.
 const one=(key:string,pattern:RegExp)=>{
  const value=query.get(key);
  if(value && pattern.test(value))dest.searchParams.set(key,value);
 };
 if(clean==="/markets")one("group",/^[a-z0-9-]{1,40}$/);
 if(clean==="/calendar")one("window",/^[a-z0-9-]{1,40}$/);
 if(clean==="/key-stories")one("feature",/^[a-z0-9-]{1,56}$/);
 return dest.toString();
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
  if (["rates", "yields", "bonds"].includes(key)) return "/#rates-title";
  if (["stories", "key stories"].includes(key)) return "/key-stories";
  if (["motion", "what changed", "changes"].includes(key)) return "/#motion-title";
  return "/";
}
