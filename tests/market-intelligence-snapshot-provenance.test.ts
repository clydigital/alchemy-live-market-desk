import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketIntelligenceSnapshot } from "../lib/market-intelligence-snapshot.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { MarketMonitor, MarketMonitorRow } from "../lib/market-monitor.ts";
import type { MarketMotionEditionAttachment } from "../lib/market-motion-edition.ts";
import type { NyFedPrimaryDealerSnapshot } from "../lib/providers/ny-fed-primary-dealers.ts";
import type { NyFedReferenceRatesSnapshot } from "../lib/providers/ny-fed-reference-rates.ts";
import type { TreasuryBillSnapshot } from "../lib/providers/treasury-bills.ts";

function createMockRow(
  id: string,
  last: number | null = 100,
  change5d: number | null = 0.5,
  asOf = "2026-09-24T22:00:00.000Z",
  sourceName = "Test Monitor Source",
  sourceUrl = "https://example.com/source",
): MarketMonitorRow {
  return {
    id,
    symbol: id.toUpperCase(),
    label: `Label ${id}`,
    type: "Rates",
    benchmark: null,
    last,
    previousClose: 99.5,
    sessionOpen: 99.8,
    dayChange: 0.5,
    gapChange: 0.3,
    change3d: 0.4,
    change5d,
    rsi: 50,
    stochRsi: 50,
    volPercentile: 50,
    relative5d: 0,
    attentionScore: 40,
    hot: false,
    contradiction: false,
    tags: [],
    asOf,
    frequency: "daily",
    sourceName,
    sourceUrl,
    points: [{ time: 1700000000, close: last ?? 100 }],
  };
}

function createBasePresentation(overrides: Partial<DossierPresentationV1> = {}): DossierPresentationV1 {
  return {
    contractVersion: "dossier-presentation/1",
    dossierId: "dossier-provenance-101",
    previousDossierId: "dossier-provenance-100",
    asOf: "2026-09-25T08:00:00.000Z",
    createdAt: "2026-09-25T08:05:00.000Z",
    health: {
      state: "healthy",
      degraded: false,
      repairUsed: false,
      freshnessWarnings: [],
      evidenceStates: [],
      researchGaps: [],
      missingInputCategories: [],
    },
    memory: {
      state: "AVAILABLE",
      structuralPredecessorId: "dossier-provenance-100",
      analyticalBaselineId: "dossier-provenance-100",
      analyticalBaselineAsOf: "2026-09-24T08:00:00.000Z",
      sameAsStructuralPredecessor: true,
    },
    header: {
      headline: "Headline: Restrictive Stance Maintained",
      answer: "Answer: Yields remain elevated.",
      regimeImplication: "Implication: Financial conditions stay tight.",
      regimeFamily: "RATES_LED_TIGHTENING",
      epistemicLabel: "SUPPORTED",
      whatWouldChangeMind: "A sustained fall in core services inflation.",
    },
    regimeStrip: [
      {
        key: "US_RATES",
        label: "US Rates",
        observed: true,
        reaction: "Yields higher",
        interpretation: "Hawk pressure",
        evidenceRefs: ["ev-rates-1"],
        unresolvedSignals: [],
      },
    ],
    policyOutlook: [],
    rateRegime: {
      state: "HAWKISH",
      nextMeetingRateOutlook: null,
      fedWatchExpectedDirection: null,
      trigger: null,
      observedRatePricing: null,
      observedConfirmation: null,
      usRatesReaction: null,
      usRatesInterpretation: null,
      fredBacked: true,
      evidenceRefs: ["ev-rates-1"],
      gaps: [],
      signals: [
        {
          key: "REAL_YIELDS",
          label: "10Y Real Yield",
          state: "HAWKISH",
          score: 2,
          detail: "Real yields at cycle highs.",
          evidenceRefs: ["ev-real-1"],
        },
      ],
    },
    dollarLiquidity: null,
    policyLiquidityInteraction: null,
    whatMattersNow: {
      leadThreadId: "thread-1",
      supportingStoryIds: ["story-sub-1"],
      stories: [
        {
          id: "story-analytical-1",
          persistentStoryId: "uuid-story-persistent-1",
          title: "Persistent Story Title",
          whatChanged: "New macro evidence arrived",
          whyItMatters: "Shift in curve slope",
          mechanism: "Term premium re-pricing",
          conclusion: "Higher for longer stance",
          whatWouldChangeMind: "Sub-2% inflation print",
          epistemicLabel: "SUPPORTED",
          evidenceRefs: ["ev-story-1"],
          confirmingEvidenceRefs: ["ev-story-1"],
          contradictingEvidenceRefs: [],
          acceleratingEvidenceRefs: [],
          unresolvedEvidenceRefs: [],
          investigationIds: ["inv-1"],
          chartIds: ["chart-1"],
        },
      ],
    },
    watchNext: [],
    investigationAudit: [],
    investigationJourney: [],
    reactionCalibration: {
      evaluatedInvestigations: 0,
      alignedInvestigations: 0,
      divergentInvestigations: 0,
      mixedInvestigations: 0,
      unresolvedInvestigations: 0,
      intradayInvestigations: 0,
      expectationChangedInvestigations: 0,
      reviewQueue: [],
    },
    researchNow: [],
    charts: { core: [], optional: [] },
    stockRadar: [],
    themes: [],
    creatorThemes: [],
    thesisChanges: [],
    evidenceIndex: [],
    diagnostics: {
      modelRepairUsed: false,
      notes: [],
      omittedOrDemotedItems: [],
    },
    ...overrides,
  };
}

