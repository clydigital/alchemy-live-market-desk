import { NextResponse } from "next/server";

import { buildDailyAssetState } from "@/lib/daily-asset-state";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { buildCanonicalEditionIndex } from "@/lib/edition-replay";
import { getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import {
  buildMarketIntelligenceSnapshot,
  unavailableSnapshotResponseBody,
} from "@/lib/market-intelligence-snapshot";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { marketMotionFromEditionPayload } from "@/lib/market-motion-edition";
import { fetchNyFedPrimaryDealers } from "@/lib/providers/ny-fed-primary-dealers";
import { fetchNyFedReferenceRates } from "@/lib/providers/ny-fed-reference-rates";
import { fetchTreasuryBills } from "@/lib/providers/treasury-bills";
import { getStockedUpEvidenceBrief } from "@/lib/stockedup-evidence-brief";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  try {
    const selection = await getDossierV2PresentationSelection();
    if (!selection.presentation) {
      if (selection.notice?.detail) {
        console.error("Market intelligence snapshot unavailable notice:", selection.notice.detail);
      }
      return NextResponse.json(unavailableSnapshotResponseBody(), {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Alchemy-Market-Intelligence": "unavailable",
        },
      });
    }

    const [monitor, nyFedReferenceRates, nyFedPrimaryDealers, treasuryBills, creatorVerification, presenterEditions] = await Promise.all([
      getMarketMonitor(),
      fetchNyFedReferenceRates(),
      fetchNyFedPrimaryDealers(),
      fetchTreasuryBills(),
      getStockedUpEvidenceBrief().catch(() => null),
      getHybridPresenterEditionCandidates(),
    ]);
    const currentEditionPointer = buildCanonicalEditionIndex(presenterEditions)[0] || null;
    const currentEdition = currentEditionPointer
      ? presenterEditions.find((item) => item.id === currentEditionPointer.snapshotId) || null
      : null;
    const frozenMarketMotion = marketMotionFromEditionPayload(currentEdition?.payload);
    const marketMotion = frozenMarketMotion && currentEdition
      ? { ...frozenMarketMotion, editionId: currentEdition.id }
      : null;
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
      treasuryBills,
      dailyAssetState,
      creatorVerification,
      marketMotion,
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
    console.error("Market intelligence snapshot failed:", detail);
    return NextResponse.json(unavailableSnapshotResponseBody(), {
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-Alchemy-Market-Intelligence": "unavailable",
      },
    });
  }
}
