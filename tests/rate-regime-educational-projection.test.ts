import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { RegimeExplanation } from "../lib/regime-explanations.ts";
import type { RoutedDossierInvestigation } from "../lib/regime-investigations.ts";
import {
  buildRateEducationalProjection,
  RATE_EDUCATIONAL_PROJECTION_VERSION,
} from "../lib/rate-regime-educational-projection.ts";
import type { ProjectedRegime, ProjectedRegimeSubgroup, ProjectedStory } from "../lib/regimes.ts";

const story: ProjectedStory = {
  id: "story-rates",
  slug: "fed-long-end-stress",
  title: "Long-end Treasury pressure",
  thesis: "Long yields remain restrictive despite softer policy pressure.",
  question: "Why is the long end refusing to ease?",
  confidence: 82,
  lifecycle: "active",
  editorialVerdict: "persist",
  assets: ["US02Y", "US10Y", "US30Y"],
  versionId: "story-version-2",
  versionNumber: 2,
  routes: [
    { regime: "global-cost-of-capital", subgroup: "long-end", role: "core", score: 100 },
    { regime: "global-cost-of-capital", subgroup: "fed-front-end", role: "bridge", score: 80 },
  ],
  maturity: "durable",
  contributesToState: true,
  maturityReason: "Accepted persistent Story.",
  hybridHref: "/hybrid-output?story=fed-long-end-stress",
};

function subgroup(
  key: string,
  label: string,
  state: string,
  stateKind: ProjectedRegimeSubgroup["stateKind"],
  detail: string,
): ProjectedRegimeSubgroup {
  return {
    key,
    label,
    accent: key === "long-end" ? "orange" : "blue",
    whyItMatters: `${label} matters for the rates transmission chain.`,
    mechanism: `${label} mechanism.`,
    state,
    stateKind,
    stories: key === "long-end" || key === "fed-front-end" ? [story] : [],
    durableStories: key === "long-end" || key === "fed-front-end" ? [story] : [],
    contextStories: [],
    nodes: [],
    telemetry: [{
      key: key.toUpperCase(),
      label,
      state,
      detail,
      asOf: "2026-10-03T01:00:00.000Z",
      source: "rate-regime/1",
    }],
    latestAt: "2026-10-03T01:00:00.000Z",
  };
}

function ratesRegime(): ProjectedRegime {
  return {
    slug: "global-cost-of-capital",
    title: "Sovereign Funding & Global Cost of Capital",
    shortTitle: "Cost of Capital",
    coreQuestion: "Can the economy absorb high financing costs?",
    whyItMatters: "Rates feed borrowing costs, housing, credit and valuation.",
    mechanism: "Policy + supply + inflation → yields → borrowing costs.",
    affectedMarkets: ["US02Y", "US10Y", "US30Y"],
    state: "Rates mixed · broader funding partial",
    stateKind: "unresolved",
    confidence: "PARTIAL · rates MEDIUM",
    asOf: "2026-10-03T01:05:00.000Z",
    stories: [story],
    durableStories: [story],
    contextStories: [],
    dossierContext: [],
    latestNode: {
      id: "news:nfp",
      title: "Weak payrolls reduce near-term Fed pressure",
      detail: "The labour release was softer, while the long end later failed to hold its rally.",
      timestamp: "2026-10-03T00:55:00.000Z",
      state: "interpretation_pending",
      sourceKind: "news",
      verification: "reporting",
      storyId: null,
      storySlug: null,
      href: "https://example.com/nfp",
      hybridHref: null,
    },
    subgroups: [
      subgroup("fed-front-end", "Fed / Front End", "Easing", "system1", "2Y pricing eased after the labour release."),
      subgroup("treasury-fiscal", "Treasury / Fiscal", "Active / unresolved", "interpreted", "Supply remains a live Story question."),
      subgroup("long-end", "Long End / Term Premium", "Restrictive / tighter", "system1", "10Y/30Y pressure remains elevated."),
      subgroup("global-rates", "Global Rates / Japan", "Unresolved", "unresolved", "Global confirmation is incomplete."),
      subgroup("credit-financing", "Credit / Financing", "Contained", "system1", "Credit stress is not yet confirming a broader break."),
      subgroup("housing", "Housing / Real Economy", "Restrictive", "interpreted", "Mortgage-rate transmission remains restrictive."),
    ],
    hybridHref: "/hybrid-output?regime=global-cost-of-capital",
  };
}

