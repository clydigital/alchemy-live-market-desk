import assert from "node:assert/strict";
import test from "node:test";

import { buildCandidateSnapshotFromCanonicalEvidence } from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import { buildDossierPolicyOutlook } from "../lib/dossier-v2/policy-outlook.ts";
import { handleVerifiedMacroSignalsWithDependencies } from "../lib/dossier-v2/verified-macro-signals.ts";

test("generic FedWatch rate-pricing context completes a rule-specific policy check", () => {
  const asOf = "2026-09-24T01:00:00.000Z";
  const rows = [
    {
      id: "row-pmi",
      external_evidence_id: "verified-macro:us-flash-pmi",
      claim_text: "US Flash Manufacturing PMI was 57.0, above the 53.6 expected reading.",
      evidence_class: "other",
      event_at: "2026-09-23T13:45:00.000Z",
      available_at: "2026-09-23T13:46:00.000Z",
      received_at: "2026-09-23T13:46:00.000Z",
      freshness_status: "current",
      affected_topics: ["US_ACTIVITY"],
      structured_payload: {
        evidenceNature: "verified_macro_data",
        signalKind: "economic_release",
        signalContext: "STRONG_ACTIVITY_SURPRISE",
      },
      measurement_unit: "index",
      observed_value: 57,
      expected_value: 53.6,
      previous_value: 53.9,
      source: {
        id: "source-pmi",
        source_name: "PMI Source",
        source_type: "data_provider",
        source_url: "https://example.com/pmi",
        source_tier: 1,
        reliability_score: 95,
        provider_key: "verified_macro_signal",
      },
    },
    {
      id: "row-fedwatch",
      external_evidence_id: "verified-macro:fedwatch-oct",
      claim_text: "Fed-funds futures showed a 71.2% probability of the higher target range, up from 55.1% the prior day.",
      evidence_class: "other",
      event_at: "2026-09-24T00:15:00.000Z",
      available_at: "2026-09-24T00:15:00.000Z",
      received_at: "2026-09-24T00:15:00.000Z",
      freshness_status: "current",
      affected_topics: ["rates"],
      structured_payload: {
        evidenceNature: "verified_macro_data",
        signalKind: "rate_expectation",
        signalContext: "fedwatch",
      },
      measurement_unit: "percent",
      observed_value: 71.2,
      previous_value: 55.1,
      source: {
        id: "source-fedwatch",
        source_name: "Fed Rate Monitor",
        source_type: "market_report",
        source_url: "https://example.com/fedwatch",
        source_tier: 3,
        reliability_score: 80,
        provider_key: "verified_macro_signal",
      },
    },
    {
      id: "row-reaction",
      external_evidence_id: "verified-macro:pmi-reaction",
      claim_text: "US 2Y and 10Y yields rose after the PMI release.",
      evidence_class: "other",
      event_at: "2026-09-23T14:07:00.000Z",
      available_at: "2026-09-23T14:08:00.000Z",
      received_at: "2026-09-23T14:08:00.000Z",
      freshness_status: "current",
      affected_topics: ["rates"],
      structured_payload: {
        evidenceNature: "verified_macro_data",
        signalKind: "market_reaction",
        signalContext: "STRONG_ACTIVITY_SURPRISE",
      },
      source: {
        id: "source-reaction",
        source_name: "Reaction Source",
        source_type: "market_report",
        source_url: "https://example.com/reaction",
        source_tier: 2,
        reliability_score: 90,
        provider_key: "verified_macro_signal",
      },
    },
  ];

  const snapshot = buildCandidateSnapshotFromCanonicalEvidence(rows, { asOf, lookbackHours: 24 });
  const packet = assembleDossierV2InputPacket({ as_of: asOf }, snapshot.snapshot);
  const outlook = buildDossierPolicyOutlook(packet);

  assert.equal(outlook.length, 1);
  assert.equal(outlook[0]?.observedRatePricingEvidenceRef, "verified-macro:fedwatch-oct");
  assert.match(outlook[0]?.observedRatePricing ?? "", /71\.2%/);
  assert.equal(outlook[0]?.observedConfirmationEvidenceRef, "verified-macro:pmi-reaction");
  assert.deepEqual(outlook[0]?.gaps, []);
});

