import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import {
  buildPolicyLiquidityInteraction,
  buildSystem1DollarLiquidity,
} from "../lib/dossier-v2/system1-dollar-liquidity.ts";
import { buildDossierPolicyOutlook } from "../lib/dossier-v2/policy-outlook.ts";
import { buildDossierRateRegime } from "../lib/dossier-v2/rate-regime.ts";
import { buildResearchBrainPrompt } from "../lib/dossier-v2/research-brain-prompt.ts";
import {
  augmentCandidateSnapshotWithDollarPlumbing,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";

const AS_OF = "2026-09-25T12:00:00.000Z";

function observed(
  evidence_id: string,
  grouping_key: string,
  metrics: Record<string, unknown>,
  claim_or_fact = evidence_id,
) {
  return {
    evidence_id,
    claim_or_fact,
    category: "DOLLAR_LIQUIDITY",
    source_type: "OFFICIAL_DATA",
    available_at: AS_OF,
    grouping_key,
    metrics,
    provenance: [{ source_type: "OFFICIAL_DATA", source_id: evidence_id }],
  };
}

function packet() {
  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      observed(
        "system1-dollar:nyfed-rates:2026-09-24",
        "system1:dollar-funding",
        {
          effr_pct: 5,
          sofr_pct: 5.1,
          tgcr_pct: 5.09,
          bgcr_pct: 5.08,
          secured_vs_effr_bps: 9,
        },
      ),
      observed(
        "system1-dollar:treasury-bills:2026-09-24",
        "system1:treasury-bills",
        { bill_3m_pct: 5.2, bill_6m_pct: 5.2 },
      ),
      observed(
        "system1-dollar:dealer-balance-sheet:2026-09-23",
        "system1:dealer-balance-sheet",
        {
          treasury_net_position_millions: 125000,
          fails_deliver_millions: 3500,
          fails_deliver_weekly_change_millions: 500,
          fails_receive_millions: 3300,
          fails_receive_weekly_change_millions: 400,
        },
      ),
      observed("market-monitor:hy-oas:2026-09-24", "market-monitor:credit-oas", {
        spread_level_pct: 3.6,
        change_5d_pct: 5.9,
      }),
      observed("market-monitor:ig-oas:2026-09-24", "market-monitor:credit-oas", {
        spread_level_pct: 1.1,
        change_5d_pct: 8,
      }),
      observed("market-monitor:dxy:2026-09-24", "market-monitor:dxy", {
        last: 101.2,
        change_5d_pct: 1.5,
      }),
      observed("market-monitor:us2y:2026-09-24", "market-monitor:us2y", {
        last: 4.95,
        change_5d_pct: 2,
      }),
      observed("market-monitor:us10y-fred:2026-09-24", "market-monitor:us10y-fred", {
        last: 5.18,
        change_5d_pct: 2,
      }),
      observed("market-monitor:us10y-real:2026-09-24", "market-monitor:us10y-real", {
        last: 2.3,
        change_5d_pct: 3,
      }),
      observed("market-monitor:us10y-breakeven:2026-09-24", "market-monitor:us10y-breakeven", {
        last: 2.7,
        change_5d_pct: 1,
      }),
      observed("market-monitor:fed-funds-effective:2026-09-24", "market-monitor:fed-funds-effective", {
        last: 4.25,
        change_5d_pct: 0,
      }),
    ],
    research_leads: [],
    catalysts: [],
    price_data: { status: "OK", available_at: AS_OF },
    macro_data: { status: "OK", available_at: AS_OF },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

test("System 1 classifies dollar tightening independently from the rate regime", () => {
  const input = packet();
  const liquidity = buildSystem1DollarLiquidity(input);
  const rateRegime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const interaction = buildPolicyLiquidityInteraction(rateRegime, liquidity);

  assert.equal(liquidity.state, "TIGHTENING");
  assert.equal(liquidity.confidence, "HIGH");
  assert.equal(liquidity.components.find((item) => item.key === "FUNDING")?.direction, "TIGHTER");
  assert.equal(liquidity.components.find((item) => item.key === "CREDIT")?.direction, "TIGHTER");
  assert.equal(liquidity.components.find((item) => item.key === "OFFSHORE_USD")?.direction, "UNRESOLVED");
  assert.equal(rateRegime.state, "HAWKISH");
  assert.equal(interaction.alignment, "CONFIRMING_TIGHTENING");
  assert.equal(interaction.escalateToBrain, true);
});

test("Research Brain receives compressed rate/liquidity states and one interaction question", () => {
  const prompt = buildResearchBrainPrompt({
    contract_version: "research-brain-input/1",
    as_of: AS_OF,
    packet: packet(),
  });

  const bounded = prompt.boundedInput as Record<string, unknown>;
  assert.ok(bounded.system1_rate_regime);
  assert.ok(bounded.system1_dollar_liquidity);
  assert.ok(bounded.system1_policy_liquidity_interaction);
  assert.match(prompt.instructions, /SYSTEM 1 DOLLAR LIQUIDITY/);
  assert.match(prompt.instructions, /OFFSHORE_USD is explicitly unresolved/);

  const compressedBytes = Buffer.byteLength(JSON.stringify({
    rate: bounded.system1_rate_regime,
    liquidity: bounded.system1_dollar_liquidity,
    interaction: bounded.system1_policy_liquidity_interaction,
  }), "utf8");
  assert.ok(compressedBytes < 6000, `System 1 liquidity context unexpectedly large: ${compressedBytes} bytes`);
});

test("canonical snapshot admits only three compact plumbing observations and rejects future observations", () => {
  const base: CanonicalSnapshotResult = {
    snapshot: {
      observed_evidence: [],
      research_leads: [],
      catalysts: [],
      price_data: { status: "OK", available_at: AS_OF },
      macro_data: { status: "OK", available_at: AS_OF },
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

  const enriched = augmentCandidateSnapshotWithDollarPlumbing(
    base,
    {
      status: "OK",
      fetchedAt: AS_OF,
      asOf: "2026-09-24",
      sourceName: "Federal Reserve Bank of New York",
      sourceUrl: "https://markets.newyorkfed.org",
      warnings: [],
      rates: [
        { type: "EFFR", effectiveDate: "2026-09-24", percentRate: 5, volumeInBillions: 100, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
        { type: "SOFR", effectiveDate: "2026-09-24", percentRate: 5.1, volumeInBillions: 2000, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
        { type: "TGCR", effectiveDate: "2026-09-24", percentRate: 5.09, volumeInBillions: 900, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
        { type: "BGCR", effectiveDate: "2026-09-24", percentRate: 5.08, volumeInBillions: 950, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      ],
    },
    {
      status: "OK",
      fetchedAt: AS_OF,
      asOf: "2026-09-23",
      sourceName: "Federal Reserve Bank of New York",
      sourceUrl: "https://markets.newyorkfed.org",
      warnings: [],
      series: [
        { keyId: "PDPOSGST-TOT", label: "position", asOf: "2026-09-23", valueMillions: 125000, previousAsOf: "2026-09-16", previousValueMillions: 120000, weeklyChangeMillions: 5000 },
        { keyId: "PDFTD-USTET", label: "fails deliver", asOf: "2026-09-23", valueMillions: 3500, previousAsOf: "2026-09-16", previousValueMillions: 3000, weeklyChangeMillions: 500 },
        { keyId: "PDFTR-USTET", label: "fails receive", asOf: "2026-09-23", valueMillions: 3300, previousAsOf: "2026-09-16", previousValueMillions: 2900, weeklyChangeMillions: 400 },
      ],
    },
    {
      status: "OK",
      fetchedAt: AS_OF,
      asOf: "2026-09-24",
      sourceName: "U.S. Department of the Treasury",
      sourceUrl: "https://home.treasury.gov",
      warnings: [],
      points: [
        { tenor: "3M", date: "2026-09-24", yieldPercent: 5.2 },
        { tenor: "6M", date: "2026-09-24", yieldPercent: 5.2 },
      ],
    },
    { asOf: AS_OF },
  );

  const ids = (enriched.snapshot.observed_evidence || []).map((item) => String(item.evidence_id));
  assert.equal(ids.filter((id) => id.startsWith("system1-dollar:")).length, 3);

  const historical = augmentCandidateSnapshotWithDollarPlumbing(
    base,
    {
      status: "OK",
      fetchedAt: "2026-09-20T12:00:00.000Z",
      asOf: "2026-09-24",
      sourceName: "Federal Reserve Bank of New York",
      sourceUrl: "https://markets.newyorkfed.org",
      warnings: [],
      rates: [{ type: "EFFR", effectiveDate: "2026-09-24", percentRate: 5, volumeInBillions: 100, percentile1: null, percentile25: null, percentile75: null, percentile99: null }],
    },
    {
      status: "UNAVAILABLE",
      fetchedAt: "2026-09-20T12:00:00.000Z",
      asOf: null,
      sourceName: "Federal Reserve Bank of New York",
      sourceUrl: "https://markets.newyorkfed.org",
      warnings: [],
      series: [],
    },
    {
      status: "UNAVAILABLE",
      fetchedAt: "2026-09-20T12:00:00.000Z",
      asOf: null,
      sourceName: "U.S. Department of the Treasury",
      sourceUrl: "https://home.treasury.gov",
      warnings: [],
      points: [],
    },
    { asOf: "2026-09-20T12:00:00.000Z" },
  );
  assert.equal((historical.snapshot.observed_evidence || []).length, 0);
});
