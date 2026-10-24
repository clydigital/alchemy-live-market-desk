import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { blueDeskHostAccess } from "@/lib/blue-desk-host";
import {
  parseExactCanonicalStoryVersionSelection,
  projectBluebellyCanonicalStoryVersion,
  referencedEvidenceIds,
} from "@/lib/bluebelly-canonical-story-version";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };
function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * One exact immutable Story version; original canonical evidence admitted
 * separately by exact UUID, first-tier source and before-version timestamp.
 * Browser owner session only. This is NOT a remote OAuth/MCP connector.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.hostname;
  if (blueDeskHostAccess("/api/owner/bluebelly/v1/story-version", host) !== "private") {
    return fail(404, "Not found");
  }

  let session;
  try {
    session = await createSupabaseServerClient();
  } catch {
    return fail(503, "Owner authentication unavailable");
  }

  try {
    const { data: { user }, error: identityError } = await session.auth.getUser();
    if (identityError || !user?.email) return fail(401, "Owner sign-in required");
    const { data: access, error: accessError } = await session
      .from("app_access_allowlist")
      .select("email")
      .eq("email", user.email.trim().toLowerCase())
      .eq("active", true)
      .maybeSingle();
    if (accessError) return fail(503, "Owner authorisation unavailable");
    if (!access) return fail(403, "Owner account not authorised");
  } catch {
    return fail(503, "Owner identity could not be verified");
  }

  const stories = request.nextUrl.searchParams.getAll("story");
  const versions = request.nextUrl.searchParams.getAll("version");
  if (stories.length !== 1 || versions.length !== 1) {
    return fail(400, "One exact Story and version ID required");
  }
  const exact = parseExactCanonicalStoryVersionSelection(stories[0], versions[0]);
  if (!exact) return fail(400, "Invalid canonical Story version identity");

  try {
    const db = createSupabaseAdminClient();
    const { data: version, error: versionError } = await db
      .from("story_thesis_versions")
      .select("id,story_id,event_id,version_number,effective_at,title,market_question,thesis,status,confidence,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,snapshot")
      .eq("id", exact.versionId)
      .eq("story_id", exact.storyId)
      .limit(1)
      .abortSignal(AbortSignal.timeout(5_000))
      .maybeSingle();
    if (versionError) return fail(503, "Canonical Story version storage unavailable");
    if (!version) return fail(404, "Exact Story thesis version not found");

    const evidenceIds = referencedEvidenceIds(version);
    let evidence: unknown[] = [];
    if (evidenceIds.length) {
      const { data, error } = await db
        .from("intelligence_evidence")
        .select("id,claim_text,evidence_class,available_at,created_at,source:intelligence_evidence_sources(source_name,source_url,source_tier)")
        .in("id", evidenceIds)
        .limit(48)
        .abortSignal(AbortSignal.timeout(5_000));
      if (error) return fail(503, "Canonical evidence provenance unavailable");
      evidence = data || [];
    }

    const result = projectBluebellyCanonicalStoryVersion(version, evidence, exact);
    if (!result) return fail(503, "Invalid stored canonical Story version");
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  } catch {
    return fail(503, "Exact canonical Story version read unavailable");
  }
}
