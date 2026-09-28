import assert from "node:assert/strict";
import test from "node:test";

import {
  augmentCandidateSnapshotWithTwelveDataReactions,
  selectIntradayReactionTriggers,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import type { TwelveDataReactionSnapshot } from "../lib/providers/twelve-data-reactions.ts";

function base(): CanonicalSnapshotResult {
  return {
    snapshot: {
      observed_evidence: [],
      research_leads: [],
      catalysts: [],
      price_data: { status: "OK", available_at: "2026-09-28T18:00:00Z" },
      macro_data: { status: "OK", available_at: "2026-09-28T18:00:00Z" },
      sources_status: {},
    },
    diagnostics: {
      rows_considered: 0,
      observed_count: 0,
      lead_count: 0,
      catalyst_count: 0,
      skipped_future_count: 0,
      skipped_expired_scheduled_count: 0,
      latest_available_at: null,
      price_data_status: "OK",
      macro_data_status: "OK",
    },
  };
}

test("intraday trigger selector admits exact System 1 catalysts and rejects date-only placeholders", () => {
  const result = base();
  result.snapshot.observed_evidence = [
    {
      evidence_id: "ev:pmi",
      claim_or_fact: "Flash manufacturing PMI was stronger than expected and above consensus.",
      category: "US_ACTIVITY",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-28T14:00:05Z",
      occurrence_time: "2026-09-28T14:00:00Z",
      metrics: { signal_kind: "economic_release", signal_context: "STRONG_ACTIVITY_SURPRISE" },
      provenance: [],
    },
    {
      evidence_id: "ev:date-only-cpi",
      claim_or_fact: "CPI was hotter than expected and above consensus.",
      category: "INFLATION",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-28T00:05:00Z",
      occurrence_time: "2026-09-28T00:00:00Z",
      metrics: { signal_kind: "economic_release", signal_context: "HOT_INFLATION_SURPRISE" },
      provenance: [],
    },
    {
      evidence_id: "market-monitor:smh:2026-09-28",
      claim_or_fact: "SMH moved on the day.",
      category: "MARKET",
      source_type: "MARKET_DATA",
      available_at: "2026-09-28T18:00:00Z",
      occurrence_time: "2026-09-28T18:00:00Z",
      metrics: { day_change_pct: 1.1, frequency: "intraday" },
      provenance: [],
    },
  ];

  assert.deepEqual(
    selectIntradayReactionTriggers(result, "2026-09-28T18:30:00Z"),
    [{ evidenceId: "ev:pmi", occurredAt: "2026-09-28T14:00:00Z" }],
  );
});

test("intraday reaction adapter admits one compact evidence item per trigger and instrument", () => {
  const result = base();
  const reactions: TwelveDataReactionSnapshot = {
    state: "ready",
    retrievedAt: "2026-09-28T18:31:00Z",
    warnings: [],
    records: [{
      triggerEvidenceId: "ev:fomc",
      triggerOccurredAt: "2026-09-28T14:00:00Z",
      monitorId: "dxy",
      expectedInstrument: "DXY",
      observedInstrument: "UUP",
      isProxy: true,
      sourceName: "Twelve Data intraday time series",
      sourceUrl: "https://twelvedata.com/docs",
      windows: [
        {
          window: "5m",
          baselineAt: "2026-09-28T13:59:00Z",
          observedAt: "2026-09-28T14:05:00Z",
          baseline: 30,
          observed: 30.1,
          changePct: 0.3333,
        },
        {
          window: "30m",
          baselineAt: "2026-09-28T13:59:00Z",
          observedAt: "2026-09-28T14:30:00Z",
          baseline: 30,
          observed: 30.3,
          changePct: 1,
        },
        {
          window: "4h",
          baselineAt: "2026-09-28T13:59:00Z",
          observedAt: "2026-09-28T18:00:00Z",
          baseline: 30,
          observed: 30.6,
          changePct: 2,
        },
      ],
    }],
  };

  const augmented = augmentCandidateSnapshotWithTwelveDataReactions(result, reactions, {
    asOf: "2026-09-28T18:30:00Z",
  });
  const evidence = augmented.snapshot.observed_evidence?.[0] as Record<string, unknown>;
  const metrics = evidence.metrics as Record<string, unknown>;

  assert.equal(evidence.grouping_key, "market-monitor:dxy");
  assert.equal(evidence.occurrence_time, "2026-09-28T14:30:00Z");
  assert.equal(metrics.event_change_pct, 1);
  assert.equal(metrics.reaction_window, "30m");
  assert.equal(metrics.expected_instrument, "DXY");
  assert.equal(metrics.observed_instrument, "UUP");
  assert.equal(metrics.is_proxy, true);
  assert.equal(metrics.frequency, "intraday");
  assert.ok(metrics.reaction_windows);
  assert.equal(augmented.snapshot.sources_status?.twelve_data_intraday_reactions?.status, "OK");
});

test("unconfigured intraday provider adds source health only and no evidence", () => {
  const result = base();
  const augmented = augmentCandidateSnapshotWithTwelveDataReactions(result, {
    state: "unconfigured",
    retrievedAt: "2026-09-28T18:31:00Z",
    records: [],
    warnings: ["TWELVE_DATA_API_KEY is not configured."],
  }, {
    asOf: "2026-09-28T18:30:00Z",
  });

  assert.equal(augmented.snapshot.observed_evidence?.length, 0);
  assert.equal(
    augmented.snapshot.sources_status?.twelve_data_intraday_reactions?.status,
    "OPTIONAL_UNCONFIGURED",
  );
});
