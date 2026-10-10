import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { loadRegimeAssumptionObservationReport } from "@/lib/regime-assumption-observation-reader";
import { REGIME_ASSUMPTION_OBSERVATIONS_VERSION } from "@/lib/regime-assumption-observations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Separate, versioned observation-quality read. This cannot publish Story reasoning. */
export async function GET() {
  try {
    const selection = await getDossierV2PresentationSelection();
    if (!selection.selectedDossierId || !selection.selectedAsOf) {
      return Response.json({
        contractVersion: REGIME_ASSUMPTION_OBSERVATIONS_VERSION,
        status: "UNAVAILABLE",
        detail: "No selected canonical Dossier for dated quantitative interpretation.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const report = await loadRegimeAssumptionObservationReport(
      selection.selectedDossierId, selection.selectedAsOf,
    );
    if (!report) {
      return Response.json({
        contractVersion: REGIME_ASSUMPTION_OBSERVATIONS_VERSION,
        status: "UNAVAILABLE",
        detail: "Exact Dossier / metric source read did not validate.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(report, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never expose Supabase/provider errors or internal source URLs.
    return Response.json({
      contractVersion: REGIME_ASSUMPTION_OBSERVATIONS_VERSION,
      status: "UNAVAILABLE",
      detail: "Canonical metric status currently unavailable.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
