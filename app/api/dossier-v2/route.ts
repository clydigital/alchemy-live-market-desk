import { NextResponse } from "next/server";

import { buildDailyAssetState } from "@/lib/daily-asset-state";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { getMarketMonitor } from "@/lib/market-monitor-public";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  try {
    const selection = await getDossierV2PresentationSelection();
    const monitor = await getMarketMonitor().catch(() => null);
    const dailyAssetState = monitor
      ? buildDailyAssetState({ monitor, presentation: selection.presentation })
      : null;

    return NextResponse.json({ ...selection, dailyAssetState }, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
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
