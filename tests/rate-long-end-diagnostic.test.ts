import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import {
  buildRateLongEndDiagnostic,
  RATE_LONG_END_DIAGNOSTIC_VERSION,
} from "../lib/dossier-v2/rate-long-end-diagnostic.ts";

const AS_OF = "2026-10-03T08:00:00.000Z";

function monitor(id: string, last: number, prior: number) {
  return {
    evidence_id: `market-monitor:${id}:2026-10-03`,
    claim_or_fact: `${id} was ${last}.`,
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: AS_OF,
    occurrence_time: "2026-10-03T00:00:00.000Z",
    grouping_key: `market-monitor:${id}`,
    metrics: {
      last,
      change_5d_pct: ((last / prior) - 1) * 100,
      frequency: "daily",
    },
    provenance: [{ source_type: "TEST", source_id: `market-monitor:${id}` }],
  };
}

function packet(evidence: Array<Record<string, unknown>>) {
  const snapshot: CandidateSnapshot = {
    observed_evidence: evidence,
    price_data: { status: "OK", available_at: AS_OF },
    macro_data: { status: "OK", available_at: AS_OF },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

test("long-end diagnostic decomposes the observed 10Y move without assigning the residual to a cause", () => {
  const result = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    monitor("us10y-real", 2.30, 2.22),
    monitor("us10y-breakeven", 3.00, 2.98),
  ]));

  assert.equal(result.contractVersion, RATE_LONG_END_DIAGNOSTIC_VERSION);
  assert.equal(result.nominal10y.change5dBp, 10);
  assert.equal(result.real10y.change5dBp, 8);
  assert.equal(result.breakeven10y.change5dBp, 2);
  assert.equal(result.observedDecomposition.accountedChangeBp, 10);
  assert.equal(result.observedDecomposition.residualBp, 0);
  assert.equal(result.observedDecomposition.state, "REAL_YIELD_LED");
  assert.equal(result.termPremium.availability, "UNRESOLVED");
  assert.match(result.termPremium.detail, /not sufficient evidence/i);
});

test("production regression: long-end decomposition reads real yield and breakeven from preserved rate_context", () => {
  const assembled = packet([
    monitor("us10y", 5.28, 5.17),
    monitor("us10y-real", 2.88, 2.85),
    monitor("us10y-breakeven", 2.36, 2.34),
  ]);

  const real = assembled.observed_evidence.find((item) =>
    item.evidence_id.startsWith("market-monitor:us10y-real:"));
  const breakeven = assembled.observed_evidence.find((item) =>
    item.evidence_id.startsWith("market-monitor:us10y-breakeven:"));
  assert.ok(real);
  assert.ok(breakeven);

  // Reproduce the production packet shape where these protected rate facts are
  // preserved in rate_context but omitted from the bounded general evidence set.
  assembled.rate_context = { evidence: [real, breakeven] };
  assembled.observed_evidence = assembled.observed_evidence.filter((item) =>
    item !== real && item !== breakeven);

  const result = buildRateLongEndDiagnostic(assembled);

  assert.equal(result.real10y.levelPct, 2.88);
  assert.equal(result.breakeven10y.levelPct, 2.36);
  assert.equal(result.real10y.evidenceRef, real.evidence_id);
  assert.equal(result.breakeven10y.evidenceRef, breakeven.evidence_id);
  assert.notEqual(result.observedDecomposition.state, "NOMINAL_MOVE_ONLY");
  assert.equal(result.observedDecomposition.accountedChangeBp, 5);
});

test("breakeven-led and mixed observed states remain descriptive rather than causal", () => {
  const breakevenLed = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    monitor("us10y-real", 2.23, 2.22),
    monitor("us10y-breakeven", 3.07, 2.98),
  ]));
  assert.equal(breakevenLed.observedDecomposition.state, "BREAKEVEN_LED");

  const mixed = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    monitor("us10y-real", 2.27, 2.22),
    monitor("us10y-breakeven", 3.03, 2.98),
  ]));
  assert.equal(mixed.observedDecomposition.state, "MIXED_OBSERVED");
});

test("governed term-premium evidence is admitted explicitly rather than inferred from the residual", () => {
  const result = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    monitor("us10y-real", 2.30, 2.22),
    monitor("us10y-breakeven", 3.00, 2.98),
    {
      evidence_id: "official:term-premium:2026-10-03",
      claim_or_fact: "Governed term-premium estimate was 0.82%.",
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: AS_OF,
      occurrence_time: AS_OF,
      grouping_key: "rate-context:term-premium",
      metrics: {
        signal_context: "term_premium",
        observed_value: 0.82,
        change_bps: 4.5,
        provider_status: "OK",
      },
      provenance: [{ source_type: "TEST", source_id: "fixture" }],
    },
  ]));

  assert.equal(result.termPremium.availability, "OBSERVED");
  assert.equal(result.termPremium.levelPct, 0.82);
  assert.equal(result.termPremium.change5dBp, 4.5);
  assert.ok(!result.gaps.some((gap) => /term-premium observation/i.test(gap)));
});

