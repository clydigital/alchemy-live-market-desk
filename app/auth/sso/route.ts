import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_HYBRID_ORIGINS = [
  "https://alchemy-hybrid-market-desk.vercel.app",
  "https://alchemy-hybrid-market-desk-rogue-magazine.vercel.app",
  "https://alchemy-hybrid-market-desk-git-main-rogue-magazine.vercel.app",
];

function allowedHybridOrigins() {
  const configured = process.env.HYBRID_DESK_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_HYBRID_ORIGINS);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function loginRedirect(requestUrl: URL) {
  const login = new URL("/auth/google", requestUrl.origin);
  login.searchParams.set("next", `${requestUrl.pathname}${requestUrl.search}`);
  return NextResponse.redirect(login);
}

function failure(requestUrl: URL, message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawReturnTo = requestUrl.searchParams.get("return_to");
  const state = requestUrl.searchParams.get("state") || "";
  const verifierChallenge = requestUrl.searchParams.get("challenge") || "";

  if (!rawReturnTo || state.length < 20 || verifierChallenge.length !== 64) {
    return failure(requestUrl, "Invalid cross-desk SSO request.");
  }

  let returnTo: URL;
  try {
    returnTo = new URL(rawReturnTo);
  } catch {
    return failure(requestUrl, "The SSO return URL is invalid.");
  }

  if (
    !allowedHybridOrigins().has(returnTo.origin)
    || returnTo.pathname !== "/auth/sso/callback"
  ) {
    return failure(requestUrl, "The SSO return destination is not approved.", 403);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email?.trim().toLowerCase();
    if (userError || !email) return loginRedirect(requestUrl);

    const { data: access, error: accessError } = await supabase
      .from("app_access_allowlist")
      .select("email")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();
    if (accessError || !access) return failure(requestUrl, "This account is not approved.", 403);

    const admin = createSupabaseAdminClient();
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw linkError || new Error("Supabase did not return an SSO token hash.");
    }

    const code = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 90_000).toISOString();
    const { error: ticketError } = await admin.from("app_sso_tickets").insert({
      code_hash: sha256(code),
      verifier_challenge: verifierChallenge,
      redirect_uri: returnTo.toString(),
      token_hash: tokenHash,
      email,
      expires_at: expiresAt,
    });
    if (ticketError) throw ticketError;

    returnTo.searchParams.set("code", code);
    returnTo.searchParams.set("state", state);
    return NextResponse.redirect(returnTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cross-desk SSO failed.";
    return failure(requestUrl, message, 500);
  }
}
