import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketIntelligenceSnapshot,
  marketIntelligenceSuccessResponse,
  MARKET_INTELLIGENCE_SNAPSHOT_V1,
} from "../lib/market-intelligence-snapshot.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { StockRadarItem } from "../lib/dossier-v2/research-brain-contracts.ts";
import type { MarketMonitor } from "../lib/market-monitor.ts";
import type { MarketMotionEditionAttachment } from "../lib/market-motion-edition.ts";
import type { NyFedPrimaryDealerSnapshot } from "../lib/providers/ny-fed-primary-dealers.ts";
import type { NyFedReferenceRatesSnapshot } from "../lib/providers/ny-fed-reference-rates.ts";
import type { TreasuryBillSnapshot } from "../lib/providers/treasury-bills.ts";

function createBasePresentation(overrides: Partial<DossierPresentationV1> = {}): DossierPresentationV1 {
  return {
    contractVersion: "dossier-presentation/1",
    dossierId: "dossier-stock-radar-test-101",
    previousDossierId: "dossier-stock-radar-test-100",
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
      structuralPredecessorId: "dossier-stock-radar-test-100",
      analyticalBaselineId: "dossier-stock-radar-test-100",
      analyticalBaselineAsOf: "2026-09-24T08:00:00.000Z",
      sameAsStructuralPredecessor: true,
    },
    header: {
      headline: "Rates stance restrictive",
      answer: "Yields remain near highs",
      regimeImplication: "Tight financial conditions",
      regimeFamily: "RATES_LED_TIGHTENING",
      epistemicLabel: "SUPPORTED",
      whatWouldChangeMind: "Sustained fall in real yields",
    },
    regimeStrip: [],
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
      signals: [],
    },
    dollarLiquidity: null,
    policyLiquidityInteraction: null,
    whatMattersNow: {
      leadThreadId: "thread-rates-tightening-001",
      supportingStoryIds: ["story-oil-supply-friction-99"],
      stories: [
        {
          id: "story-oil-supply-friction-99",
          persistentStoryId: "uuid-story-oil-99",
          title: "Crude Supply Friction",
          whatChanged: "Middle East transit delays",
          whyItMatters: "Energy cost impulse",
          mechanism: "Supply bottleneck",
          conclusion: "Cost pressure stays elevated",
          whatWouldChangeMind: "De-escalation of transit friction",
          epistemicLabel: "SUPPORTED",
          evidenceRefs: ["ev-eia-oil-20260925"],
          investigationIds: [],
          chartIds: [],
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

function createBaseMonitor(): MarketMonitor {
  return {
    updatedAt: "2026-09-25T07:50:00.000Z",
    rows: [],
    breadth: [],
    contradictions: [],
    researchTriggers: [],
    limitations: [],
  };
}

function createBaseNyFedRates(): NyFedReferenceRatesSnapshot {
  return {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-24",
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: "https://markets.newyorkfed.org/api/rates/all/latest.json",
    rates: [],
    warnings: [],
  };
}

function createBaseDealers(): NyFedPrimaryDealerSnapshot {
  return {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-23",
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: "https://markets.newyorkfed.org/api/pd/get/latest.json",
    series: [],
    warnings: [],
  };
}

function createBaseTreasuryBills(): TreasuryBillSnapshot {
  return {
    status: "OK",
    fetchedAt: "2026-09-25T08:00:00Z",
    asOf: "2026-09-24",
    sourceName: "U.S. Department of the Treasury",
    sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026",
    points: [],
    warnings: [],
  };
}

const canonicalItem1: StockRadarItem = {
  symbol: "NVDA",
  company_name: "NVIDIA Corporation",
  why_relevant: "AI datacenter capex demand sensitivity to elevated rate regime",
  research_question: "Does hyperscaler capex guidance hold despite higher long-end Treasury yields?",
  linkage_type: "LINKED_MAIN_THREAD",
  linked_main_thread_or_story_id: "thread-rates-tightening-001",
  confirming_signal: "Cloud providers maintain quarterly capex expansion above $15B",
  invalidating_signal: "Major cloud customers report capex cuts or project delays",
  evidence_references: [
    "ev-capex-report-20260924",
    "nonstandard-custom-ref:sec-10q-nvda-p42",
  ],
};

const canonicalItem2: StockRadarItem = {
  symbol: "XOM",
  company_name: "Exxon Mobil Corporation",
  why_relevant: "Upstream energy cash-flow hedge against crude geopolitical supply friction",
  research_question: "Can free cash flow cover dividend growth if Brent stabilizes near $80?",
  linkage_type: "LINKED_MAJOR_STORY",
  linked_main_thread_or_story_id: "story-oil-supply-friction-99",
  confirming_signal: "Free cash flow yield remains above 8% at current oil strip",
  invalidating_signal: "Refining margins contract sharply due to weak industrial demand",
  evidence_references: [
    "ev-eia-oil-20260925",
    "custom-evidence-string-abc-xyz",
  ],
};

test("1. Stock Radar exact field pass-through and verbatim evidence ID preservation", () => {
  const presentation = createBasePresentation({
    stockRadar: [canonicalItem1, canonicalItem2],
  });

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
  });

  assert.equal(snapshot.stockRadar.length, 2, "Stock Radar array length must match input");

  const [item1, item2] = snapshot.stockRadar;

  // Item 1 assertions
  assert.equal(item1.symbol, "NVDA");
  assert.equal(item1.company_name, "NVIDIA Corporation");
  assert.equal(
    item1.why_relevant,
    "AI datacenter capex demand sensitivity to elevated rate regime",
  );
  assert.equal(
    item1.research_question,
    "Does hyperscaler capex guidance hold despite higher long-end Treasury yields?",
  );
  assert.equal(item1.linkage_type, "LINKED_MAIN_THREAD");
  assert.equal(item1.linked_main_thread_or_story_id, "thread-rates-tightening-001");
  assert.equal(
    item1.confirming_signal,
    "Cloud providers maintain quarterly capex expansion above $15B",
  );
  assert.equal(
    item1.invalidating_signal,
    "Major cloud customers report capex cuts or project delays",
  );
  assert.deepEqual(item1.evidence_references, [
    "ev-capex-report-20260924",
    "nonstandard-custom-ref:sec-10q-nvda-p42",
  ]);

  // Item 2 assertions
  assert.equal(item2.symbol, "XOM");
  assert.equal(item2.company_name, "Exxon Mobil Corporation");
  assert.equal(
    item2.why_relevant,
    "Upstream energy cash-flow hedge against crude geopolitical supply friction",
  );
  assert.equal(
    item2.research_question,
    "Can free cash flow cover dividend growth if Brent stabilizes near $80?",
  );
  assert.equal(item2.linkage_type, "LINKED_MAJOR_STORY");
  assert.equal(item2.linked_main_thread_or_story_id, "story-oil-supply-friction-99");
  assert.equal(
    item2.confirming_signal,
    "Free cash flow yield remains above 8% at current oil strip",
  );
  assert.equal(
    item2.invalidating_signal,
    "Refining margins contract sharply due to weak industrial demand",
  );
  assert.deepEqual(item2.evidence_references, [
    "ev-eia-oil-20260925",
    "custom-evidence-string-abc-xyz",
  ]);

  // Verify nonstandard string-valued evidence references are preserved verbatim without UUID generation
  assert.equal(item1.evidence_references[1], "nonstandard-custom-ref:sec-10q-nvda-p42");
  assert.equal(item2.evidence_references[1], "custom-evidence-string-abc-xyz");

  // Verify no invented recommendation, entry condition or speculative trades were synthesized
  const keys1 = Object.keys(item1).sort();
  assert.deepEqual(
    keys1,
    [
      "company_name",
      "confirming_signal",
      "evidence_references",
      "invalidating_signal",
      "linkage_type",
      "linked_main_thread_or_story_id",
      "research_question",
      "symbol",
      "why_relevant",
    ],
    "No extra fields or invented portfolio recommendations must be injected into StockRadarItem",
  );
});

test("2. Empty stockRadar stays explicitly empty without synthesizing candidates from other signals", () => {
  const presentation = createBasePresentation({
    stockRadar: [],
  });

  const motionFixture: MarketMotionEditionAttachment & { editionId: string } = {
    editionId: "edition-motion-test-01",
    contractVersion: "market-motion-edition/v1",
    capturedAt: "2026-09-25T08:10:00.000Z",
    researchRunId: "run-motion-123",
    items: [
      {
        id: "motion-item-oil",
        motionKey: "key-oil-spike",
        versionNumber: 1,
        headline: "Brent crude jumps on supply friction",
        category: "MACRO",
        verificationState: "VERIFIED",
        lifecycleState: "PROMOTED",
        whatHappened: "Tanker route delay reported.",
        marketReaction: "Brent +$2.10/bbl",
        whyInteresting: "Direct energy inflation impulse",
        bigPictureBridge: "Feeds into headline CPI expectations",
        nextTest: "Weekly EIA inventory numbers",
        promotionReason: "Cross-asset spillover",
        tickers: ["XOM", "CVX"],
        sourceName: "Reuters",
        sourceUrl: "https://example.com/reuters-oil",
        sourceKind: "reporting",
        materiality: 80,
        relevance: 85,
        novelty: 70,
        occurredAt: "2026-09-25T06:00:00.000Z",
        observedAt: "2026-09-25T06:15:00.000Z",
        expiresAt: "2026-09-26T06:00:00.000Z",
        storyId: "story-oil-supply-friction-99",
        storySlug: "energy-inflation-impulse",
        storyTitle: "Crude Supply Friction",
        regimeSlug: "global-cost-of-capital",
        regimeLabel: "US Rate Regime",
      },
    ],
  };

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
    creatorVerification: { status: "VERIFIED", creatorHandle: "@macrodesk" },
    marketMotion: motionFixture,
  });

  assert.ok(Array.isArray(snapshot.stockRadar));
  assert.equal(
    snapshot.stockRadar.length,
    0,
    "stockRadar must remain explicitly empty when presentation.stockRadar is empty",
  );
});