function createBaseMonitor(overrides: Partial<MarketMonitor> = {}): MarketMonitor {
  return {
    updatedAt: "2026-09-25T07:50:00.000Z",
    rows: [
      createMockRow("us2y", 4.8, 0.1, "2026-09-24T22:00:00.000Z", "FRED US2Y", "https://fred.stlouisfed.org/series/DGS2"),
      createMockRow("us10y-fred", 4.2, 0.2, "2026-09-24T22:00:00.000Z", "FRED US10Y", "https://fred.stlouisfed.org/series/DGS10"),
      createMockRow("us10y-real", 2.0, 0.05, "2026-09-24T22:00:00.000Z", "FRED US10Y Real", "https://fred.stlouisfed.org/series/DFII10"),
      createMockRow("us10y-breakeven", 2.2, 0.0, "2026-09-24T22:00:00.000Z", "FRED Breakeven", "https://fred.stlouisfed.org/series/T10YIE"),
      createMockRow("fed-funds-effective", 5.33, 0.0, "2026-09-24T22:00:00.000Z", "FRED EFFR", "https://fred.stlouisfed.org/series/DFF"),
      createMockRow("us3m-bill", 5.2, -0.01, "2026-09-24T22:00:00.000Z", "FRED 3M", "https://fred.stlouisfed.org/series/DGS3MO"),
      createMockRow("us6m-bill", 5.15, -0.02, "2026-09-24T22:00:00.000Z", "FRED 6M", "https://fred.stlouisfed.org/series/DGS6MO"),
      createMockRow("hy-oas", 3.2, 0.3, "2026-09-24T22:00:00.000Z", "FRED HY OAS", "https://fred.stlouisfed.org/series/BAMLH0A0HYM2"),
      createMockRow("ig-oas", 1.05, 0.01, "2026-09-24T22:00:00.000Z", "FRED IG OAS", "https://fred.stlouisfed.org/series/BAMLC0A0CM"),
      createMockRow("dxy", 104.5, 1.2, "2026-09-24T22:00:00.000Z", "Market Dollar Index", "https://example.com/dxy"),
    ],
    breadth: [],
    contradictions: [],
    researchTriggers: [],
    limitations: [],
    ...overrides,
  };
}