const explanation: RegimeExplanation = {
  plainEnglish: "This Regime is about the price of money and how expensive long-term borrowing affects the economy.",
  counterfactual: "The structural pressure weakens if long yields, real yields and financing costs fall sustainably.",
  chains: [],
  concepts: [],
};

function investigation(): RoutedDossierInvestigation {
  return {
    id: "inv-rates",
    status: "open",
    question: "Why did long yields fail to stay down after weak payrolls?",
    whyItMatters: "It separates the Fed path from structural duration pressure.",
    currentExplanation: "Near-term Fed pressure eased, but the long end still faces unresolved structural duration pressure.",
    expectedReaction: "2Y should fall most, with 10Y and 30Y also easing.",
    observedReaction: "2Y fell, but the long end later reversed higher.",
    divergence: "MATERIAL",
    competingExplanations: ["Treasury supply", "global duration"],
    candidateExplanations: [{
      rank: 1,
      explanation: "Term-premium and supply pressure offset the dovish policy impulse.",
      evidenceForRefs: ["ev:long-end"],
      evidenceAgainstRefs: [],
      confidence: "MEDIUM",
      discriminatingTest: "Check real yields, term premium, auctions and global long yields.",
    }],
    researchNext: "Separate real-yield, supply and global-duration contributions.",
    confirmationCondition: "Long yields remain high while front-end policy pricing continues to ease.",
    invalidationCondition: "10Y/30Y fall sustainably alongside lower real yields and term premium.",
    evidenceRefs: ["ev:nfp", "ev:long-end"],
    missingEvidence: ["term premium"],
    chartIds: [],
    storyIds: ["story-rates"],
    thesisIds: [],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "DIVERGENT",
      precision: "INTRADAY",
      checkCount: 1,
      alignedCount: 0,
      divergentCount: 1,
      reactionWindows: ["5m", "close"],
      expectationChanged: false,
      requiresReview: true,
    },
    journey: {
      currentId: "inv-rates",
      previousId: "inv-rates",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "NONE",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Weak payrolls should lower yields, led by the 2Y.",
      currentExpectedReaction: "2Y should fall most, with 10Y and 30Y also easing.",
      expectationChanged: true,
      question: "Why did long yields fail to stay down after weak payrolls?",
    },
    regimeRoutes: [
      { regime: "global-cost-of-capital", subgroup: "long-end", role: "core", score: 100 },
    ],
    regimeRoutingStoryIds: ["story:duration-broadening"],
  };
}

test("rates educational projection gives a two-sentence layman read from canonical state", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  });

  assert.ok(projection);
  assert.equal(projection.contractVersion, RATE_EDUCATIONAL_PROJECTION_VERSION);
  assert.equal(projection.quickRead.length, 2);
  assert.match(projection.quickRead[0], /Short-term Fed-sensitive rates are easing/);
  assert.match(projection.quickRead[0], /longer-term Treasury pressure is still tight/);
  assert.match(projection.quickRead[1], /current accepted explanation/);
  assert.equal(projection.dossierId, "dossier-12345678");
});

test("latest unpromoted news is visible as observed input but never treated as accepted causal explanation", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.latestCatalyst?.interpretationPending, true);
  assert.match(projection.adaptiveExplanation[0]?.text ?? "", /not yet been promoted into an accepted causal explanation/);
  assert.equal(projection.dominantDriver?.subgroupKey, "long-end");
});

