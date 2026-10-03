import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildDossierPolicyOutlook } from "../lib/dossier-v2/policy-outlook.ts";
import { buildDossierRateRegime } from "../lib/dossier-v2/rate-regime.ts";

const AS_OF = "2026-09-24T12:00:00.000Z";
const AVAILABLE_AT = "2026-09-24T11:30:00.000Z";

function fred(
  id: string,
  last: number,
  change5d: number | null,
): Record<string, unknown> {
  return {
    evidence_id: `market-monitor:${id}:2026-09-24`,
    claim_or_fact: `${id} was ${last}.`,
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-24T00:00:00.000Z",
    grouping_key: `market-monitor:${id}`,
    metrics: {
      last,
      change_5d_pct: change5d,
      frequency: "daily",
      provider: "Federal Reserve Economic Data",
    },
    provenance: [{
      source_type: "FRED",
      source_id: `market-monitor:${id}`,
      url: `https://fred.stlouisfed.org/series/${id}`,
      publisher: "Federal Reserve Economic Data",
    }],
  };
}

function packet(evidence: Array<Record<string, unknown>>) {
  const snapshot: CandidateSnapshot = {
    observed_evidence: evidence,
    price_data: { status: "OK", available_at: AVAILABLE_AT },
    macro_data: { status: "OK", available_at: AVAILABLE_AT },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

test("persistent rates stack remains hawkish without a fresh event trigger", () => {
  const input = packet([
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const outlook = buildDossierPolicyOutlook(input);
  const regime = buildDossierRateRegime(input, outlook);

  assert.equal(outlook.length, 0);
  assert.equal(regime.state, "HAWKISH");
  assert.equal(regime.fredBacked, true);
  assert.equal(regime.coverage.present, 5);
  assert.equal(regime.coverage.total, 5);
  assert.equal(regime.curve.state, "POSITIVE");
  assert.equal(regime.curve.spreadBps, 25);
  assert.equal(regime.nextMeetingRateOutlook, null);
  assert.ok(regime.score > 0);
  assert.ok(regime.signals.some((item) => item.key === "REAL_YIELDS" && item.state === "HAWKISH"));
});

test("persistent rate regime reports mixed conditions instead of forcing the latest event view", () => {
  const input = packet([
    {
      evidence_id: "ev:pmi:strong",
      claim_or_fact: "Flash manufacturing PMI was stronger than expected and above consensus.",
      category: "US_ACTIVITY",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T10:00:00.000Z",
      metrics: {
        signal_kind: "economic_release",
        signal_context: "STRONG_ACTIVITY_SURPRISE",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "FLASH_PMI",
      }],
    },
    fred("us2y", 4.4, -1.5),
    fred("us10y-fred", 4.7, 0),
    fred("us10y-real", 0.9, -6.0),
    fred("us10y-breakeven", 2.7, 6.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const outlook = buildDossierPolicyOutlook(input);
  const regime = buildDossierRateRegime(input, outlook);

  assert.equal(outlook[0]?.policyImpulse, "HAWKISH");
  assert.equal(regime.state, "MIXED");
  assert.ok(regime.contradictions.length >= 2);
  assert.ok(regime.signals.some((item) => item.key === "FRONT_END" && item.state === "DOVISH"));
  assert.ok(regime.signals.some((item) => item.key === "BREAKEVENS" && item.state === "HAWKISH"));
});

test("rate regime degrades explicitly when the rates stack is too sparse", () => {
  const input = packet([
    fred("us2y", 4.7, null),
  ]);

  const regime = buildDossierRateRegime(input, []);

  assert.equal(regime.state, "UNRESOLVED");
  assert.equal(regime.confidence, "UNRESOLVED");
  assert.equal(regime.coverage.present, 1);
  assert.equal(regime.gaps.length, 4);
  assert.equal(regime.fredBacked, false);
});


test("persistent next-meeting pricing survives when no fresh macro trigger is present", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:fedfunds-oct28-hike-odds-2026-09-23",
      claim_or_fact: "Fed funds futures showed a 71.2% probability of a higher target range after the October meeting, up from 55.1% the previous day.",
      category: "RATE_EXPECTATIONS",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:00:00.000Z",
      occurrence_time: "2026-09-23T20:15:00.000Z",
      metrics: {
        signal_kind: "rate_expectation",
        signal_context: "fedwatch",
        observed_value: 71.2,
        previous_value: 55.1,
        measurement_unit: "percent",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "FEDWATCH_OCT28",
      }],
    },
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const outlook = buildDossierPolicyOutlook(input);
  const regime = buildDossierRateRegime(input, outlook);

  assert.equal(outlook.length, 0);
  assert.equal(regime.nextMeetingRateOutlook, "MORE_HAWKISH");
  assert.equal(regime.fedWatchExpectedDirection, "HIKE_ODDS_UP");
  assert.match(regime.observedRatePricing ?? "", /71\.2%/);
  assert.equal(regime.trigger, null);
  assert.ok(regime.signals.some((item) =>
    item.key === "POLICY"
    && item.state === "HAWKISH"
    && item.evidenceRefs.includes("verified-macro:fedfunds-oct28-hike-odds-2026-09-23")
  ));
});

test("persistent next-meeting pricing can turn dovish without fabricating a trigger", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:fedfunds-next-meeting-lower-odds",
      claim_or_fact: "Next-meeting hike pricing fell to 40.0% from 60.0%.",
      category: "RATE_EXPECTATIONS",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:00:00.000Z",
      metrics: {
        signal_kind: "rate_expectation",
        signal_context: "policy_pricing",
        observed_value: 40,
        previous_value: 60,
        measurement_unit: "percent",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "NEXT_MEETING_PRICING",
      }],
    },
    fred("us2y", 4.5, 0),
    fred("us10y-fred", 4.7, 0),
    fred("us10y-real", 1.5, 0),
    fred("us10y-breakeven", 2.3, 0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));

  assert.equal(regime.nextMeetingRateOutlook, "MORE_DOVISH");
  assert.equal(regime.fedWatchExpectedDirection, "HIKE_ODDS_DOWN");
  assert.equal(regime.trigger, null);
});