function createBaseNyFedRates(overrides: Partial<NyFedReferenceRatesSnapshot> = {}): NyFedReferenceRatesSnapshot {
  return {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-24",
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: "https://markets.newyorkfed.org/api/rates/all/latest.json",
    rates: [
      { type: "EFFR", effectiveDate: "2026-09-24", percentRate: 5.33, volumeInBillions: 100, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "SOFR", effectiveDate: "2026-09-24", percentRate: 5.31, volumeInBillions: 2100, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "TGCR", effectiveDate: "2026-09-24", percentRate: 5.30, volumeInBillions: 950, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "BGCR", effectiveDate: "2026-09-24", percentRate: 5.30, volumeInBillions: 980, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
    ],
    warnings: [],
    ...overrides,
  };
}

function createBaseDealers(overrides: Partial<NyFedPrimaryDealerSnapshot> = {}): NyFedPrimaryDealerSnapshot {
  return {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-23",
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: "https://markets.newyorkfed.org/api/pd/get/latest.json",
    series: [
      { keyId: "PDPOSGST-TOT", label: "position", asOf: "2026-09-23", valueMillions: 125000, previousAsOf: "2026-09-16", previousValueMillions: 120000, weeklyChangeMillions: 5000 },
      { keyId: "PDFTD-USTET", label: "fails deliver", asOf: "2026-09-23", valueMillions: 3100, previousAsOf: "2026-09-16", previousValueMillions: 2900, weeklyChangeMillions: 200 },
      { keyId: "PDFTR-USTET", label: "fails receive", asOf: "2026-09-23", valueMillions: 3000, previousAsOf: "2026-09-16", previousValueMillions: 2800, weeklyChangeMillions: 200 },
    ],
    warnings: [],
    ...overrides,
  };
}

function createBaseTreasuryBills(overrides: Partial<TreasuryBillSnapshot> = {}): TreasuryBillSnapshot {
  return {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-24",
    sourceName: "U.S. Department of the Treasury",
    sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026",
    points: [
      { tenor: "3M", date: "2026-09-24", yieldPercent: 5.2 },
      { tenor: "6M", date: "2026-09-24", yieldPercent: 5.15 },
    ],
    warnings: [],
    ...overrides,
  };
}

test("1. Independent clocks and freshness preservation", () => {
  const generatedAt = "2026-09-25T14:30:00.000Z";
  const presentation = createBasePresentation({ asOf: "2026-09-25T08:00:00.000Z" });
  const monitor = createBaseMonitor();

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor,
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
    generatedAt,
  });

  // Verify computation timestamp vs Dossier timestamp vs source observation timestamp
  assert.equal(snapshot.generatedAt, "2026-09-25T14:30:00.000Z");
  assert.equal(snapshot.dossier.asOf, "2026-09-25T08:00:00.000Z");

  const us2yRow = snapshot.marketState.selectedRows.find((r) => r.id === "us2y");
  assert.ok(us2yRow);
  assert.equal(us2yRow.asOf, "2026-09-24T22:00:00.000Z");
  assert.equal(us2yRow.sourceName, "FRED US2Y");
  assert.equal(us2yRow.sourceUrl, "https://fred.stlouisfed.org/series/DGS2");

  // USD signal source preserves exact monitor row attribution
  const usdSignal = snapshot.monetarySignals.signals.find((s) => s.key === "USD");
  assert.ok(usdSignal);
  assert.equal(usdSignal.sourceName, "Market Dollar Index");
  assert.equal(usdSignal.sourceUrl, "https://example.com/dxy");
  assert.equal(usdSignal.asOf, "2026-09-24T22:00:00.000Z");
});

