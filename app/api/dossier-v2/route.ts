import { NextResponse } from "next/server";

import { buildDailyAssetState } from "@/lib/daily-asset-state";
import {
  getDossierV2PresentationSelection,
  getDossierV2PresentationSelectionById,
  selectExactDossierV2Presentation,
} from "@/lib/dossier-v2/presentation-reader";
import { isValidUuid } from "@/lib/dossier-v2/validation";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getStockedUpEvidenceBrief } from "@/lib/stockedup-evidence-brief";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(request: Request) {
  try {
    const requestedId = new URL(request.url).searchParams.get("id")?.trim() || null;
    if (requestedId && !isValidUuid(requestedId)) {
      const selection = selectExactDossierV2Presentation(null, null, requestedId);
      return NextResponse.json(
        { ...selection, dailyAssetState: null, stockedUpEvidenceBrief: null },
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
    const historical = selection.status === "historical_exact";
    const [monitor, stockedUpEvidenceBrief] = historical
      ? [null, null]
      : await Promise.all([
          getMarketMonitor().catch(() => null),
          getStockedUpEvidenceBrief().catch(() => null),
        ]);
    const dailyAssetState = monitor
      ? buildDailyAssetState({ monitor, presentation: selection.presentation })
      : null;

    return NextResponse.json({ ...selection, dailyAssetState, stockedUpEvidenceBrief }, {
      status: requestedId && !selection.presentation ? 404 : 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": historical
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
        dailyAssetState: null,
        stockedUpEvidenceBrief: null,
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
