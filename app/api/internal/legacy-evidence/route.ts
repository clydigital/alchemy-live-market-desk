import { NextResponse } from "next/server";
import { acceptsLegacyEvidenceRead, legacyEvidenceReadConfigured } from "@/lib/blue-desk-legacy-evidence-auth";
import { getLegacyOwnerEvidenceRows } from "@/lib/blue-desk-legacy-evidence-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Vary": "Authorization",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

/** Owner-only legacy Evidence support: never use for public Bluebelly or canonical Story state. */
export async function GET(request: Request): Promise<Response> {
  const token = process.env.LIVE_HYBRID_LEGACY_EVIDENCE_READ_TOKEN;
  if (!legacyEvidenceReadConfigured(token)) {
    return NextResponse.json({ error: "Private Evidence reader unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
  }
  if (!acceptsLegacyEvidenceRead(request.headers.get("authorization"), token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: PRIVATE_HEADERS });
  }
  try {
    const evidence = await getLegacyOwnerEvidenceRows();
    return NextResponse.json(evidence, { status: 200, headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Private Evidence source unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
