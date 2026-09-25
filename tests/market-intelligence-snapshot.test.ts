import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketIntelligenceSnapshot } from "../lib/market-intelligence-snapshot.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { MarketMonitor } from "../lib/market-monitor.ts";
import type { NyFedPrimaryDealerSnapshot } from "../lib/providers/ny-fed-primary-dealers.ts";
import type { NyFedReferenceRatesSnapshot } from "../lib/providers/ny-fed-reference-rates.ts";
import type { TreasuryBillSnapshot } from "../lib/providers/treasury-bills.ts";

function monitorRow(id: string, last: number, change5d: number | null) {
  return {
    id,
    symbol: id,
    label: id,
    last,
    change5d,
    asOf: "2026-09-24T00:00:00.000Z",
    sourceName: "Test",
    sourceUrl: "https://example.test",
  };
}

test("market intelligence keeps monetary confirmations and contradictions separate", () => {
  const presentation = {
    dossierId: "dossier-1",
    asOf: "2026-09-25T08:00:00Z",
    health: { degraded: false, researchGaps: [] },
    header: {
      headline: "Rates remain restrictive",
      answer: "Long-duration conditions are tight.",
      regimeImplication: "Duration remains constrained.",
      regimeFamily: "INFLATION_PRESSURE",
      whatWouldChangeMind: "A durable fall in real yields.",
    },
    rateRegime: {
      state: "HAWKISH",
      fredBacked: true,
      signals: [{
        key: "REAL_YIELDS",
        label: "10Y real yield",
        state: "HAWKISH",
        score: 2,
        detail: "Real yields remain high.",
        evidenceRefs: ["ev-real"],
      }],
      gaps: [],
      evidenceRefs: ["ev-real"],
      nextMeetingRateOutlook: null,
      fedWatchExpectedDirection: null,
      trigger: null,
      observedRatePricing: null,
      observedConfirmation: null,
      usRatesReaction: null,
      usRatesInterpretation: null,
    },
    regimeStrip: [],
    whatMattersNow: { stories: [] },
    watchNext: [],
    stockRadar: [],
  } as unknown as DossierPresentationV1;

  const monitor = {
    rows: [
      monitorRow("us3m-bill", 5.3, 0),
      monitorRow("us6m-bill", 5.25, 0),
      monitorRow("fed-funds-effective", 5.0, 0),
      monitorRow("hy-oas", 3.5, 5),
      monitorRow("ig-oas", 1.1, 2),
      monitorRow("dxy", 100, 0.2),
    ],
    contradictions: [],
    limitations: [],
  } as unknown as MarketMonitor;

  const nyFed: NyFedReferenceRatesSnapshot = {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-24",
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: "https://markets.newyorkfed.org/api/rates/all/latest.json",
    rates: [
      { type: "EFFR", effectiveDate: "2026-09-24", percentRate: 5, volumeInBillions: 100, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "SOFR", effectiveDate: "2026-09-24", percentRate: 4.8, volumeInBillions: 2000, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "TGCR", effectiveDate: "2026-09-24", percentRate: 4.8, volumeInBillions: 900, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "BGCR", effectiveDate: "2026-09-24", percentRate: 4.8, volumeInBillions: 950, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
    ],
    warnings: [],
  };

  const dealers: NyFedPrimaryDealerSnapshot = {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-23",
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: "https://markets.newyorkfed.org/api/pd/get/test.json",
    series: [
      { keyId: "PDPOSGST-TOT", label: "position", asOf: "2026-09-23", valueMillions: 120000, previousAsOf: "2026-09-16", previousValueMillions: 118000, weeklyChangeMillions: 2000 },
      { keyId: "PDFTD-USTET", label: "fails deliver", asOf: "2026-09-23", valueMillions: 3000, previousAsOf: "2026-09-16", previousValueMillions: 2800, weeklyChangeMillions: 200 },
      { keyId: "PDFTR-USTET", label: "fails receive", asOf: "2026-09-23", valueMillions: 2900, previousAsOf: "2026-09-16", previousValueMillions: 2700, weeklyChangeMillions: 200 },
    ],
    warnings: [],
  };

  const treasuryBills: TreasuryBillSnapshot = {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-24",
    sourceName: "U.S. Department of the Treasury",
    sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026",
    points: [
      { tenor: "3M", date: "2026-09-24", yieldPercent: 5.3 },
      { tenor: "6M", date: "2026-09-24", yieldPercent: 5.25 },
    ],
    warnings: [],
  };

  const result = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor,
    nyFedReferenceRates: nyFed,
    nyFedPrimaryDealers: dealers,
    treasuryBills,
    generatedAt: "2026-09-25T08:00:00Z",
  });

  assert.equal(result.contractVersion, "market-intelligence-snapshot/v1");
  assert.ok(result.monetarySignals.confirming.includes("RATES_REAL_YIELDS"));
  assert.ok(result.monetarySignals.confirming.includes("BILLS"));
  assert.equal(result.sourceHealth.treasuryBills, "OK");
  assert.equal(result.monetarySignals.signals.find((item) => item.key === "BILLS")?.sourceName, "U.S. Department of the Treasury");
  assert.ok(result.monetarySignals.contradicting.includes("FUNDING"));
  assert.ok(result.monetarySignals.unresolved.includes("DEALER_POSITIONING"));
  assert.ok(result.researchGaps.some((item) => item.includes("Treasury supply")));
});