test("verified 30Y evidence is promoted into the deterministic long-end signal", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:us30y-sep24-2026",
      claim_or_fact: "The US 30Y Treasury yield reached 5.415%, its highest level since 2004.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T12:00:00.000Z",
      occurrence_time: "2026-09-24T11:00:00.000Z",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "us30y",
        observed_value: 5.415,
        measurement_unit: "percent",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "US30Y_SEP24",
      }],
    },
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const longEnd = regime.signals.find((item) => item.key === "LONG_END");

  assert.equal(longEnd?.label, "Long-end nominal yields");
  assert.match(longEnd?.detail ?? "", /verified US 30Y 5\.42%/);
  assert.ok(longEnd?.evidenceRefs.includes("verified-macro:us30y-sep24-2026"));
});

test("verified 30Y broadens the long-end evidence but does not invent a regime without the 10Y stack", () => {
  const input = packet([{
    evidence_id: "verified-macro:us30y-only-2026",
    claim_or_fact: "The US 30Y Treasury yield reached 5.44%.",
    category: "Rates",
    source_type: "VERIFIED_MACRO_DATA",
    available_at: "2026-09-24T12:00:00.000Z",
    occurrence_time: "2026-09-24T11:00:00.000Z",
    metrics: {
      signal_kind: "market_reaction",
      signal_context: "us30y",
      observed_value: 5.44,
      measurement_unit: "percent",
    },
    provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "US30Y_ONLY" }],
  }]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const longEnd = regime.signals.find((item) => item.key === "LONG_END");

  assert.equal(longEnd?.state, "UNRESOLVED");
  assert.match(longEnd?.detail ?? "", /Verified US 30Y 5\.44%/);
  assert.equal(regime.state, "UNRESOLVED");
  assert.equal(regime.score, 0);
});