test("adaptive explanation preserves prior expectation, observed tape and exact canonical test", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  const expected = projection.adaptiveExplanation.find((item) => item.key === "expected");
  const observed = projection.adaptiveExplanation.find((item) => item.key === "observed");
  const changes = projection.adaptiveExplanation.find((item) => item.key === "what_changes_view");

  assert.equal(expected?.text, "Weak payrolls should lower yields, led by the 2Y.");
  assert.match(observed?.text ?? "", /long end later reversed higher/);
  assert.match(changes?.text ?? "", /Confirm:/);
  assert.match(changes?.text ?? "", /Invalidate:/);
  assert.equal(projection.currentTest?.candidateCount, 1);
});

test("gold cross-check reuses canonical DXY and XAUUSD reaction checks without inferring causality", () => {
  const item = investigation();
  item.reactionChecks = [
    {
      checkId: "system1:soft-inflation:dxy",
      triggerEvidenceRef: "ev:soft-inflation",
      marketEvidenceRef: "ev:dxy-reaction",
      instrument: "DXY",
      expectedDirection: "DOWN",
      observedDirection: "UP",
      observedChangePct: 0.6,
      observedInstrument: "UUP",
      isProxy: true,
      reactionWindow: "30m",
      reactionPath: [],
      relation: "DIVERGENT",
      timingPrecision: "INTRADAY",
    },
    {
      checkId: "system1:soft-inflation:gold",
      triggerEvidenceRef: "ev:soft-inflation",
      marketEvidenceRef: "ev:gold-reaction",
      instrument: "XAUUSD",
      expectedDirection: "UP",
      observedDirection: "DOWN",
      observedChangePct: -0.8,
      observedInstrument: "GLD",
      isProxy: true,
      reactionWindow: "30m",
      reactionPath: [],
      relation: "DIVERGENT",
      timingPrecision: "INTRADAY",
    },
  ];

  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [item],
    dossier: { dossierId: "dossier-gold", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.ok(projection.goldCrossCheck);
  assert.equal(projection.goldCrossCheck?.realYield10y, null);
  assert.equal(projection.goldCrossCheck?.dxyReaction?.observedInstrument, "UUP");
  assert.equal(projection.goldCrossCheck?.dxyReaction?.relation, "DIVERGENT");
  assert.equal(projection.goldCrossCheck?.goldReaction?.observedInstrument, "GLD");
  assert.equal(projection.goldCrossCheck?.goldReaction?.observedChangePct, -0.8);
  assert.deepEqual(projection.goldCrossCheck?.coverage.missing, ["10Y real yield"]);
});

test("growth-semis cross-check uses SMH without broadening it into QQQ or broad equities", () => {
  const item = investigation();
  item.reactionChecks = [{
    checkId: "system1:soft-inflation:smh",
    triggerEvidenceRef: "ev:soft-inflation",
    marketEvidenceRef: "ev:smh-reaction",
    instrument: "SMH",
    expectedDirection: "UP",
    observedDirection: "DOWN",
    observedChangePct: -1.4,
    observedInstrument: "SMH",
    isProxy: false,
    reactionWindow: "30m",
    reactionPath: [],
    relation: "DIVERGENT",
    timingPrecision: "INTRADAY",
  }];

  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [item],
    dossier: { dossierId: "dossier-smh", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.ok(projection.growthSemisCrossCheck);
  assert.equal(projection.growthSemisCrossCheck?.realYield10y, null);
  assert.equal(projection.growthSemisCrossCheck?.smhReaction?.observedInstrument, "SMH");
  assert.equal(projection.growthSemisCrossCheck?.smhReaction?.observedChangePct, -1.4);
  assert.deepEqual(projection.growthSemisCrossCheck?.coverage.missing, ["10Y real yield"]);
});

test("credit and funding remain separate canonical transmission rows", () => {
  const regime = ratesRegime();
  const credit = regime.subgroups.find((item) => item.key === "credit-financing");
  assert.ok(credit);
  credit.telemetry = [
    {
      key: "LIQUIDITY_FUNDING",
      label: "Secured funding",
      state: "NEUTRAL",
      detail: "Secured overnight rates are +0.5 bp versus EFFR.",
      asOf: "2026-10-03T01:00:00.000Z",
      source: "system1-dollar-liquidity/1",
    },
    {
      key: "LIQUIDITY_CREDIT",
      label: "Credit transmission",
      state: "TIGHTER",
      detail: "HY OAS 5D +18.0 bp; IG OAS 5D +5.0 bp.",
      asOf: "2026-10-03T01:00:00.000Z",
      source: "system1-dollar-liquidity/1",
    },
  ];

  const projection = buildRateEducationalProjection({
    regime,
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-credit", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.creditFunding?.funding?.state, "NEUTRAL");
  assert.match(projection.creditFunding?.funding?.detail ?? "", /Secured overnight rates/);
  assert.equal(projection.creditFunding?.credit?.state, "TIGHTER");
  assert.match(projection.creditFunding?.credit?.detail ?? "", /HY OAS 5D \+18\.0 bp/);
  assert.deepEqual(projection.creditFunding?.coverage.missing, []);
});

test("state board keeps row-level System 1 / System 2 / unresolved ownership", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.stateBoard.length, 6);
  assert.equal(projection.stateBoard.find((row) => row.key === "fed-front-end")?.stateKind, "system1");
  assert.equal(projection.stateBoard.find((row) => row.key === "treasury-fiscal")?.stateKind, "interpreted");
  assert.equal(projection.stateBoard.find((row) => row.key === "global-rates")?.stateKind, "unresolved");
});

test("projection fails closed when the current Dossier has no exact linked investigation", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.currentTest, null);
  assert.equal(projection.dominantDriver, null);
  assert.equal(projection.goldCrossCheck, null);
  assert.equal(projection.growthSemisCrossCheck, null);
  assert.match(projection.quickRead[1], /still being tested rather than assumed/);
});

