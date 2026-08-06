import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "callback");
    return NextResponse.redirect(login);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email?.trim().toLowerCase();
    if (userError || !email) throw userError || new Error("Google account returned no email address.");

    const { data: access, error: accessError } = await supabase
      .from("app_access_allowlist")
      .select("email")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();

    if (accessError || !access) {
      await supabase.auth.signOut();
      const login = new URL("/login", requestUrl.origin);
      login.searchParams.set("error", "not_allowed");
      return NextResponse.redirect(login);
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "callback");
    return NextResponse.redirect(login);
  }
}
