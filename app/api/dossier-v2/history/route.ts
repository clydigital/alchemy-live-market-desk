import { NextResponse } from "next/server";

import { getDossierV2HistoryIndex } from "@/lib/dossier-v2/presentation-reader";
import { recordLegacyReadCaller } from "@/lib/intelligence/publication-caller-telemetry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  recordLegacyReadCaller(request, "/api/dossier-v2/history");
  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "24");
    const limit = Number.isFinite(rawLimit) ? rawLimit : 24;
    const history = await getDossierV2HistoryIndex(limit);

    return NextResponse.json(history, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        contractVersion: "dossier-history/1",
        items: [],
        omittedInvalidCount: 0,
        error: "Dossier history temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