test("Rate System 1 prefers the direct Treasury 10Y cash yield over FRED fallback", () => {
  const treasury10y = {
    evidence_id: "market-monitor:us10y:2026-09-24",
    claim_or_fact: "US 10Y Treasury cash yield was 5.18%.",
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-24T00:00:00.000Z",
    grouping_key: "market-monitor:us10y",
    metrics: {
      last: 5.18,
      change_5d_pct: 2.0,
      frequency: "daily",
      provider: "U.S. Treasury",
    },
    provenance: [{
      source_type: "US_TREASURY",
      source_id: "market-monitor:us10y",
      url: "https://home.treasury.gov/",
      publisher: "U.S. Department of the Treasury",
    }],
  };

  const input = packet([
    fred("us2y", 4.8, 1.5),
    treasury10y,
    fred("us10y-fred", 5.11, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const longEnd = regime.signals.find((item) => item.key === "LONG_END");

  assert.match(longEnd?.detail ?? "", /US 10Y 5\.18%/);
  assert.ok(longEnd?.evidenceRefs.includes("market-monitor:us10y:2026-09-24"));
  assert.ok(!longEnd?.evidenceRefs.includes("market-monitor:us10y-fred:2026-09-24"));
  assert.equal(regime.curve.spreadBps, 38);
  assert.ok(regime.curve.evidenceRefs.includes("market-monitor:us10y:2026-09-24"));
});


test("Treasury liquidity support becomes restrictive only with independent long-end confirmation", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:treasury-long-end-buyback-2026-09-24",
      claim_or_fact: "Treasury increased the maximum long-end liquidity-support buyback operation to $6 billion from $2 billion.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:45:00.000Z",
      occurrence_time: "2026-09-24T11:30:00.000Z",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "treasury_supply",
        observed_value: 6,
        previous_value: 2,
        measurement_unit: "USD billions",
      },
      provenance: [{
        source_type: "US_TREASURY",
        source_id: "TREASURY_BUYBACK_SEP24",
      }],
    },
    {
      evidence_id: "verified-macro:us30y-sep24-supply-test",
      claim_or_fact: "The US 30Y Treasury yield remained above 5%.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:50:00.000Z",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "us30y",
        observed_value: 5.45,
        measurement_unit: "percent",
      },
      provenance: [{ source_type: "US_TREASURY", source_id: "US30Y_SUPPLY_TEST" }],
    },
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const supply = regime.signals.find((item) => item.key === "TREASURY_SUPPLY");

  assert.equal(supply?.state, "HAWKISH");
  assert.equal(supply?.score, 1);
  assert.match(supply?.detail ?? "", /3\.0×/);
  assert.match(supply?.detail ?? "", /not QE/i);
  assert.ok(supply?.evidenceRefs.includes("verified-macro:treasury-long-end-buyback-2026-09-24"));
});

test("a larger Treasury buyback does not manufacture tightening without elevated long-end yields", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:treasury-long-end-buyback-no-confirmation",
      claim_or_fact: "Treasury increased the maximum long-end liquidity-support buyback operation to $6 billion from $2 billion.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:45:00.000Z",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "treasury_supply",
        observed_value: 6,
        previous_value: 2,
        measurement_unit: "USD billions",
      },
      provenance: [{ source_type: "US_TREASURY", source_id: "TREASURY_BUYBACK_NO_CONFIRMATION" }],
    },
    fred("us2y", 4.5, 0),
    fred("us10y-fred", 4.7, 0),
    fred("us10y-real", 1.5, 0),
    fred("us10y-breakeven", 2.3, 0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const supply = regime.signals.find((item) => item.key === "TREASURY_SUPPLY");

  assert.equal(supply?.state, "NEUTRAL");
  assert.equal(supply?.score, 0);
  assert.match(supply?.detail ?? "", /not treated as tightening evidence by itself/i);
});


test("official FRED 2Y/5Y/10Y/20Y/30Y curve is preserved in the deterministic rates lens", () => {
  const input = packet([
    fred("us2y", 4.80, 1.5),
    fred("us5y-fred", 4.98, 2.0),
    fred("us10y-fred", 5.05, 2.0),
    fred("us20y-fred", 5.41, 2.2),
    fred("us30y-fred", 5.49, 2.3),
    fred("us10y-real", 2.20, 3.0),
    fred("us10y-breakeven", 2.60, 2.0),
    fred("fed-funds-effective", 4.60, 0),
  ]);
  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const longEnd = regime.signals.find((item) => item.key === "LONG_END");
  for (const expected of ["2Y 4.80%", "5Y 4.98%", "10Y 5.05%", "20Y 5.41%", "30Y 5.49%"]) assert.match(regime.curve.detail, new RegExp(expected.replace(".", "\\.")));
  assert.ok(regime.curve.evidenceRefs.includes("market-monitor:us20y-fred:2026-09-24"));
  assert.ok(regime.curve.evidenceRefs.includes("market-monitor:us30y-fred:2026-09-24"));
  assert.match(longEnd?.detail ?? "", /US 20Y 5\.41%/);
  assert.match(longEnd?.detail ?? "", /US 30Y 5\.49%/);
});


