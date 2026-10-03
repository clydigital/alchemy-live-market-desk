import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
  type ObservedEvidence,
} from "../lib/dossier-v2/input-packet.ts";
import { buildRateCurveDiagnostic } from "../lib/dossier-v2/rate-curve-diagnostic.ts";
import {
  buildRateGlobalDurationDiagnostic,
  RATE_GLOBAL_DURATION_DIAGNOSTIC_VERSION,
} from "../lib/dossier-v2/rate-global-duration-diagnostic.ts";

const AS_OF = "2026-10-03T08:00:00.000Z";

function evidence(
  id: string,
  groupingKey: string,
  metrics: Record<string, unknown>,
  claim = id,
  sourceType = "OFFICIAL_DATA",
): Record<string, unknown> {
  return {
    evidence_id: id,
    claim_or_fact: claim,
    category: "Rates",
    source_type: sourceType,
    available_at: AS_OF,
    occurrence_time: AS_OF,
    grouping_key: groupingKey,
    metrics,
    provenance: [{ source_type: "TEST", source_id: id }],
  };
}

function monitor(id: string, last: number, prior: number) {
  return evidence(
    `market-monitor:${id}:2026-10-03`,
    `market-monitor:${id}`,
    {
      last,
      change_5d_pct: ((last / prior) - 1) * 100,
      frequency: "daily",
    },
    `${id} was ${last}.`,
    "MARKET_DATA",
  );
}

function packet(extra: Array<Record<string, unknown>> = []) {
  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      monitor("us2y", 4.70, 4.90),
      monitor("us5y-fred", 4.90, 5.00),
      monitor("us10y", 5.30, 5.20),
      monitor("us20y-fred", 5.60, 5.55),
      monitor("us30y-fred", 5.70, 5.60),
      monitor("usdjpy", 147.5, 145.0),
      evidence(
        "global-rates:jgb:2026-10-01",
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
          provider_status: "OK",
        },
        "Japan MOF JGB yields.",
      ),
      evidence(
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
          provider_status: "OK",
        },
        "Treasury TIC Japan holdings.",
      ),
      evidence(
        "global-rates:japan-mof-flows:2026-09-20-09-26",
        "global-rates:japan-mof-flows",
        {
          signal_kind: "portfolio_flow",
          signal_context: "japan_mof_outward_securities",
          period_label: "2026/09/20-2026/09/26",
          outward_long_term_debt_net_purchase_jpy_bn: 420,
          outward_total_net_purchase_jpy_bn: 500,
          treasury_specific: false,
          provider_status: "ready",
        },
        "Japan residents bought foreign long-term debt securities.",
      ),
      ...extra,
    ],
    price_data: { status: "OK", available_at: AS_OF },
    macro_data: { status: "OK", available_at: AS_OF },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

test("global duration diagnostic computes UST-JGB gaps and preserves partial global label", () => {
  const input = packet();
  const curve = buildRateCurveDiagnostic(input.observed_evidence, AS_OF);
  const result = buildRateGlobalDurationDiagnostic(input, curve);

  assert.equal(result.contractVersion, RATE_GLOBAL_DURATION_DIAGNOSTIC_VERSION);
  assert.equal(result.japanRates.jgb10yPct, 3);
  assert.equal(result.relativeRates.ustJgb10yBp, 230);
  assert.equal(result.relativeRates.ustJgb30yBp, 230);
  assert.equal(result.relativeRates.state, "US_JAPAN_TIGHTENING");
  assert.equal(result.relativeRates.globalLabelEligible, false);
  assert.match(result.relativeRates.detail, /US–Japan evidence rather than a complete global-duration verdict/i);
  assert.ok(result.gaps.some((gap) => /Bund/));
  assert.ok(result.gaps.some((gap) => /gilt/));
});

test("explicit comparable Bund and gilt evidence can make broader global label eligible", () => {
  const input = packet([
    evidence(
      "global-rates:bund:2026-10-03",
      "global-rates:bund",
      { signal_context: "bund_10y", observed_value: 3.8, change_5d_bp: 6 },
      "German 10Y Bund yield.",
    ),
    evidence(
      "global-rates:gilt:2026-10-03",
      "global-rates:gilt",
      { signal_context: "gilt_10y", observed_value: 5.1, change_5d_bp: 7 },
      "UK 10Y gilt yield.",
    ),
  ]);
  const curve = buildRateCurveDiagnostic(input.observed_evidence, AS_OF);
  const result = buildRateGlobalDurationDiagnostic(input, curve);

  assert.equal(result.relativeRates.globalLabelEligible, true);
  assert.ok(!result.gaps.some((gap) => /Bund/));
  assert.ok(!result.gaps.some((gap) => /gilt/));
});

test("TIC monthly holdings and MOF weekly foreign-debt flow remain separate evidence", () => {
  const input = packet();
  const curve = buildRateCurveDiagnostic(input.observed_evidence, AS_OF);
  const result = buildRateGlobalDurationDiagnostic(input, curve);

  assert.equal(result.foreignTreasuryDemand.japanHoldingsDirection, "DECREASED");
  assert.equal(result.foreignTreasuryDemand.japanMonthlyChangeUsdBn, -12.8);
  assert.equal(result.japanPortfolioFlows.direction, "NET_PURCHASE");
  assert.equal(result.japanPortfolioFlows.outwardLongTermDebtNetPurchaseJpyBn, 420);
  assert.equal(result.japanPortfolioFlows.treasurySpecific, false);
  assert.equal(result.comparability.canCompareTicAndWeeklyMofAsSameFlow, false);
  assert.match(result.comparability.detail, /not U\.S\. Treasuries specifically/i);
});

test("USDJPY is explicit and DXY is never substituted", () => {
  const input = packet();
  const curve = buildRateCurveDiagnostic(input.observed_evidence, AS_OF);
  const result = buildRateGlobalDurationDiagnostic(input, curve);

  assert.equal(result.fx.usdJpy, 147.5);
  assert.ok((result.fx.change5dPct ?? 0) > 0);
  assert.equal(result.fx.evidenceRef, "market-monitor:usdjpy:2026-10-03");
});

test("missing global data fails closed instead of inferring foreign demand from US rates", () => {
  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      monitor("us2y", 4.70, 4.90),
      monitor("us10y", 5.30, 5.20),
      monitor("us30y-fred", 5.70, 5.60),
    ],
    price_data: { status: "OK", available_at: AS_OF },
    macro_data: { status: "OK", available_at: AS_OF },
  };
  const input = assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
  const curve = buildRateCurveDiagnostic(input.observed_evidence, AS_OF);
  const result = buildRateGlobalDurationDiagnostic(input, curve);

  assert.equal(result.relativeRates.state, "UNRESOLVED");
  assert.equal(result.foreignTreasuryDemand.japanHoldingsDirection, "UNRESOLVED");
  assert.equal(result.japanPortfolioFlows.direction, "UNRESOLVED");
  assert.equal(result.fx.usdJpy, null);
  assert.ok(result.gaps.length >= 5);
});
