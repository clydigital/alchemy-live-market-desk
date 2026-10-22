import { NextResponse } from "next/server";

import { acceptsHybridDossierRead, hybridDossierReadConfigured } from "@/lib/blue-desk-private-dossier-auth";
import { GET as readExistingDossierV2 } from "@/app/api/dossier-v2/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Vary": "Authorization",
};

export async function GET(request: Request): Promise<Response> {
  const token = process.env.LIVE_HYBRID_DOSSIER_READ_TOKEN;
  if (!hybridDossierReadConfigured(token)) {
    // Unprovisioned deployments must never serve raw Dossier data.
    return NextResponse.json({ error: "Private Dossier transport unavailable." }, {
      status: 503, headers: PRIVATE_HEADERS,
    });
  }
  if (!acceptsHybridDossierRead(request.headers.get("authorization"), token)) {
    return NextResponse.json({ error: "Unauthorized." }, {
      status: 401, headers: PRIVATE_HEADERS,
    });
  }

  // Preserve the precise legacy Dossier selection, HTTP status and JSON
  // contract without opening a second reasoning/read implementation.
  const legacy = await readExistingDossierV2(request);
  const headers = new Headers(legacy.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Authorization");
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Credentials");
  return new Response(legacy.body, { status: legacy.status, headers });
}
