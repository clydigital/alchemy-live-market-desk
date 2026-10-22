import { NextResponse } from "next/server";

import { OperationTimeoutError, withinTimeout } from "@/lib/async-timeout";

import { buildDailyAssetState } from "@/lib/daily-asset-state";
import {
  getDossierV2PresentationSelection,
  getDossierV2PresentationSelectionById,
  selectExactDossierV2Presentation,
} from "@/lib/dossier-v2/presentation-reader";
import { isValidUuid } from "@/lib/dossier-v2/validation";
import { recordLegacyReadCaller } from "@/lib/intelligence/publication-caller-telemetry";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getStockedUpEvidenceBrief } from "@/lib/stockedup-evidence-brief";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOSSIER_CORE_READ_TIMEOUT_MS = 5_000;
const DOSSIER_OPTIONAL_READ_TIMEOUT_MS = 1_800;

export async function GET(request: Request) {
  recordLegacyReadCaller(request, "/api/dossier-v2");
  const startedAt = Date.now();
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
            "Cache-Control": "private, no-store",
            "X-Alchemy-Dossier-Selection": "unavailable",
          },
        },
      );
    }

    // Core selection and optional enrichment are independent reads.
    // Running them concurrently prevents the optional 1.8s budget from
    // accumulating after the core 5s deadline on Hybrid's current path.
    // Explicit exact historical reads never request mutable optional data.
    const selectionRead = withinTimeout(
      "Dossier presentation",
      () => requestedId
        ? getDossierV2PresentationSelectionById(requestedId)
        : getDossierV2PresentationSelection(),
      DOSSIER_CORE_READ_TIMEOUT_MS,
    );
    const optionalReads = requestedId
      ? Promise.resolve([null, null] as const)
      : Promise.all([
          withinTimeout(
            "Dossier market monitor",
            getMarketMonitor,
            DOSSIER_OPTIONAL_READ_TIMEOUT_MS,
          ).catch((error: unknown) => {
            console.warn("[dossier-v2] optional market monitor read failed", {
              reason: error instanceof OperationTimeoutError ? "timeout" : "read_error",
            });
            return null;
          }),
          withinTimeout(
            "Dossier StockedUp evidence",
            getStockedUpEvidenceBrief,
            DOSSIER_OPTIONAL_READ_TIMEOUT_MS,
          ).catch((error: unknown) => {
            console.warn("[dossier-v2] optional StockedUp read failed", {
              reason: error instanceof OperationTimeoutError ? "timeout" : "read_error",
            });
            return null;
          }),
        ]);
    const [selection, [monitor, stockedUpEvidenceBrief]] = await Promise.all([
      selectionRead,
      optionalReads,
    ]);
    const dailyAssetState = monitor
      ? buildDailyAssetState({ monitor, presentation: selection.presentation })
      : null;

    return NextResponse.json({ ...selection, dailyAssetState, stockedUpEvidenceBrief }, {
      status: requestedId && !selection.presentation ? 404 : 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        // P−1a containment: do not cache unreviewed legacy Dossier fields.
        "Cache-Control": "private, no-store",
        "X-Alchemy-Dossier-Selection": selection.status,
        "X-Alchemy-Dossier-Read": "success",
        "Server-Timing": `dossier;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    const reason = error instanceof OperationTimeoutError ? "core_timeout" : "read_error";
    // This path previously swallowed every exception into HTTP 503, leaving
    // production error dashboards blank. Log only class/timing, never SQL,
    // request identifiers, keys or market evidence payloads.
    console.error("[dossier-v2] presentation unavailable", {
      reason,
      elapsedMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : typeof error,
    });
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
          detail: "Dossier V2 presentation is temporarily unavailable.",
        },
      },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "private, no-store",
          "X-Alchemy-Dossier-Selection": "unavailable",
          "X-Alchemy-Dossier-Read": reason,
          "Server-Timing": `dossier;dur=${Date.now() - startedAt}`,
        },
      },
    );
  }
}
