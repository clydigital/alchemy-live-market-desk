import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { blueDeskHostAccess } from "@/lib/blue-desk-host";
import { projectBluebellyPrivateOverview } from "@/lib/bluebelly-private-overview";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withinTimeout } from "@/lib/async-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };
function denied(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * Owner-session reader for validating the first Bluebelly tool contract.
 * This is not yet a remote ChatGPT plugin/OAuth endpoint. It must not accept
 * an arbitrary bearer token or grant ChatGPT the Supabase service-role key.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.hostname;
  if (blueDeskHostAccess("/api/owner/bluebelly/v1/overview", host) !== "private") {
    return denied(404, "Not found");
  }

  let client;
  try {
    client = await createSupabaseServerClient();
  } catch {
    return denied(503, "Owner authentication unavailable");
  }

  const { data: { user }, error: identityError } = await client.auth.getUser();
  if (identityError || !user?.email) return denied(401, "Owner sign-in required");

  const { data: access, error: accessError } = await client
    .from("app_access_allowlist")
    .select("email")
    .eq("email", user.email.trim().toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (accessError) return denied(503, "Owner authorisation unavailable");
  if (!access) return denied(403, "Owner account not authorised");

  try {
    const selection = await withinTimeout(
      "Bluebelly private overview",
      () => getDossierV2PresentationSelection(),
      5_000,
    );
    const overview = projectBluebellyPrivateOverview(selection);
    return NextResponse.json(overview, {
      status: overview.availability === "AVAILABLE" ? 200 : 503,
      headers: NO_STORE,
    });
  } catch {
    return denied(503, "Canonical Dossier currently unavailable");
  }
}
