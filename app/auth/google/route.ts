import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeOwnerReturnPath } from "@/lib/supabase/owner-return-path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawNext = requestUrl.searchParams.get("next") || "/";
  const next = safeOwnerReturnPath(rawNext);
  const callbackUrl = new URL("/auth/callback", requestUrl.origin);
  callbackUrl.searchParams.set("next", next);

  try {
    const supabase = await createSupabaseServerClient();
    // Direct /auth/google visits should also reuse an approved existing
    // Bluebelly session, not start another unnecessary Google sign-in roundtrip.
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const email = typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email.trim().toLowerCase() : "";
    if (!claimsError && email) {
      const { data: approved, error: accessError } = await supabase
        .from("app_access_allowlist")
        .select("email")
        .eq("email", email)
        .eq("active", true)
        .maybeSingle();
      if (!accessError && approved) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
    }

    // Do not force Google's account picker on every visit. The provider may
    // still request consent/account selection on first use or expired sessions.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error || !data.url) {
      const login = new URL("/login", requestUrl.origin);
      login.searchParams.set("error", "provider");
      login.searchParams.set("next", next);
      return NextResponse.redirect(login);
    }

    return NextResponse.redirect(data.url);
  } catch {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "configuration");
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
}