test("rate regime exposes the shared full-curve diagnostic without a second curve calculation", () => {
  const input = packet([
    fred("us2y", 4.72, -3.6734693878),
    fred("us5y-fred", 4.90, -2.0),
    fred("us10y-fred", 5.26, 1.1538461538),
    fred("us20y-fred", 5.60, 0.9009009009),
    fred("us30y-fred", 5.66, 1.0714285714),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));

  assert.equal(regime.curveDiagnostic.contractVersion, "rate-curve-diagnostic/1");
  assert.equal(regime.curveDiagnostic.moveClass, "DIVERGENT_STEEPENING");
  assert.equal(regime.curveDiagnostic.separationState, "FRONT_END_EASING_LONG_END_STICKY");
  assert.equal(regime.curve.spreadBps, regime.curveDiagnostic.spreads.find((item) => item.key === "2s10s")?.bps);
  assert.deepEqual(regime.curve.evidenceRefs, regime.curveDiagnostic.evidenceRefs);
});


test("rate regime carries the same bounded long-end diagnostic used by downstream reasoning", () => {
  const input = packet([
    fred("us10y-fred", 5.30, ((5.30 / 5.20) - 1) * 100),
    fred("us10y-real", 2.30, ((2.30 / 2.22) - 1) * 100),
    fred("us10y-breakeven", 3.00, ((3.00 / 2.98) - 1) * 100),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));

  assert.equal(regime.longEndDiagnostic.contractVersion, "rate-long-end-diagnostic/1");
  assert.equal(regime.longEndDiagnostic.observedDecomposition.state, "REAL_YIELD_LED");
  assert.equal(regime.longEndDiagnostic.termPremium.availability, "UNRESOLVED");
  assert.ok(regime.longEndDiagnostic.gaps.some((gap) => /term-premium/i.test(gap)));
});


