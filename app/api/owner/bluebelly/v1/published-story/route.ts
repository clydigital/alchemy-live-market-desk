import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { blueDeskHostAccess } from "@/lib/blue-desk-host";
import {
  parseExactPublishedStorySelection,
  projectBluebellyPrivatePublishedStory,
} from "@/lib/bluebelly-private-published-story";
import { getHybridExactDailyBriefEdition } from "@/lib/hybrid-publication";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withinTimeout } from "@/lib/async-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };
function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * Owner-only, edition-pinned published *editorial* story read.
 * Remote ChatGPT OAuth is NOT implemented. This route does not serve raw
 * Dossier/Story versions, and never falls through to the latest publication.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.hostname;
  if (blueDeskHostAccess("/api/owner/bluebelly/v1/published-story", host) !== "private") {
    return fail(404, "Not found");
  }

  let client;
  try {
    client = await createSupabaseServerClient();
  } catch {
    return fail(503, "Owner authentication unavailable");
  }
  const { data: { user }, error: identityError } = await client.auth.getUser();
  if (identityError || !user?.email) return fail(401, "Owner sign-in required");

  const { data: access, error: accessError } = await client
    .from("app_access_allowlist")
    .select("email")
    .eq("email", user.email.trim().toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (accessError) return fail(503, "Owner authorisation unavailable");
  if (!access) return fail(403, "Owner account not authorised");

  const editions = request.nextUrl.searchParams.getAll("edition");
  const articles = request.nextUrl.searchParams.getAll("article");
  if (editions.length !== 1 || articles.length !== 1) {
    return fail(400, "One exact edition and article ID required");
  }
  const identity = parseExactPublishedStorySelection(editions[0], articles[0]);
  if (!identity) return fail(400, "Invalid edition or article identity");

  try {
    const frozen = await withinTimeout(
      "Bluebelly exact published edition",
      () => getHybridExactDailyBriefEdition(identity.editionId),
      5_000,
    );
    if (!frozen) return fail(404, "Published edition not found");
    if (frozen.id !== identity.editionId || frozen.snapshot_type !== "daily_brief") {
      return fail(404, "Published edition not found");
    }
    const brief = await withinTimeout(
      "Bluebelly editorial source admission",
      () => loadEditorialMarketBrief(projectMarketBriefArticles(frozen)),
      5_000,
    );
    const result = projectBluebellyPrivatePublishedStory(brief, identity.articleId);
    if (!result) return fail(404, "Source-linked article not available in this edition");
    return NextResponse.json(result, { headers: NO_STORE });
  } catch {
    // The archived publication and proof lookup must not silently use a newer
    // edition, synthesize missing evidence or leak upstream SQL/provider detail.
    return fail(503, "Published Story lookup temporarily unavailable");
  }
}
