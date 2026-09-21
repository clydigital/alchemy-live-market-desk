import { NextResponse } from "next/server";

import {
  getDossierV2PresentationSelection,
  getDossierV2PresentationSelectionById,
} from "@/lib/dossier-v2/presentation-reader";
import { isValidUuid } from "@/lib/dossier-v2/validation";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(request: Request) {
  try {
    const requestedId = new URL(request.url).searchParams.get("id")?.trim() || null;

    if (requestedId && !isValidUuid(requestedId)) {
      return NextResponse.json(
        {
          status: "unavailable",
          requestedDossierId: requestedId,
          presentation: null,
          latestDossierId: null,
          selectedDossierId: null,
          latestAsOf: null,
          selectedAsOf: null,
          usingFallback: false,
          notice: {
            tone: "error",
            label: "Invalid Dossier ID",
            detail: "Historical Dossier replay requires a valid UUID.",
          },
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
            "X-Alchemy-Dossier-Selection": "unavailable",
          },
        },
      );
    }

    const selection = requestedId
      ? await getDossierV2PresentationSelectionById(requestedId)
      : await getDossierV2PresentationSelection();

    return NextResponse.json(selection, {
      status: requestedId && !selection.presentation ? 404 : 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": requestedId
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "public, s-maxage=30, stale-while-revalidate=120",
        "X-Alchemy-Dossier-Selection": selection.status,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "unavailable",
        presentation: null,
        latestDossierId: null,
        selectedDossierId: null,
        latestAsOf: null,
        selectedAsOf: null,
        usingFallback: false,
        notice: {
          tone: "error",
          label: "Dossier unavailable",
          detail: `Dossier V2 presentation read failed: ${detail}`,
        },
      },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Alchemy-Dossier-Selection": "unavailable",
        },
      },
    );
  }
}