test("3. Deep clone isolation in both directions and side-effect free snapshot builder", () => {
  const originalPresentation = createBasePresentation({
    stockRadar: [
      JSON.parse(JSON.stringify(canonicalItem1)),
      JSON.parse(JSON.stringify(canonicalItem2)),
    ],
  });

  // Keep an independent JSON snapshot of the input presentation before builder invocation
  const preBuilderPresentationCopy = JSON.parse(JSON.stringify(originalPresentation));

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation: originalPresentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
  });

  // Verify builder did NOT mutate the input presentation during execution
  assert.deepEqual(
    originalPresentation,
    preBuilderPresentationCopy,
    "builder must have zero side-effects on input presentation during construction",
  );

  // Assert structural equality but NOT object identity
  assert.deepEqual(
    snapshot.stockRadar,
    originalPresentation.stockRadar,
    "snapshot.stockRadar must be structurally equal to presentation.stockRadar",
  );
  assert.notEqual(
    snapshot.stockRadar,
    originalPresentation.stockRadar,
    "snapshot.stockRadar array reference must not be aliased to presentation.stockRadar",
  );
  assert.notEqual(
    snapshot.stockRadar[0],
    originalPresentation.stockRadar[0],
    "snapshot Stock Radar items must not be object-aliased to presentation items",
  );
  assert.notEqual(
    snapshot.stockRadar[0].evidence_references,
    originalPresentation.stockRadar[0].evidence_references,
    "nested evidence_references arrays must not be reference-aliased",
  );

  // Direction A: Mutating output snapshot nested evidence array or fields does NOT mutate presentation
  snapshot.stockRadar[0].evidence_references.push("ev-mutated-output-only");
  snapshot.stockRadar[0].symbol = "MUTATED_SYMBOL";

  assert.equal(
    originalPresentation.stockRadar[0].symbol,
    "NVDA",
    "Mutating output stockRadar item symbol must not mutate canonical presentation",
  );
  assert.deepEqual(
    originalPresentation.stockRadar[0].evidence_references,
    ["ev-capex-report-20260924", "nonstandard-custom-ref:sec-10q-nvda-p42"],
    "Mutating output nested evidence_references array must not mutate presentation",
  );

  // Direction B: Modifying presentation after snapshot construction does NOT retroactively mutate snapshot
  originalPresentation.stockRadar[1].evidence_references.push("ev-mutated-presentation-only");
  originalPresentation.stockRadar[1].symbol = "PRESENTATION_MUTATED";

  assert.equal(
    snapshot.stockRadar[1].symbol,
    "XOM",
    "Modifying presentation symbol post-construction must not retroactively mutate snapshot",
  );
  assert.deepEqual(
    snapshot.stockRadar[1].evidence_references,
    ["ev-eia-oil-20260925", "custom-evidence-string-abc-xyz"],
    "Modifying presentation evidence_references post-construction must not retroactively mutate snapshot",
  );
});