test("dealer balance-sheet evidence is exposed but remains directionless", () => {
  const result = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    {
      evidence_id: "system1-dollar:dealer-balance-sheet:2026-10-01",
      claim_or_fact: "NY Fed primary-dealer Treasury position and fails were updated.",
      category: "DOLLAR_LIQUIDITY",
      source_type: "OFFICIAL_DATA",
      available_at: AS_OF,
      occurrence_time: "2026-10-01T00:00:00.000Z",
      grouping_key: "system1:dealer-balance-sheet",
      metrics: {
        treasury_net_position_millions: 125000,
        treasury_net_position_weekly_change_millions: 15000,
        fails_deliver_millions: 28000,
        fails_receive_millions: 24000,
        provider_status: "OK",
      },
      provenance: [{ source_type: "TEST", source_id: "fixture" }],
    },
  ]));

  assert.equal(result.marketStructure.dealerNetPositionMillions, 125000);
  assert.equal(result.marketStructure.dealerNetPositionWeeklyChangeMillions, 15000);
  assert.equal(result.marketStructure.failsDeliverMillions, 28000);
  assert.match(result.marketStructure.detail, /intentionally uninterpreted/i);
});

test("auction evidence is visible for System 2 review but does not create a deterministic stress label", () => {
  const result = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    {
      evidence_id: "verified-macro:treasury-auction:2026-10-03",
      claim_or_fact: "The 10-year Treasury auction tailed by 2.1 bp with bid-to-cover at 2.2.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: AS_OF,
      occurrence_time: AS_OF,
      grouping_key: "treasury-auction:10y",
      metrics: {
        bid_to_cover: 2.2,
        tail_bps: 2.1,
      },
      provenance: [{ source_type: "TEST", source_id: "fixture" }],
    },
  ]));

  assert.equal(result.marketStructure.auctionEvidenceRef, "verified-macro:treasury-auction:2026-10-03");
  assert.match(result.marketStructure.detail, /System 2 review/);
});

test("MOVE is an explicit gap until canonical volatility evidence exists", () => {
  const unresolved = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
  ]));
  assert.equal(unresolved.volatility.moveEvidenceRef, null);
  assert.ok(unresolved.gaps.some((gap) => /MOVE/));

  const observed = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    monitor("move", 145, 138),
  ]));
  assert.equal(observed.volatility.level, 145);
  assert.equal(observed.volatility.moveEvidenceRef, "market-monitor:move:2026-10-03");
});

test("genuine coupon-supply evidence outranks newer buyback context in long-end review", () => {
  const result = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
    {
      evidence_id: "treasury-supply:coupon-sizes:2026-10-01",
      claim_or_fact: "Treasury announced larger nominal coupon offering sizes.",
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: "2026-10-02T12:00:00.000Z",
      occurrence_time: "2026-10-01T21:00:00.000Z",
      grouping_key: "rate-context:treasury-supply",
      metrics: {
        signal_kind: "treasury_supply",
        signal_context: "treasury_supply",
        supply_measure: "announced_nominal_coupon_offering_sizes",
        observed_value: 86,
        previous_value: 74,
        long_end_maturities_compared: 3,
        long_end_terms_compared: "10-Year,20-Year,30-Year",
      },
      provenance: [{ source_type: "TEST", source_id: "coupon-supply" }],
    },
    {
      evidence_id: "verified-macro:treasury-buyback:newer",
      claim_or_fact: "Treasury announced a newer buyback operation.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: AS_OF,
      occurrence_time: AS_OF,
      grouping_key: "rate-context:treasury-supply",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "treasury_supply",
        observed_value: 6,
        previous_value: 2,
      },
      provenance: [{ source_type: "TEST", source_id: "buyback" }],
    },
  ]));

  assert.equal(
    result.marketStructure.treasurySupplyEvidenceRef,
    "treasury-supply:coupon-sizes:2026-10-01",
  );
  assert.match(result.marketStructure.detail, /coupon supply-volume evidence/i);
  assert.doesNotMatch(result.marketStructure.detail, /not net-supply evidence/i);
});

test("missing real yield and breakeven does not invent a decomposition", () => {
  const result = buildRateLongEndDiagnostic(packet([
    monitor("us10y", 5.30, 5.20),
  ]));

  assert.equal(result.observedDecomposition.state, "NOMINAL_MOVE_ONLY");
  assert.equal(result.observedDecomposition.accountedChangeBp, null);
  assert.equal(result.observedDecomposition.residualBp, null);
});
