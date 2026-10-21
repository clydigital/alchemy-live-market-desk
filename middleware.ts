import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  MACHINE_AUTH_PATHS,
  PUBLIC_AUTH_PATHS,
  dashboardAuthRequired,
  getSupabasePublicConfig,
} from "@/lib/supabase/config";
import { PRODUCTION_RESEARCH_AUTOMATION_PAUSED } from "@/lib/research-automation-routing";
import { LIVE_DESK_PRESENTATION_HOST, blueDeskHostAccess, blueDeskPresentationTarget } from "@/lib/blue-desk-host";
import { allowR1MarketsReadOnlyPreview, allowR1LiveDeskReadOnlyPreview } from "@/lib/blue-desk-r1-preview-access";

function startsWithAny(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function loginRedirect(request: NextRequest, reason?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (reason) url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

function apiFailure(status: number, error: string) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

/**
 * Host-scoped read-only presentation rewriting. Public pages bypass interactive
 * login; owner-only routes reach this only after authorization.
 */
function presentationResponse(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.hostname;
  const target = blueDeskPresentationTarget(request.nextUrl.pathname, host);
  if (!target) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = target;
  return NextResponse.rewrite(destination);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") || request.nextUrl.hostname;
  const accessScope = blueDeskHostAccess(pathname, host);

  // Old root tab bookmarks must retain private operational context.
  if (pathname === "/"
      && (host || "").trim().toLowerCase().replace(/:443$/, "") === LIVE_DESK_PRESENTATION_HOST
      && request.nextUrl.searchParams.has("tab")) {
    const oldLive = request.nextUrl.clone();
    oldLive.pathname = "/owner/live";
    return NextResponse.redirect(oldLive);
  }

  // The public hostname must never expose legacy pages, internal APIs,
  // OAuth/owner paths or machine endpoints, even if dashboard auth is off.
  if (accessScope === "blocked") {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (accessScope === "public") return presentationResponse(request);

  // R1 design review is a single read-only HTML presentation page, available
  // without application login only behind Vercel's temporary protected-preview
  // share link. No production, other preview, API, owner, Newsroom or write path.
  if (allowR1MarketsReadOnlyPreview({
    environment: process.env.VERCEL_ENV,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    deploymentHostname: process.env.VERCEL_URL,
    requestedHostname: request.nextUrl.hostname,
    pathname,
    method: request.method,
  })) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  // The full Live Desk overview is reviewable without Google sign-in only
  // on the same expiring, Vercel-protected R1 preview. No extra owner routes
  // or APIs are admitted; mutation endpoints keep their own authorisation.
  if (allowR1LiveDeskReadOnlyPreview({
    environment: process.env.VERCEL_ENV,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    deploymentHostname: process.env.VERCEL_URL,
    requestedHostname: request.nextUrl.hostname,
    pathname,
    method: request.method,
  })) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  if (PRODUCTION_RESEARCH_AUTOMATION_PAUSED && pathname.startsWith("/api/cron/research/")) {
    return NextResponse.json(
      {
        status: "paused",
        detail: "Automated production research cron runs are temporarily paused.",
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Existing machine/cron handlers own token verification. Never redirect
  // these routes to an interactive Google login.
  if (startsWithAny(pathname, MACHINE_AUTH_PATHS) || pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }
  if (startsWithAny(pathname, PUBLIC_AUTH_PATHS)) return presentationResponse(request);

  // Preserve existing API consumers until every contract is scoped and audited.
  // Owner-facing pages are ALWAYS authenticated on non-public hosts.
  if (pathname.startsWith("/api/") && !dashboardAuthRequired()) return NextResponse.next();

  let config: ReturnType<typeof getSupabasePublicConfig>;
  try {
    config = getSupabasePublicConfig();
  } catch {
    return pathname.startsWith("/api/")
      ? apiFailure(503, "Dashboard authentication is not configured.")
      : loginRedirect(request, "configuration");
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headersToSet).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsError ? null : claimsData?.claims;

  if (!claims) {
    const failure = pathname.startsWith("/api/")
      ? apiFailure(401, "Authentication required.")
      : loginRedirect(request);
    return copyCookies(supabaseResponse, failure);
  }

  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) {
    const failure = pathname.startsWith("/api/")
      ? apiFailure(403, "The signed-in account has no usable email address.")
      : loginRedirect(request, "not_allowed");
    return copyCookies(supabaseResponse, failure);
  }

  const { data: access, error: accessError } = await supabase
    .from("app_access_allowlist")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (accessError || !access) {
    const failure = pathname.startsWith("/api/")
      ? apiFailure(403, "This Google account is not approved for the dashboard.")
      : loginRedirect(request, "not_allowed");
    return copyCookies(supabaseResponse, failure);
  }

  supabaseResponse.headers.set("Cache-Control", "private, no-store");
  const target = blueDeskPresentationTarget(request.nextUrl.pathname, request.headers.get("host") || request.nextUrl.hostname);
  if (!target) return supabaseResponse;
  // Preserve Supabase refreshed cookies and private cache-control on rewrites.
  const rewritten = presentationResponse(request);
  rewritten.headers.set("Cache-Control", "private, no-store");
  return copyCookies(supabaseResponse, rewritten);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