test("2. Source health state combinations", () => {
  // Scenario A: Everything healthy / OK
  const healthySnapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation: createBasePresentation(),
    monitor: createBaseMonitor({ limitations: [] }),
    nyFedReferenceRates: createBaseNyFedRates({ status: "OK" }),
    nyFedPrimaryDealers: createBaseDealers({ status: "OK" }),
    treasuryBills: createBaseTreasuryBills({ status: "OK" }),
  });

  assert.equal(healthySnapshot.sourceHealth.dossier, "OK");
  assert.equal(healthySnapshot.sourceHealth.marketMonitor, "OK");
  assert.equal(healthySnapshot.sourceHealth.fredRates, "OK");
  assert.equal(healthySnapshot.sourceHealth.nyFedReferenceRates, "OK");
  assert.equal(healthySnapshot.sourceHealth.nyFedPrimaryDealers, "OK");
  assert.equal(healthySnapshot.sourceHealth.treasuryBills, "OK");
  assert.equal(healthySnapshot.sourceHealth.treasurySupply, "UNRESOLVED"); // default when signal missing

  // Scenario B: Degraded Dossier, Partial Monitor, Partial FRED rates, Provider status pass-through
  const degradedPresentation = createBasePresentation();
  degradedPresentation.health.degraded = true;
  degradedPresentation.rateRegime.fredBacked = false;
  degradedPresentation.rateRegime.signals = [
    {
      key: "TREASURY_SUPPLY",
      label: "Treasury supply & auctions",
      state: "HAWKISH",
      score: 1,
      detail: "Heavy 10Y auction tail.",
      evidenceRefs: ["ev-auction-1"],
    },
  ];

  const partialSnapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation: degradedPresentation,
    monitor: createBaseMonitor({ limitations: ["Delayed Barchart connection"] }),
    nyFedReferenceRates: createBaseNyFedRates({ status: "PARTIAL" }),
    nyFedPrimaryDealers: createBaseDealers({ status: "UNAVAILABLE" }),
    treasuryBills: createBaseTreasuryBills({ status: "STALE" }),
  });

  assert.equal(partialSnapshot.sourceHealth.dossier, "DEGRADED");
  assert.equal(partialSnapshot.sourceHealth.marketMonitor, "PARTIAL");
  assert.equal(partialSnapshot.sourceHealth.fredRates, "PARTIAL");
  assert.equal(partialSnapshot.sourceHealth.nyFedReferenceRates, "PARTIAL");
  assert.equal(partialSnapshot.sourceHealth.nyFedPrimaryDealers, "UNAVAILABLE");
  assert.equal(partialSnapshot.sourceHealth.treasuryBills, "STALE");
  assert.equal(partialSnapshot.sourceHealth.treasurySupply, "OK");

  // Scenario C: Unavailable Market Monitor (0 rows)
  const unavailableMonitorSnapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation: createBasePresentation(),
    monitor: createBaseMonitor({ rows: [] }),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
  });

  assert.equal(unavailableMonitorSnapshot.sourceHealth.marketMonitor, "UNAVAILABLE");
});

test("3. Missing/ambiguous evidence, provider warnings, and UNRESOLVED semantics", () => {
  const presentation = createBasePresentation();
  presentation.health.researchGaps = [
    { id: "g1", category: "LIQUIDITY", severity: "MATERIAL", description: "RRP balance shift unresolved." },
  ];

  const nyFed = createBaseNyFedRates({
    warnings: ["NY Fed reference rates delay: latest XML missing TGCR."],
  });
  const dealers = createBaseDealers({
    warnings: ["Primary dealer snapshot published with preliminary numbers."],
  });
  const treasuryBills = createBaseTreasuryBills({
    warnings: ["Treasury yield curve feed required fallback."],
  });

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: nyFed,
    nyFedPrimaryDealers: dealers,
    treasuryBills,
  });

  // Verify researchGaps accumulates presentation gaps, provider warnings, and unresolved supply warning
  assert.ok(snapshot.researchGaps.includes("LIQUIDITY: RRP balance shift unresolved."));
  assert.ok(snapshot.researchGaps.includes("NY Fed reference rates delay: latest XML missing TGCR."));
  assert.ok(snapshot.researchGaps.includes("Primary dealer snapshot published with preliminary numbers."));
  assert.ok(snapshot.researchGaps.includes("Treasury yield curve feed required fallback."));
  assert.ok(snapshot.researchGaps.includes("Treasury supply/auction state is not yet resolved from verified Live rate evidence."));

  // Primary dealer signal remains UNRESOLVED and does not invent directional claims or evidence
  const dealerSignal = snapshot.monetarySignals.signals.find((s) => s.key === "DEALER_POSITIONING");
  assert.ok(dealerSignal);
  assert.equal(dealerSignal.direction, "UNRESOLVED");
  assert.equal(dealerSignal.confirmation, "UNRESOLVED");
  assert.deepEqual(dealerSignal.evidenceRefs, []);
  assert.ok(snapshot.monetarySignals.unresolved.includes("DEALER_POSITIONING"));
  assert.ok(!snapshot.monetarySignals.confirming.includes("DEALER_POSITIONING"));
  assert.ok(!snapshot.monetarySignals.contradicting.includes("DEALER_POSITIONING"));
});

