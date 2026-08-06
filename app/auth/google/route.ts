import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawNext = requestUrl.searchParams.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const callbackUrl = new URL("/auth/callback", requestUrl.origin);
  callbackUrl.searchParams.set("next", next);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
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
