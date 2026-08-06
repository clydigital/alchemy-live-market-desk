import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  MACHINE_AUTH_PATHS,
  PUBLIC_AUTH_PATHS,
  dashboardAuthRequired,
  getSupabasePublicConfig,
} from "@/lib/supabase/config";

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
  url.searchParams.set("next", request.nextUrl.pathname);
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

export async function middleware(request: NextRequest) {
  if (!dashboardAuthRequired()) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (startsWithAny(pathname, MACHINE_AUTH_PATHS)) return NextResponse.next();
  if (startsWithAny(pathname, PUBLIC_AUTH_PATHS)) return NextResponse.next();

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
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
