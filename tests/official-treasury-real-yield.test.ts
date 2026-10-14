import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidateSnapshotFromCanonicalEvidence,
  type CanonicalEvidenceRow,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import { buildDossierRateRegime } from "../lib/dossier-v2/rate-regime.ts";

const AS_OF = "2026-10-14T07:49:42.014Z";
const UUID = "b31411f6-89e9-459e-8a4d-3bba535d4b7c";
const TREASURY_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_real_yield_curve";

function officialRow(): CanonicalEvidenceRow {
  return {
    id: UUID,
    external_evidence_id: "verified-macro:ust-10y-real-cmt-2026-10-13",
    claim_text: "Official Treasury 10-year real constant-maturity yield was 2.88% on October 13.",
    evidence_class: "other",
    event_at: "2026-10-13T19:30:00Z",
    published_at: "2026-10-13T19:30:00Z",
    available_at: "2026-10-14T03:43:23.376Z",
    freshness_status: "current",
    affected_assets: ["US10Y", "TIPS10Y"],
    affected_topics: ["us-rates", "real-yields"],
    measurement_unit: "percent_real_yield",
    observed_value: 2.88,
    provenance_urls: [TREASURY_URL],
    structured_payload: {
      evidenceNature: "verified_macro_data",
      signalKind: "market_reaction",
      signalContext: "OFFICIAL_TIPS_REAL_CURVE",
    },
    source: {
      id: "5a871e21-5798-4bc4-923f-da75c396595c",
      source_name: "US Treasury Daily Par Real Yield Curve",
      source_type: "data_provider",
      source_url: TREASURY_URL,
      source_tier: 1,
      reliability_score: 95,
    },
  };
}

function packetFrom(rows: CanonicalEvidenceRow[]) {
  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, { asOf: AS_OF, lookbackHours: 168 });
  return assembleDossierV2InputPacket({ as_of: AS_OF }, result.snapshot);
}

test("official 10Y real yield preserves canonical UUID across snapshot and both rate lenses", () => {
  const packet = packetFrom([officialRow()]);
  const rateEvidence = packet.rate_context?.evidence.find((item) => item.evidence_id === UUID);
  assert.ok(rateEvidence, "exact canonical evidence must survive packet construction");
  assert.equal(rateEvidence.canonical_record_backed, true);
  assert.equal(rateEvidence.metrics?.observed_value, 2.88);

  const regime = buildDossierRateRegime(packet, []);
  const real = regime.signals.find((signal) => signal.key === "REAL_YIELDS");
  assert.equal(real?.state, "HAWKISH");
  assert.match(real?.detail ?? "", /2\\.88%/);
  assert.deepEqual(real?.evidenceRefs, [UUID]);
  assert.equal(regime.longEndDiagnostic.real10y.levelPct, 2.88);
  assert.equal(regime.longEndDiagnostic.real10y.evidenceRef, UUID);
  assert.equal(regime.longEndDiagnostic.real10y.change5dBp, null, "do not infer 5D move from two listed dates");
  assert.ok(!regime.coverage.missing.includes("US 10Y real yield"));
});

test("Treasury real-yield admission fails closed for wrong units, tenor, source, stale and future observations", () => {
  const variants: Array<{ name: string; row: CanonicalEvidenceRow }> = [
    { name: "wrong measurement unit", row: { ...officialRow(), measurement_unit: "percent_yield" } },
    { name: "wrong tenor", row: { ...officialRow(), affected_assets: ["TIPS5Y"] } },
    { name: "unverified website", row: {
      ...officialRow(),
      provenance_urls: ["https://example.com/yields"],
      source: { id: "fake", source_name: "Mirror", source_type: "data_provider", source_url: "https://example.com/yields" },
    } },
    { name: "stale reading", row: {
      ...officialRow(), event_at: "2026-10-08T19:30:00Z", available_at: "2026-10-09T03:43:23Z",
    } },
    { name: "future arrival", row: { ...officialRow(), available_at: "2026-10-15T03:43:23Z" } },
  ];

  for (const { name, row } of variants) {
    const packet = packetFrom([row]);
    const rate = buildDossierRateRegime(packet, []);
    assert.equal(rate.longEndDiagnostic.real10y.levelPct, null, name);
    assert.equal(rate.longEndDiagnostic.real10y.evidenceRef, null, name);
    assert.ok(rate.coverage.missing.includes("US 10Y real yield"), name);
  }
});

test("a newer dated monitor beats an older official TIPS observation without claiming canonical UUID", () => {
  const packet = packetFrom([officialRow()]);
  packet.rate_context?.evidence.push({
    evidence_id: "market-monitor:us10y-real:2026-10-14",
    epistemic_label: "OBSERVED",
    claim_or_fact: "Later FRED 10Y real-yield observation was 2.91%.",
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: "2026-10-14T06:00:00Z",
    occurrence_time: "2026-10-14T00:00:00Z",
    metrics: { last: 2.91, change_5d_pct: null },
    provenance: [{ source_type: "FRED", source_id: "market-monitor:us10y-real" }],
  });
  const rate = buildDossierRateRegime(packet, []);
  assert.equal(rate.longEndDiagnostic.real10y.levelPct, 2.91);
  assert.equal(rate.longEndDiagnostic.real10y.evidenceRef, "market-monitor:us10y-real:2026-10-14");
  assert.equal(rate.longEndDiagnostic.real10y.change5dBp, null);
});