test("4. Story and Motion separation and pass-through", () => {
  const presentation = createBasePresentation();
  const motionFixture: MarketMotionEditionAttachment & { editionId: string } = {
    editionId: "edition-20260925-01",
    contractVersion: "market-motion-edition/v1",
    capturedAt: "2026-09-25T08:10:00.000Z",
    researchRunId: "run-xyz-123",
    items: [
      {
        id: "motion-item-1",
        motionKey: "key-oil-spike",
        versionNumber: 1,
        headline: "Brent crude jumps 2.5% on Middle East supply friction",
        category: "MACRO",
        verificationState: "VERIFIED",
        lifecycleState: "PROMOTED",
        whatHappened: "Tanker route delay reported.",
        marketReaction: "Brent +$2.10/bbl",
        whyInteresting: "Direct energy inflation impulse",
        bigPictureBridge: "Feeds into headline CPI expectations",
        nextTest: "Weekly EIA inventory numbers",
        promotionReason: "Cross-asset spillover",
        tickers: ["BZ=F", "CL=F"],
        sourceName: "Reuters",
        sourceUrl: "https://example.com/reuters-oil",
        sourceKind: "reporting",
        materiality: 80,
        relevance: 85,
        novelty: 70,
        occurredAt: "2026-09-25T06:00:00.000Z",
        observedAt: "2026-09-25T06:15:00.000Z",
        expiresAt: "2026-09-26T06:00:00.000Z",
        storyId: "story-analytical-1",
        storySlug: "energy-inflation-impulse",
        storyTitle: "Persistent Story Title",
        regimeSlug: "global-cost-of-capital",
        regimeLabel: "US Rate Regime",
      },
    ],
  };

  const snapshotWithMotion = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
    marketMotion: motionFixture,
  });

  const snapshotWithoutMotion = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
    marketMotion: null,
  });

  // Verify Story pass-through
  assert.equal(snapshotWithMotion.stories.length, 1);
  const story = snapshotWithMotion.stories[0];
  assert.equal(story.id, "story-analytical-1");
  assert.equal(story.persistentStoryId, "uuid-story-persistent-1");
  assert.equal(story.title, "Persistent Story Title");
  assert.equal(story.epistemicLabel, "SUPPORTED");
  assert.deepEqual(story.evidenceRefs, ["ev-story-1"]);

  // Verify marketMotion attachment
  assert.equal(snapshotWithoutMotion.marketMotion, null);
  assert.ok(snapshotWithMotion.marketMotion);
  assert.equal(snapshotWithMotion.marketMotion.editionId, "edition-20260925-01");
  assert.equal(snapshotWithMotion.marketMotion.items[0].id, "motion-item-1");

  // Verify Market Motion presence does NOT alter Regime, Story, or Monetary confirmation
  assert.deepEqual(snapshotWithMotion.regime, snapshotWithoutMotion.regime);
  assert.deepEqual(snapshotWithMotion.stories, snapshotWithoutMotion.stories);
  assert.deepEqual(snapshotWithMotion.monetarySignals, snapshotWithoutMotion.monetarySignals);
});

