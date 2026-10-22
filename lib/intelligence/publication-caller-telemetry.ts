export const PUBLICATION_CALLER_TELEMETRY_VERSION = "publication-caller-v1" as const;

export type PublicationFeedRoute =
  | "/api/hybrid-feed"
  | "/api/hybrid-feed-v2"
  | "/api/intelligence-feed";

export type LegacyReadRoute =
  | "/api/dossier-v2"
  | "/api/dossier-v2/history"
  | "/api/market-intelligence-snapshot";

type CallerClass = "browser" | "search_bot" | "monitor" | "script" | "unknown";

function callerClass(userAgent: string | null): CallerClass {
  const value = (userAgent || "").toLowerCase();
  if (!value) return "unknown";
  if (/googlebot|bingbot|duckduckbot|baiduspider|yandexbot/.test(value)) return "search_bot";
  if (/uptimerobot|pingdom|healthcheck|statuscake|better uptime|betterstack/.test(value)) return "monitor";
  if (/curl|wget|python-requests|python\/|node-fetch|undici|axios|postmanruntime|insomnia/.test(value)) return "script";
  if (/mozilla\/5\.0|chrome\/|safari\/|firefox\/|edg\//.test(value)) return "browser";
  return "unknown";
}

function referrerHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function fetchSite(value: string | null) {
  if (value === "same-origin" || value === "same-site" || value === "cross-site" || value === "none") return value;
  return "unknown" as const;
}

/**
 * Runtime-only compatibility telemetry. Intentionally excludes IP addresses,
 * cookies, auth headers, raw user-agent strings and referrer path/query data.
 * This exists solely to prove which public feed aliases are still used before
 * any compatibility route or response field is retired.
 */
export function publicationCallerTelemetry(request: Request, route: PublicationFeedRoute) {
  const url = new URL(request.url);
  return {
    event: "publication_feed_caller",
    version: PUBLICATION_CALLER_TELEMETRY_VERSION,
    route,
    method: request.method,
    callerClass: callerClass(request.headers.get("user-agent")),
    fetchSite: fetchSite(request.headers.get("sec-fetch-site")),
    referrerHost: referrerHost(request.headers.get("referer")),
    hasEditionParameter: url.searchParams.has("edition"),
  };
}

export function recordPublicationCaller(request: Request, route: PublicationFeedRoute) {
  console.info(JSON.stringify(publicationCallerTelemetry(request, route)));
}

/**
 * P−1d: privacy-bounded observation window before restricting any legacy read.
 * Does not constitute authentication and cannot certify absence of consumers.
 * Caller class can be spoofed; log only coarse headers and boolean query flags.
 */
export function legacyReadCallerTelemetry(request: Request, route: LegacyReadRoute) {
  const url = new URL(request.url);
  return {
    event: "legacy_api_read_caller",
    version: PUBLICATION_CALLER_TELEMETRY_VERSION,
    route,
    method: request.method,
    callerClass: callerClass(request.headers.get("user-agent")),
    fetchSite: fetchSite(request.headers.get("sec-fetch-site")),
    referrerHost: referrerHost(request.headers.get("referer")),
    hasIdParameter: url.searchParams.has("id"),
    hasLimitParameter: url.searchParams.has("limit"),
  };
}

export function recordLegacyReadCaller(request: Request, route: LegacyReadRoute) {
  console.info(JSON.stringify(legacyReadCallerTelemetry(request, route)));
}
