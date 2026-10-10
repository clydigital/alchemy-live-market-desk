import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { loadRegimeAssumptionObservationReport } from "@/lib/regime-assumption-observation-reader";
import { buildProvisionalRegimeWatchReport, REGIME_WATCH_ASSESSMENT_VERSION } from "@/lib/regime-provisional-watch-assessments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Read-only research-watch readiness; no LLM, Story writes or trigger probabilities. */
export async function GET() {
  try {
    const selection = await getDossierV2PresentationSelection();
    if (!selection.selectedDossierId || !selection.selectedAsOf) {
      return Response.json({
        contractVersion: REGIME_WATCH_ASSESSMENT_VERSION,
        status: "UNAVAILABLE",
        detail: "No exact validated Dossier is selected.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const report = await loadRegimeAssumptionObservationReport(
      selection.selectedDossierId,
      selection.selectedAsOf,
    );
    if (!report) {
      return Response.json({
        contractVersion: REGIME_WATCH_ASSESSMENT_VERSION,
        status: "UNAVAILABLE",
        detail: "Dated canonical measurements unavailable for the selected Dossier.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(buildProvisionalRegimeWatchReport(report), {
      status: 200, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({
      contractVersion: REGIME_WATCH_ASSESSMENT_VERSION,
      status: "UNAVAILABLE",
      detail: "Evidence-gated Regime watch is not currently verifiable.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