test("5. Selected-row provenance, whitelist isolation, and structured clone immutability", () => {
  const monitor = createBaseMonitor();
  // Add unrelated rows that should be excluded from selectedRows
  monitor.rows.push(
    createMockRow("sp500", 5000, 1.0, "2026-09-24T22:00:00.000Z"),
    createMockRow("btc-usd", 60000, 3.5, "2026-09-24T22:00:00.000Z"),
    createMockRow("unrelated-random-id", 123, 0.0, "2026-09-24T22:00:00.000Z"),
  );

  const presentation = createBasePresentation();
  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor,
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
  });

  const selectedIds = snapshot.marketState.selectedRows.map((r) => r.id);
  assert.ok(selectedIds.includes("us2y"));
  assert.ok(selectedIds.includes("us10y-fred"));
  assert.ok(selectedIds.includes("dxy"));
  assert.ok(!selectedIds.includes("sp500"));
  assert.ok(!selectedIds.includes("btc-usd"));
  assert.ok(!selectedIds.includes("unrelated-random-id"));

  // Check selected row fields
  const dxyRow = snapshot.marketState.selectedRows.find((r) => r.id === "dxy")!;
  assert.equal(dxyRow.symbol, "DXY");
  assert.equal(dxyRow.label, "Label dxy");
  assert.equal(dxyRow.last, 104.5);
  assert.equal(dxyRow.change5d, 1.2);
  assert.equal(dxyRow.asOf, "2026-09-24T22:00:00.000Z");
  assert.equal(dxyRow.sourceName, "Market Dollar Index");
  assert.equal(dxyRow.sourceUrl, "https://example.com/dxy");

  // Verify structured clone immutability: mutating returned snapshot does not mutate input presentation
  snapshot.stories[0].title = "MUTATED_TITLE_IN_SNAPSHOT";
  snapshot.regime.headline = "MUTATED_HEADLINE_IN_SNAPSHOT";
  assert.equal(presentation.whatMattersNow.stories[0].title, "Persistent Story Title");
  assert.equal(presentation.header.headline, "Headline: Restrictive Stance Maintained");
});

test("6. Contradictions and gap deduplication", () => {
  const presentation = createBasePresentation({
    asOf: "2026-09-25T08:00:00.000Z",
  });
  // Baseline is HAWKISH.
  // USD change5d >= 1 => TIGHTER => CONFIRMING
  // Funding spread < -8 => EASIER => CONTRADICTING (derived monetary contradiction)
  const nyFedRates = createBaseNyFedRates({
    rates: [
      { type: "EFFR", effectiveDate: "2026-09-24", percentRate: 5.33, volumeInBillions: 100, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "SOFR", effectiveDate: "2026-09-24", percentRate: 5.20, volumeInBillions: 2100, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "TGCR", effectiveDate: "2026-09-24", percentRate: 5.20, volumeInBillions: 950, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
      { type: "BGCR", effectiveDate: "2026-09-24", percentRate: 5.20, volumeInBillions: 980, percentile1: null, percentile25: null, percentile75: null, percentile99: null },
    ],
  });

  const monitor = createBaseMonitor({
    contradictions: [
      {
        id: "explicit-monitor-1",
        title: "S&P vs Equal Weight divergence",
        detail: "Headline SPX outperforms RSP by 2%",
        assets: ["spx", "rsp"],
        priority: 70,
        researchQuestion: "Is breadth deteriorating?",
      },
    ],
  });

  // Duplicate warnings/gaps across inputs
  presentation.health.researchGaps = [
    { id: "g1", category: "RATES", severity: "MATERIAL", description: "Duplicate gap test description" },
  ];
  nyFedRates.warnings = ["Duplicate gap test warning"];
  const treasuryBills = createBaseTreasuryBills({
    warnings: ["Duplicate gap test warning"],
  });

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor,
    nyFedReferenceRates: nyFedRates,
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills,
  });

  // Check explicit monitor contradiction preserved
  const explicitC = snapshot.contradictions.find((c) => c.id === "explicit-monitor-1");
  assert.ok(explicitC);
  assert.equal(explicitC.title, "S&P vs Equal Weight divergence");
  assert.deepEqual(explicitC.assets, ["spx", "rsp"]);

  // Check derived monetary contradiction preserved as distinct entry
  const fundingC = snapshot.contradictions.find((c) => c.id === "monetary:funding");
  assert.ok(fundingC);
  assert.equal(fundingC.title, "Secured funding / collateral contradicts the current rate baseline");

  // Verify unresolved signals (like dealer signal) do NOT become contradictions
  assert.ok(!snapshot.contradictions.some((c) => c.id === "monetary:dealer_positioning"));

  // Check deduplication of researchGaps
  const duplicateGapCount = snapshot.researchGaps.filter((g) => g === "Duplicate gap test warning").length;
  assert.equal(duplicateGapCount, 1);
});
