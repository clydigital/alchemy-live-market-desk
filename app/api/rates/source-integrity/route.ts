import { NextResponse } from "next/server";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { fetchNyFedPrimaryDealers } from "@/lib/providers/ny-fed-primary-dealers";
import { assessRatesSourceIntegrity } from "@/lib/rates-source-integrity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Read-only operations contract. Never persists a Dossier or promotes a Story. */
export async function GET() {
  try {
    const [selection, monitor, dealer] = await Promise.all([
      getDossierV2PresentationSelection(), getMarketMonitor(), fetchNyFedPrimaryDealers(),
    ]);
    const p = selection.presentation;
    if (!p) return NextResponse.json({
      contractVersion: "rates-source-integrity/1", operationalStatus: "ACTION_REQUIRED",
      alerts: [{ code: "DOSSIER_UNAVAILABLE", severity: "ACTION_REQUIRED", detail: "No validated current Dossier presentation exists." }],
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const result = assessRatesSourceIntegrity({
      asOf: new Date().toISOString(), dossierId: p.dossierId, dossierAsOf: p.asOf,
      dossierCurveEvidenceRefs: p.rateRegime.curve?.evidenceRefs ?? [],
      dossierCoveragePresent: p.rateRegime.coverage?.present ?? null,
      monitorRows: monitor.rows,
      dealer: { status: dealer.status, asOf: dealer.asOf, sourceUrl: dealer.sourceUrl, warnings: dealer.warnings },
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Rates source integrity unavailable: dependency failure.");
    return NextResponse.json({
      contractVersion: "rates-source-integrity/1", operationalStatus: "ACTION_REQUIRED",
      alerts: [{ code: "SOURCE_INTEGRITY_CHECK_FAILED", severity: "ACTION_REQUIRED", detail: "Source-integrity dependencies could not be evaluated." }],
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