test("rate regime carries bounded global duration and foreign-demand evidence without merging scopes", () => {
  const official = (
    evidenceId: string,
    groupingKey: string,
    metrics: Record<string, unknown>,
    claim: string,
  ) => ({
    evidence_id: evidenceId,
    claim_or_fact: claim,
    category: "Rates",
    source_type: "OFFICIAL_DATA",
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-24T00:00:00.000Z",
    grouping_key: groupingKey,
    metrics,
    provenance: [{ source_type: "OFFICIAL_DATA", source_id: evidenceId }],
  });

  const input = packet([
    fred("us2y", 4.70, ((4.70 / 4.90) - 1) * 100),
    fred("us5y-fred", 4.90, ((4.90 / 5.00) - 1) * 100),
    fred("us10y-fred", 5.30, ((5.30 / 5.20) - 1) * 100),
    fred("us20y-fred", 5.60, ((5.60 / 5.55) - 1) * 100),
    fred("us30y-fred", 5.70, ((5.70 / 5.60) - 1) * 100),
    {
      ...official(
        "market-monitor:usdjpy:2026-09-24",
        "market-monitor:usdjpy",
        { last: 147.5, change_5d_pct: ((147.5 / 145) - 1) * 100, frequency: "daily" },
        "USDJPY was 147.5.",
      ),
      source_type: "MARKET_DATA",
    },
    official(
      "global-rates:jgb:2026-09-24",
      "global-rates:jgb",
      {
        signal_kind: "global_rates",
        signal_context: "jgb_curve",
        jgb_2y_pct: 2.20,
        jgb_10y_pct: 3.00,
        jgb_30y_pct: 3.40,
        jgb_2y_change_5d_bp: 5,
        jgb_10y_change_5d_bp: 8,
        jgb_30y_change_5d_bp: 9,
      },
      "Japan MOF JGB constant-maturity yields were updated.",
    ),
    official(
      "global-rates:tic:2026-07",
      "global-rates:tic",
      {
        signal_kind: "foreign_treasury_holdings",
        signal_context: "tic_foreign_treasury_holdings",
        period: "2026-07",
        previous_period: "2026-06",
        japan_holdings_usd_bn: 1103.9,
        japan_previous_usd_bn: 1116.7,
        japan_monthly_change_usd_bn: -12.8,
        total_foreign_holdings_usd_bn: 9500,
        foreign_official_holdings_usd_bn: 3900,
        custody_attribution_caveat: "Custody location may not equal beneficial owner.",
      },
      "Treasury TIC reported Japan Treasury holdings.",
    ),
    official(
      "global-rates:japan-mof-flows:2026-09-15-09-21",
      "global-rates:japan-mof-flows",
      {
        signal_kind: "portfolio_flow",
        signal_context: "japan_mof_outward_securities",
        period_label: "2026/09/15-2026/09/21",
        outward_long_term_debt_net_purchase_jpy_bn: 420,
        outward_total_net_purchase_jpy_bn: 500,
        treasury_specific: false,
      },
      "Japan residents were net buyers of foreign long-term debt securities.",
    ),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));

  assert.equal(regime.globalDurationDiagnostic.contractVersion, "rate-global-duration-diagnostic/1");
  assert.equal(regime.globalDurationDiagnostic.relativeRates.ustJgb10yBp, 230);
  assert.equal(regime.globalDurationDiagnostic.foreignTreasuryDemand.japanHoldingsDirection, "DECREASED");
  assert.equal(regime.globalDurationDiagnostic.japanPortfolioFlows.direction, "NET_PURCHASE");
  assert.equal(regime.globalDurationDiagnostic.japanPortfolioFlows.treasurySpecific, false);
  assert.equal(regime.globalDurationDiagnostic.comparability.canCompareTicAndWeeklyMofAsSameFlow, false);
  assert.ok(regime.evidenceRefs.includes("global-rates:tic:2026-07"));
  assert.ok(regime.evidenceRefs.includes("global-rates:japan-mof-flows:2026-09-15-09-21"));
});


test("rate regime carries deterministic cross-asset transmission without promoting it into a trade verdict", () => {
  const market = (
    id: string,
    last: number,
    prior: number,
    extra: Record<string, unknown> = {},
  ) => ({
    evidence_id: `market-monitor:${id}:2026-09-24`,
    claim_or_fact: `${id} was ${last}.`,
    category: "Market",
    source_type: "MARKET_DATA",
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-24T00:00:00.000Z",
    grouping_key: id === "hy-oas" || id === "ig-oas" ? "market-monitor:credit-oas" : `market-monitor:${id}`,
    metrics: {
      last,
      change_5d_pct: ((last / prior) - 1) * 100,
      frequency: "daily",
      ...extra,
    },
    provenance: [{ source_type: "MARKET_DATA", source_id: `market-monitor:${id}` }],
  });

  const input = packet([
    fred("us10y-fred", 5.20, ((5.20 / 5.10) - 1) * 100),
    fred("us10y-real", 2.30, ((2.30 / 2.20) - 1) * 100),
    fred("us10y-breakeven", 3.00, 0),
    market("gold", 100, 101.5),
    market("dxy", 100.5, 100),
    market("hy-oas", 3.20, 3.18, { spread_level_pct: 3.20 }),
    market("ig-oas", 0.90, 0.89, { spread_level_pct: 0.90 }),
    market("spx", 101, 100),
    market("ndx", 101.2, 100),
    market("rsp", 100.8, 100),
    market("russell", 100.5, 100),
    market("smh", 101.5, 100),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));

  assert.equal(regime.crossAssetTransmission.contractVersion, "rate-cross-asset-transmission/1");
  assert.equal(regime.crossAssetTransmission.state, "HIGH_RATES_CONTAINED");
  assert.equal(regime.crossAssetTransmission.credit.state, "CONTAINED");
  assert.equal(regime.crossAssetTransmission.equityDuration.state, "RESILIENT");
  assert.ok(regime.evidenceRefs.includes("market-monitor:hy-oas:2026-09-24"));
  assert.ok(regime.evidenceRefs.includes("market-monitor:ndx:2026-09-24"));
});