test("educational projection is rates-specific and does not manufacture a second Regime", () => {
  const regime = { ...ratesRegime(), slug: "equity-rally-quality" as const };
  assert.equal(buildRateEducationalProjection({
    regime,
    explanation,
    investigations: [],
    dossier: null,
  }), null);
});

test("Live and Hybrid render the same shared educational projection instead of computing separate rates reads", () => {
  const livePage = readFileSync(new URL("../app/regimes/[slug]/page.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/live-desk/RateRegimeEducationalShell.tsx", import.meta.url), "utf8");
  const hybrid = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  const projectionSource = readFileSync(new URL("../lib/rate-regime-educational-projection.ts", import.meta.url), "utf8");

  assert.match(livePage, /buildRateEducationalProjection/);
  assert.match(workspace, /RateRegimeEducationalShell/);
  assert.match(shell, /CREDIT \/ FUNDING TRANSMISSION · SYSTEM 1/);
  assert.match(shell, /projection\.creditFunding/);
  assert.match(shell, /GROWTH \/ SEMIS CROSS-CHECK · CANONICAL REACTION AUDIT/);
  assert.match(shell, /not being presented as QQQ, NDX or broad-equity confirmation/);
  assert.match(shell, /projection\.growthSemisCrossCheck/);
  assert.match(shell, /GOLD CROSS-CHECK · CANONICAL REACTION AUDIT/);
  assert.match(shell, /projection\.goldCrossCheck/);
  assert.match(hybrid, /buildRateEducationalProjection/);
  assert.match(hybrid, /RateRegimeEducationalShell/);
  assert.doesNotMatch(projectionSource, /fetch\(|createSupabaseAdminClient|executeResearchBrain|runIntelligenceEngine/);
  assert.doesNotMatch(hybrid, /buildDossierRateRegime/);
});


test("educational projection exposes the canonical rate path when the Dossier contains the curve diagnostic", () => {
  const baseRegime = ratesRegime();
  const projection = buildRateEducationalProjection({
    regime: baseRegime,
    explanation,
    investigations: [investigation()],
    dossier: {
      dossierId: "dossier-curve",
      asOf: "2026-10-03T01:05:00.000Z",
      rateRegime: {
        state: "MIXED",
        nextMeetingRateOutlook: "MORE_DOVISH",
        fedWatchExpectedDirection: "HIKE_ODDS_DOWN",
        trigger: null,
        observedRatePricing: null,
        observedConfirmation: null,
        usRatesReaction: null,
        usRatesInterpretation: null,
        fredBacked: true,
        evidenceRefs: ["market-monitor:us2y:2026-10-03", "market-monitor:us10y:2026-10-03"],
        gaps: [],
        curveDiagnostic: {
          contractVersion: "rate-curve-diagnostic/1",
          asOf: "2026-10-03T01:05:00.000Z",
          points: [
            { maturity: "2Y", yieldPct: 4.72, change5dBp: -18, direction5d: "DOWN", levelEvidenceRef: "market-monitor:us2y:2026-10-03", changeEvidenceRef: "market-monitor:us2y:2026-10-03" },
            { maturity: "5Y", yieldPct: 4.90, change5dBp: -10, direction5d: "DOWN", levelEvidenceRef: "market-monitor:us5y-fred:2026-10-03", changeEvidenceRef: "market-monitor:us5y-fred:2026-10-03" },
            { maturity: "10Y", yieldPct: 5.26, change5dBp: 6, direction5d: "UP", levelEvidenceRef: "market-monitor:us10y:2026-10-03", changeEvidenceRef: "market-monitor:us10y:2026-10-03" },
            { maturity: "20Y", yieldPct: 5.60, change5dBp: 5, direction5d: "UP", levelEvidenceRef: "market-monitor:us20y-fred:2026-10-03", changeEvidenceRef: "market-monitor:us20y-fred:2026-10-03" },
            { maturity: "30Y", yieldPct: 5.66, change5dBp: 6, direction5d: "UP", levelEvidenceRef: "market-monitor:us30y-fred:2026-10-03", changeEvidenceRef: "market-monitor:us30y-fred:2026-10-03" },
          ],
          spreads: [
            { key: "2s5s", bps: 18, change5dBp: 8 },
            { key: "2s10s", bps: 54, change5dBp: 24 },
            { key: "2s20s", bps: 88, change5dBp: 23 },
            { key: "2s30s", bps: 94, change5dBp: 24 },
            { key: "5s10s", bps: 36, change5dBp: 16 },
            { key: "5s30s", bps: 76, change5dBp: 16 },
            { key: "10s30s", bps: 40, change5dBp: 0 },
          ],
          shape: "POSITIVE",
          moveClass: "DIVERGENT_STEEPENING",
          separationState: "FRONT_END_EASING_LONG_END_STICKY",
          frontEndDirection: "DOWN",
          longEndDirection: "UP",
          frontEndChange5dBp: -18,
          longEndAverageChange5dBp: 5.7,
          detail: "2Y eased while the long end rose.",
          evidenceRefs: ["market-monitor:us2y:2026-10-03", "market-monitor:us10y:2026-10-03"],
          coverage: { present: 5, total: 5, missing: [] },
        },
      },
    },
  });

  assert.ok(projection?.ratePath);
  assert.equal(projection.ratePath?.moveClass, "DIVERGENT_STEEPENING");
  assert.equal(projection.ratePath?.separationState, "FRONT_END_EASING_LONG_END_STICKY");
  assert.equal(projection.ratePath?.points.length, 5);
  assert.equal(projection.ratePath?.spreads.find((item) => item.key === "2s30s")?.bps, 94);
});

test("historical educational projection stays valid when an old Dossier has no curve diagnostic", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [],
    dossier: {
      dossierId: "historical-pre-curve",
      asOf: "2026-09-20T01:05:00.000Z",
    },
  });

  assert.ok(projection);
  assert.equal(projection.ratePath, null);
  assert.equal(projection.globalDuration, null);
  assert.equal(projection.dossierId, "historical-pre-curve");
});