test("4. Full stockRadar JSON survives marketIntelligenceSuccessResponse HTTP serialization unchanged", async () => {
  const presentation = createBasePresentation({
    stockRadar: [canonicalItem1, canonicalItem2],
  });

  const snapshot = buildMarketIntelligenceSnapshot({
    status: "current",
    presentation,
    monitor: createBaseMonitor(),
    nyFedReferenceRates: createBaseNyFedRates(),
    nyFedPrimaryDealers: createBaseDealers(),
    treasuryBills: createBaseTreasuryBills(),
  });

  const response = marketIntelligenceSuccessResponse(snapshot);

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("X-Alchemy-Market-Intelligence"),
    MARKET_INTELLIGENCE_SNAPSHOT_V1,
  );

  const jsonBody = await response.json();

  assert.ok(Array.isArray(jsonBody.stockRadar));
  assert.equal(jsonBody.stockRadar.length, 2);
  assert.deepEqual(
    jsonBody.stockRadar,
    snapshot.stockRadar,
    "stockRadar payload in HTTP 200 response must survive serialization completely unchanged",
  );
  assert.deepEqual(
    jsonBody.stockRadar[0].evidence_references,
    [
      "ev-capex-report-20260924",
      "nonstandard-custom-ref:sec-10q-nvda-p42",
    ],
    "ordered evidence_references array must survive HTTP serialization verbatim",
  );
});