test("provenance-backed verified macro data is admitted and creates the deterministic policy outlook", () => {
  const asOf = "2026-09-23T14:15:00.000Z";
  const snapshot = buildCandidateSnapshotFromCanonicalEvidence([{
    id: "row-pmi",
    external_evidence_id: "verified-macro:us-flash-pmi-2026-09",
    claim_text: "US Flash Manufacturing PMI was 57.0, above 53.6 expected and 53.9 prior.",
    evidence_class: "other",
    event_at: "2026-09-23T13:45:00.000Z",
    published_at: "2026-09-23T13:46:00.000Z",
    available_at: "2026-09-23T13:46:00.000Z",
    received_at: "2026-09-23T13:46:00.000Z",
    freshness_status: "current",
    affected_assets: ["US02Y", "DXY", "XAUUSD", "SMH"],
    affected_topics: ["US_ACTIVITY"],
    provenance_urls: ["https://example.com/pmi"],
    measurement_unit: "index",
    observed_value: 57,
    expected_value: 53.6,
    previous_value: 53.9,
    structured_payload: {
      evidenceNature: "verified_macro_data",
      signalKind: "economic_release",
      signalContext: "STRONG_ACTIVITY_SURPRISE",
    },
    source: {
      id: "source-pmi",
      external_source_id: "example.com|pmi",
      source_name: "Verified PMI source",
      source_type: "data_provider",
      source_url: "https://example.com/pmi",
      source_tier: 2,
      reliability_score: 90,
      provider_key: "verified_macro_signal",
    },
  }], { asOf, lookbackHours: 24 });

  const firstEvidence = snapshot.snapshot.observed_evidence?.[0] as {
    source_type?: string;
    metrics?: Record<string, unknown>;
  } | undefined;
  assert.equal(firstEvidence?.source_type, "VERIFIED_MACRO_DATA");
  assert.equal(firstEvidence?.metrics?.observed_value, 57);

  const packet = assembleDossierV2InputPacket({ as_of: asOf }, snapshot.snapshot);
  assert.equal(packet.observed_evidence.length, 1);

  const outlook = buildDossierPolicyOutlook(packet);
  assert.equal(outlook.length, 1);
  assert.equal(outlook[0]?.policyImpulse, "HAWKISH");
  assert.equal(outlook[0]?.fedWatchExpectedDirection, "HIKE_ODDS_UP");
  assert.equal(outlook[0]?.triggerMetrics.observed, 57);
  assert.match(outlook[0]?.gaps.join(" ") ?? "", /FedWatch/);
});

test("verified macro admin handler is bounded and delegates only validated signals", async () => {
  const seen: string[] = [];
  const request = new Request("https://example.com/api/admin/dossier-v2/verified-macro-signals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      signals: [{
        key: "us-flash-manufacturing-pmi-2026-09",
        kind: "economic_release",
        signalContext: "STRONG_ACTIVITY_SURPRISE",
        sourceName: "Calendar Source",
        sourceUrl: "https://example.com/calendar",
        sourceRole: "market_report",
        claim: "US Flash Manufacturing PMI was 57.0, above 53.6 expected and 53.9 prior.",
        eventAt: "2026-09-23T13:45:00.000Z",
        value: 57,
        unit: "index",
        observedValue: 57,
        expectedValue: 53.6,
        previousValue: 53.9,
      }],
    }),
  });

  const response = await handleVerifiedMacroSignalsWithDependencies(request, {
    authorize: async () => ({
      authorized: true,
      actor: "test-operator",
      githubRunId: "123",
      workflowSha: "abc",
    }),
    now: () => new Date("2026-09-23T14:00:00.000Z"),
    persistSignal: async (signal, availableAt) => {
      seen.push(signal.key, availableAt);
      return { evidenceId: "evidence-1", observationId: "observation-1" };
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json() as { status: string; signals: Array<{ key: string }> };
  assert.equal(body.status, "completed");
  assert.equal(body.signals[0]?.key, "us-flash-manufacturing-pmi-2026-09");
  assert.deepEqual(seen, [
    "us-flash-manufacturing-pmi-2026-09",
    "2026-09-23T14:00:00.000Z",
  ]);
});