test("educational projection exposes observed long-end decomposition while preserving unresolved mechanisms", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: {
      dossierId: "dossier-long-end",
      asOf: "2026-10-03T01:05:00.000Z",
      rateRegime: {
        state: "MIXED",
        nextMeetingRateOutlook: "MORE_DOVISH",
        fedWatchExpectedDirection: "HIKE_ODDS_DOWN",
        trigger: null,
        observedRatePricing: null,
        observedConfirmation: null,
        usRatesReaction: null,
        usRatesInterpretation: null,
        fredBacked: true,
        evidenceRefs: ["market-monitor:us10y:2026-10-03"],
        gaps: [],
        longEndDiagnostic: {
          contractVersion: "rate-long-end-diagnostic/1",
          asOf: "2026-10-03T01:05:00.000Z",
          nominal10y: { levelPct: 5.30, change5dBp: 10, evidenceRef: "market-monitor:us10y:2026-10-03" },
          real10y: { levelPct: 2.30, change5dBp: 8, evidenceRef: "market-monitor:us10y-real:2026-10-03" },
          breakeven10y: { levelPct: 3.00, change5dBp: 2, evidenceRef: "market-monitor:us10y-breakeven:2026-10-03" },
          observedDecomposition: {
            state: "REAL_YIELD_LED",
            accountedChangeBp: 10,
            residualBp: 0,
            detail: "Observed real yields account for most of the move.",
          },
          termPremium: {
            availability: "UNRESOLVED",
            levelPct: null,
            change5dBp: null,
            evidenceRef: null,
            detail: "Term premium is unresolved.",
          },
          marketStructure: {
            treasurySupplyEvidenceRef: null,
            dealerEvidenceRef: "system1-dollar:dealer-balance-sheet:2026-10-01",
            auctionEvidenceRef: null,
            dealerNetPositionMillions: 125000,
            dealerNetPositionWeeklyChangeMillions: 15000,
            failsDeliverMillions: 28000,
            failsReceiveMillions: 24000,
            detail: "Dealer evidence is observed but direction remains uninterpreted.",
          },
          volatility: {
            moveEvidenceRef: null,
            level: null,
            change5dPct: null,
            detail: "MOVE is unresolved.",
          },
          evidenceRefs: ["market-monitor:us10y:2026-10-03"],
          gaps: ["No governed term-premium observation is present.", "MOVE is unavailable."],
        },
      },
    },
  });

  assert.ok(projection?.longEnd);
  assert.equal(projection.longEnd?.observedState, "REAL_YIELD_LED");
  assert.equal(projection.longEnd?.residualBp, 0);
  assert.equal(projection.longEnd?.termPremiumAvailability, "UNRESOLVED");
  assert.match(projection.longEnd?.marketStructureDetail ?? "", /uninterpreted/i);
  assert.equal(projection.goldCrossCheck?.realYield10y?.levelPct, 2.30);
  assert.equal(projection.goldCrossCheck?.realYield10y?.change5dBp, 8);
  assert.deepEqual(projection.goldCrossCheck?.coverage.missing, ["DXY reaction", "Gold reaction"]);
  assert.equal(projection.growthSemisCrossCheck?.realYield10y?.levelPct, 2.30);
  assert.deepEqual(projection.growthSemisCrossCheck?.coverage.missing, ["SMH reaction"]);
});


