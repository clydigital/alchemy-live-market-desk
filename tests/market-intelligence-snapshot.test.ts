import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import {
  buildMarketIntelligenceSnapshot,
  unavailableSnapshotResponseBody,
  marketIntelligenceUnavailableResponse,
  MARKET_INTELLIGENCE_SNAPSHOT_V1,
  MARKET_INTELLIGENCE_UNAVAILABLE_DETAIL,
} from "../lib/market-intelligence-snapshot.ts";
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

test("unavailableSnapshotResponseBody produces a safe static 503 payload without echoing sensitive details", () => {
  const sensitiveInputs = [
    "postgres://admin:p@ssword123@db.internal:5432/production_live",
    "HTTP 502 Bad Gateway from https://secret-provider.internal/v1/feed?key=sk_live_999",
    "Error: SELECT * FROM secret_tokens WHERE token = 'xyz'",
    "TypeError: Cannot read properties of null at fetchProvider (file:///app/lib/provider.ts:42:10)",
    "Failed to authenticate with bearer token eyJhbGciOiJIUzI1NiI...",
    "Internal database connection pool exhausted at node:internal/net:123",
  ];

  for (const input of sensitiveInputs) {
    const response = unavailableSnapshotResponseBody();
    const serialized = JSON.stringify(response);

    assert.equal(response.contractVersion, MARKET_INTELLIGENCE_SNAPSHOT_V1);
    assert.equal(response.status, "unavailable");
    assert.equal(response.detail, "No verified market intelligence snapshot is currently available.");
    assert.equal(response.detail, MARKET_INTELLIGENCE_UNAVAILABLE_DETAIL);

    assert.ok(!serialized.includes(input), `Public response must not contain sensitive input: ${input}`);
    assert.ok(!serialized.includes("postgres"), "Public response must not contain database URI");
    assert.ok(!serialized.includes("http"), "Public response must not contain provider URL");
    assert.ok(!serialized.includes("SELECT"), "Public response must not contain SQL");
    assert.ok(!serialized.includes("TypeError"), "Public response must not contain exception type");
    assert.ok(!serialized.includes("file://"), "Public response must not contain stack trace");
  }
});

test("marketIntelligenceUnavailableResponse produces executable HTTP 503 response for both unavailable branches", async () => {
  // Both route branches (no selected Dossier presentation and unexpected snapshot assembly exception)
  // return marketIntelligenceUnavailableResponse().
  const response = marketIntelligenceUnavailableResponse();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Alchemy-Market-Intelligence"), "unavailable");

  const body = await response.json();
  assert.deepEqual(body, {
    contractVersion: MARKET_INTELLIGENCE_SNAPSHOT_V1,
    status: "unavailable",
    detail: MARKET_INTELLIGENCE_UNAVAILABLE_DETAIL,
  });
});

test("route 503 branches call marketIntelligenceUnavailableResponse and keep logging fixed-category", () => {
  const routeSource = readFileSync(
    new URL("../app/api/market-intelligence-snapshot/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(
    routeSource.includes("marketIntelligenceUnavailableResponse()"),
    "Route must call marketIntelligenceUnavailableResponse() for failure branches",
  );

  assert.ok(
    !routeSource.includes("`Market intelligence snapshot failed: ${detail}`"),
    "Route must not construct dynamic failure strings containing exception details",
  );

  assert.ok(
    !routeSource.includes("detail: selection.notice?.detail"),
    "Route must not expose raw selection notice details in public 503 responses",
  );

  // Assert expected GET success headers semantics exist in route source and 200 contract is preserved
  assert.ok(
    routeSource.includes('"Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"'),
    "Route must retain public Cache-Control for success 200 path",
  );
  assert.ok(
    routeSource.includes('"X-Alchemy-Market-Intelligence": snapshot.contractVersion'),
    "Route must set X-Alchemy-Market-Intelligence header to contractVersion on success",
  );
  assert.ok(
    routeSource.includes("status: 200"),
    "Route must return status 200 on success",
  );

  // Verify server diagnostic logging remains fixed category without leaking secrets or errors
  assert.ok(
    routeSource.includes('console.error("Market intelligence snapshot unavailable: no Dossier presentation selected.");'),
    "Server log for no Dossier presentation must be fixed string",
  );
  assert.ok(
    routeSource.includes('console.error("Market intelligence snapshot unavailable: unexpected assembly failure.");'),
    "Server log for unexpected error must be fixed category string",
  );
  assert.ok(
    !routeSource.includes("console.error(\"Market intelligence snapshot failed:\", detail)"),
    "Server logs must not echo exception messages, which may contain secrets",
  );
  assert.ok(
    !routeSource.includes("console.error(\"Market intelligence snapshot unavailable notice:\", selection.notice.detail)"),
    "Server logs must not echo raw Dossier selection notices",
  );
});
