import { NextResponse } from "next/server";

import { acceptsCanonicalFeedRead, canonicalFeedReadConfigured } from "@/lib/blue-desk-private-feed-auth";
import { getCanonicalPublicationResponseWithDeskRead } from "@/lib/intelligence/desk-read-publication-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Vary": "Authorization",
};

export async function GET(request: Request): Promise<Response> {
  const token = process.env.LIVE_HYBRID_CANONICAL_FEED_READ_TOKEN;
  if (!canonicalFeedReadConfigured(token)) {
    return NextResponse.json({ error: "Private canonical feed unavailable." }, {
      status: 503, headers: PRIVATE_HEADERS,
    });
  }
  if (!acceptsCanonicalFeedRead(request.headers.get("authorization"), token)) {
    return NextResponse.json({ error: "Unauthorized." }, {
      status: 401, headers: PRIVATE_HEADERS,
    });
  }

  // The immutable edition selection must reach the SAME existing publisher;
  // no new Story, edition, reasoning model or database writer is introduced.
  const edition = new URL(request.url).searchParams.get("edition");
  if (edition !== null && edition.length > 256) {
    return NextResponse.json({ error: "Invalid edition." }, {
      status: 400, headers: PRIVATE_HEADERS,
    });
  }

  try {
    const published = await getCanonicalPublicationResponseWithDeskRead(edition);
    const headers = new Headers(published.headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("Vary", "Authorization");
    headers.delete("Access-Control-Allow-Origin");
    headers.delete("Access-Control-Allow-Credentials");
    headers.delete("Content-Length");
    return new Response(published.body, { status: published.status, headers });
  } catch {
    // No raw errors, SQL, Dossier IDs, evidence or URLs in public responses.
    return NextResponse.json({ error: "Canonical feed temporarily unavailable." }, {
      status: 503, headers: PRIVATE_HEADERS,
    });
  }
}