test("educational projection keeps daily JGB, daily USDJPY, monthly TIC and weekly MOF flows distinct", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: {
      dossierId: "dossier-global-rates",
      asOf: "2026-10-03T01:05:00.000Z",
      rateRegime: {
        state: "MIXED",
        nextMeetingRateOutlook: "MORE_DOVISH",
        fedWatchExpectedDirection: "HIKE_ODDS_DOWN",
        trigger: null,
        observedRatePricing: null,
        observedConfirmation: null,
        usRatesReaction: null,
        usRatesInterpretation: null,
        fredBacked: true,
        evidenceRefs: ["global-rates:jgb:2026-10-01", "global-rates:tic:2026-07"],
        gaps: [],
        globalDurationDiagnostic: {
          contractVersion: "rate-global-duration-diagnostic/1",
          asOf: "2026-10-03T01:05:00.000Z",
          japanRates: {
            asOf: "2026-10-01",
            jgb2yPct: 2.2,
            jgb10yPct: 3,
            jgb30yPct: 3.4,
            jgb2yChange5dBp: 5,
            jgb10yChange5dBp: 8,
            jgb30yChange5dBp: 9,
            evidenceRef: "global-rates:jgb:2026-10-01",
          },
          relativeRates: {
            ustJgb2yBp: 250,
            ustJgb10yBp: 230,
            ustJgb30yBp: 230,
            ustJgb2yChange5dBp: -25,
            ustJgb10yChange5dBp: 2,
            ustJgb30yChange5dBp: 1,
            state: "US_JAPAN_TIGHTENING",
            globalLabelEligible: false,
            comparisonWindowAligned: false,
            detail: "US and Japan long ends are both tightening; Bund/gilt confirmation is incomplete.",
          },
          fx: {
            usdJpy: 147.5,
            change5dPct: 1.72,
            evidenceRef: "market-monitor:usdjpy:2026-10-03",
            detail: "USDJPY 147.500; 5D +1.72%.",
          },
          foreignTreasuryDemand: {
            period: "2026-07",
            japanHoldingsUsdBn: 1103.9,
            japanPreviousUsdBn: 1116.7,
            japanMonthlyChangeUsdBn: -12.8,
            japanHoldingsDirection: "DECREASED",
            totalForeignHoldingsUsdBn: 9500,
            foreignOfficialHoldingsUsdBn: 3900,
            custodyAttributionCaveat: "Custody location may not equal beneficial owner.",
            evidenceRef: "global-rates:tic:2026-07",
            detail: "TIC Japan Treasury holdings decreased month over month.",
          },
          japanPortfolioFlows: {
            periodLabel: "2026/09/20-2026/09/26",
            outwardLongTermDebtNetPurchaseJpyBn: 420,
            outwardTotalNetPurchaseJpyBn: 500,
            direction: "NET_PURCHASE",
            treasurySpecific: false,
            evidenceRef: "global-rates:japan-mof-flows:2026-09-20-09-26",
            detail: "Japan residents were net buyers of foreign long-term debt securities, not Treasuries specifically.",
          },
          comparability: {
            canCompareTicAndWeeklyMofAsSameFlow: false,
            detail: "TIC is monthly Treasury holdings; MOF is weekly foreign securities transactions. Do not merge them.",
          },
          evidenceRefs: ["global-rates:jgb:2026-10-01", "global-rates:tic:2026-07"],
          gaps: ["Comparable Bund long-end evidence is missing.", "Comparable gilt long-end evidence is missing."],
        },
      },
    },
  });

  assert.ok(projection?.globalDuration);
  assert.equal(projection.globalDuration?.state, "US_JAPAN_TIGHTENING");
  assert.equal(projection.globalDuration?.globalLabelEligible, false);
  assert.equal(projection.globalDuration?.tic.period, "2026-07");
  assert.equal(projection.globalDuration?.tic.japanMonthlyChangeUsdBn, -12.8);
  assert.equal(projection.globalDuration?.japanFlows.periodLabel, "2026/09/20-2026/09/26");
  assert.equal(projection.globalDuration?.japanFlows.outwardLongTermDebtNetPurchaseJpyBn, 420);
  assert.match(projection.globalDuration?.comparabilityDetail ?? "", /Do not merge/i);
});
