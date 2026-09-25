import { NextResponse } from "next/server";

import { buildDailyAssetState } from "@/lib/daily-asset-state";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { buildMarketIntelligenceSnapshot } from "@/lib/market-intelligence-snapshot";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { fetchNyFedPrimaryDealers } from "@/lib/providers/ny-fed-primary-dealers";
import { fetchNyFedReferenceRates } from "@/lib/providers/ny-fed-reference-rates";
import { getStockedUpEvidenceBrief } from "@/lib/stockedup-evidence-brief";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  try {
    const selection = await getDossierV2PresentationSelection();
    if (!selection.presentation) {
      return NextResponse.json({
        contractVersion: "market-intelligence-snapshot/v1",
        status: "unavailable",
        detail: selection.notice?.detail || "No current Dossier presentation is available.",
      }, {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Alchemy-Market-Intelligence": "unavailable",
        },
      });
    }

    const [monitor, nyFedReferenceRates, nyFedPrimaryDealers, creatorVerification] = await Promise.all([
      getMarketMonitor(),
      fetchNyFedReferenceRates(),
      fetchNyFedPrimaryDealers(),
      getStockedUpEvidenceBrief().catch(() => null),
    ]);
    const dailyAssetState = buildDailyAssetState({
      monitor,
      presentation: selection.presentation,
    });
    const snapshot = buildMarketIntelligenceSnapshot({
      status: selection.status,
      presentation: selection.presentation,
      monitor,
      nyFedReferenceRates,
      nyFedPrimaryDealers,
      dailyAssetState,
      creatorVerification,
    });

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        "X-Alchemy-Market-Intelligence": snapshot.contractVersion,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      contractVersion: "market-intelligence-snapshot/v1",
      status: "unavailable",
      detail: `Market intelligence snapshot failed: ${detail}`,
    }, {
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-Alchemy-Market-Intelligence": "unavailable",
      },
    });
  }
}
