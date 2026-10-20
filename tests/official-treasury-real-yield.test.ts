import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidateSnapshotFromCanonicalEvidence,
  type CanonicalEvidenceRow,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import { buildDossierRateRegime } from "../lib/dossier-v2/rate-regime.ts";
import { handleVerifiedMacroSignalsWithDependencies } from "../lib/dossier-v2/verified-macro-signals.ts";

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
  assert.ok(real?.detail.includes("2.88%"));
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


const OFFICIAL_DAILY_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve&field_tdr_date_value=2026&field_tdr_date_value_month=202610";
const dailySignal = {
  key: "ust-10y-real-daily-20261014",
  kind: "official_daily_observation",
  observationDate: "2026-10-14",
  signalContext: "OFFICIAL_TIPS_REAL_CURVE",
  sourceName: "US Treasury Daily Par Real Yield Curve (October 2026)",
  sourceUrl: OFFICIAL_DAILY_URL,
  sourceRole: "primary_data",
  claim: "Official Treasury 10-year par real yield on 14 Oct 2026 was 2.84%, compared with 2.88% on 13 Oct (4bp lower). This date-only daily observation is not a CPI 08:30 ET reaction measurement.",
  eventAt: "2026-10-14T00:00:00Z",
  unit: "percent_real_yield",
  observedValue: 2.84,
  previousValue: 2.88,
  value: { observationDate: "2026-10-14", frequency: "daily", timePrecision: "DATE_ONLY", tenor: "10Y", instrument: "UST TIPS par real yield", periodChangeBp: -4 },
  affectedAssets: ["US10Y", "TIPS10Y"],
  affectedTopics: ["us-rates", "real-yields"],
};

function makeDailyRequest(signals: unknown[]) {
  return new Request("https://example.com/api/admin/dossier-v2/verified-macro-signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signals }),
  });
}
const officialAuth = async () => ({
  authorized: true as const,
  actor: "test-operator",
  githubRunId: "4242",
  workflowSha: "abc",
});

test("date-only Treasury signal uses existing verified intake but never claims intraday CPI reaction", async () => {
  const seen: Array<{ signal: Record<string, unknown>, availableAt: string }> = [];
  const now = new Date("2026-10-21T00:45:00.000Z");
  const r = await handleVerifiedMacroSignalsWithDependencies(makeDailyRequest([dailySignal]), {
    authorize: officialAuth,
    now: () => now,
    persistSignal: async (signal, availableAt) => {
      seen.push({ signal: signal as unknown as Record<string, unknown>, availableAt });
      return { evidenceId: UUID, observationId: "18f0d4d8-ccac-40b0-8b10-a79884ea38a1" };
    },
  });
  assert.equal(r.status, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].signal.kind, "official_daily_observation");
  assert.equal(seen[0].signal.observationDate, "2026-10-14");
  assert.equal(seen[0].signal.eventAt, "2026-10-14T00:00:00.000Z");
  assert.equal(seen[0].signal.expectedValue, null);
  assert.equal(seen[0].availableAt, now.toISOString(),
    "An old daily value cannot be given a backdated receipt or a price-reaction time.");
});

test("Treasury day-only route rejects timestamp, original-source, precision and consensus forgery", async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["missing observation date", { ...dailySignal, observationDate: null }],
    ["invented intraday time", { ...dailySignal, eventAt: "2026-10-14T12:30:00Z" }],
    ["mismatched day", { ...dailySignal, observationDate: "2026-10-13" }],
    ["non-Treasury mirror", { ...dailySignal, sourceUrl: "https://example.org/curves/ust" }],
    ["different Treasury document", { ...dailySignal, sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/Other" }],
    ["wrong Treasury curve", { ...dailySignal, sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve" }],
    ["untrusted source role", { ...dailySignal, sourceRole: "wire" }],
    ["wrong measurement unit", { ...dailySignal, unit: "percent" }],
    ["wrong tenor", { ...dailySignal, affectedAssets: ["US10Y"] }],
    ["fake forecast", { ...dailySignal, expectedValue: 2.90 }],
  ];
  for (const [name, value] of cases) {
    let writes = 0;
    const r = await handleVerifiedMacroSignalsWithDependencies(makeDailyRequest([value]), {
      authorize: officialAuth,
      now: () => new Date("2026-10-21T00:45:00Z"),
      persistSignal: async () => {
        writes += 1;
        return { evidenceId: "evidence-unexpected", observationId: "observation-unexpected" };
      },
    });
    assert.equal(r.status, 400, name);
    assert.equal(writes, 0, name);
  }
});

test("dated TIPS evidence remains in the rate-context packet but cannot masquerade as a fresh rate level", () => {
  const asOf = "2026-10-20T16:00:00Z";
  const row: CanonicalEvidenceRow = {
    ...officialRow(),
    id: "84695d51-f2d3-4641-aa25-bfeb465d2c2a",
    external_evidence_id: "verified-macro:ust-10y-real-daily-20261014",
    claim_text: dailySignal.claim,
    event_at: "2026-10-14T00:00:00Z",
    published_at: "2026-10-20T15:37:00Z",
    available_at: "2026-10-20T15:37:00Z",
    measurement_unit: "percent_real_yield",
    observed_value: 2.84,
    structured_payload: {
      evidenceNature: "verified_macro_data",
      signalKind: "official_daily_observation",
      signalContext: "OFFICIAL_TIPS_REAL_CURVE",
      temporalPrecision: "DATE_ONLY",
      observationDate: "2026-10-14",
      intradayReactionAdmissible: false,
    },
    provenance_urls: [OFFICIAL_DAILY_URL],
    source: { ...officialRow().source!, source_name: "US Treasury Daily Par Real Yield Curve (October 2026)", source_url: OFFICIAL_DAILY_URL },
  };
  const snapshot = buildCandidateSnapshotFromCanonicalEvidence([row], { asOf, lookbackHours: 168 });
  const packet = assembleDossierV2InputPacket({ as_of: asOf }, snapshot.snapshot);
  const rateItem = packet.rate_context?.evidence.find(item => item.evidence_id === row.id);
  assert.ok(rateItem, "Neutral dated yields must reach canonical rate-context without becoming market_reaction");
  assert.equal(rateItem?.metrics?.signal_kind, "official_daily_observation");
  const regime = buildDossierRateRegime(packet, []);
  assert.equal(regime.longEndDiagnostic.real10y.levelPct, null,
    "A six-day-old observation cannot be current real-yield market level");
  assert.equal(regime.longEndDiagnostic.real10y.evidenceRef, null);
});
