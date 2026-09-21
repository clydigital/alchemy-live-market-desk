import { NextResponse } from "next/server";

import { getDossierV2HistoryIndex } from "@/lib/dossier-v2/presentation-reader";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") || "24");
    const limit = Number.isFinite(rawLimit) ? rawLimit : 24;
    const history = await getDossierV2HistoryIndex(limit);

    return NextResponse.json(history, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        contractVersion: "dossier-history/1",
        items: [],
        omittedInvalidCount: 0,
        error: detail,
      },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
