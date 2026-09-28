import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  buildDossierV2Presentation,
  DOSSIER_PRESENTATION_V1,
} from "../lib/dossier-v2/presentation-adapter.ts";

function output(overrides: Partial<ResearchBrainOutputV1> = {}): ResearchBrainOutputV1 {
  return {
    contract_version: "research-brain/1",
    packet_id: "packet-1",
    as_of: "2026-09-21T12:45:41.378Z",
    main_thread: {
      thread_id: "thread-1",
      headline: "Energy, rates and semis define the current regime.",
      answer: "WTI is strong, yields are elevated and semiconductors are outperforming.",
      regime_implication: "Inflation pressure and narrow equity leadership remain the main transmission paths.",
      regime_family: "RATES_LED_TIGHTENING",
      epistemic_label: "SUPPORTED",
      evidence_references: ["ev-wti", "ev-us10y", "ev-smh"],
      supporting_story_ids: ["story-1"],
      contradiction_references: [],
      what_would_change_mind: "Falling energy and yields would weaken the regime.",
    },
    major_stories: [{
      story_id: "story-1",
      title: "Energy strength",
      what_changed: "WTI and distillates rose.",
      why_it_matters: "Energy can feed inflation.",
      headline_decomposition: "WTI and ULSD are both higher.",
      causal_mechanism: "Tighter refined products can lift energy inflation.",
      market_evidence: {
        confirming: ["ev-wti"],
        contradicting: [],
        unresolved: [],
      },
      conclusion: "Energy remains firm.",
      what_would_change_mind: "A multi-day reversal.",
      linked_thesis_ids: ["thesis-1"],
      linked_investigation_ids: ["inv-1"],
      linked_chart_task_ids: ["chart-1"],
      epistemic_label: "OBSERVED",
      evidence_ids: ["ev-wti"],
    }],
    chart_investigation_queue: {
      core: [{
        chart_id: "chart-1",
        priority: "HIGH",
        is_required: true,
        ticker_or_instrument: "WTI,ULSD",
        instrument_type: "COMMODITY",
        timeframe: "1M daily",
        exact_question: "Is refined-product strength persisting?",
        confirmation_condition: "WTI and ULSD remain firm.",
        contradiction_condition: "Both reverse.",
        linked_story_ids: ["story-1"],
        linked_investigation_ids: ["inv-1"],
      }],
      optional: [],
    },
    investigations: [{
      investigation_id: "inv-1",
      question: "Is the energy move physical or positioning-driven?",
      why_it_matters: "Persistence depends on the driver.",
      current_explanation: "Physical tightness is plausible.",
      expected_reaction: null,
      observed_reaction: null,
      divergence: "UNRESOLVED",
      competing_explanations: ["Positioning"],
      observed_evidence: ["ev-wti"],
      missing_evidence: ["Inventories"],
      research_next: "Fetch EIA inventories.",
      chart_task_links: ["chart-1"],
      confirmation_condition: "Inventories draw.",
      invalidation_condition: "Inventories build.",
      status: "open",
      linked_story_ids: ["story-1"],
      linked_thesis_ids: ["thesis-1"],
      leads_referenced: [],
    }],
    market_verdict: {
      verdict_id: "verdict-1",
      lenses: {
        US_RATES: {
          lens_name: "US_RATES",
          observed_reaction: "10Y elevated",
          observed_reaction_evidence_refs: ["market-monitor:us2y:2026-09-21", "ev-us10y"],
          interpretation: "Rates remain restrictive.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        GOLD: {
          lens_name: "GOLD",
          observed_reaction: null,
          observed_reaction_evidence_refs: [],
          interpretation: "No direct XAUUSD observation.",
          contradiction_references: [],
          unresolved_signals: ["direct spot gold missing"],
        },
      },
      cross_asset_readthrough: "Energy and rates dominate.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "WTI and yields are elevated.",
      dominant_contradiction: "None.",
    },
    research_now: [{
      rank: 1,
      action: "Fetch EIA inventories.",
      reason: "Resolve the energy driver.",
      expected_information_gain: "High",
      linked_investigations: ["inv-1"],
      linked_stories: ["story-1"],
      blocking_evidence: ["Inventories"],
    }],
    stock_radar: [{
      symbol: "SMH",
      company_name: "VanEck Semiconductor ETF",
      why_relevant: "Semiconductor leadership.",
      research_question: "Is leadership persistent?",
      linkage_type: "LINKED_MAIN_THREAD",
      linked_main_thread_or_story_id: "thread-1",
      confirming_signal: "ev-smh",
      invalidating_signal: "SMH underperforms",
      evidence_references: ["ev-smh"],
    }],
    developing_themes: [{
      theme_id: "theme-1",
      title: "Energy tightness",
      summary: "Refined products remain firm.",
      supporting_evidence_ids: ["ev-wti"],
    }],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/2",
      entries: [{
        thesis_id: "thesis-1",
        contract_version: "thesis-ledger/2",
        root_thesis_id: "thesis-1",
        parent_thesis_id: null,
        successor_thesis_id: null,
        title: "Energy inflation pressure",
        statement: "Refined-product tightness can sustain inflation pressure.",
        state: "confirmed",
        version: 2,
        created_at: "2026-09-20T00:00:00Z",
        updated_at: "2026-09-21T12:45:41.378Z",
        lineage: [],
        state_reason: "WTI and distillate evidence strengthened.",
        current_evidence_refs: ["ev-wti"],
        observed_market_reaction: "Energy higher",
        next_catalyst_or_tripwire: "EIA inventories",
      }],
    },
    contradictions_detected: [],
    research_gaps: [],
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      omitted_or_demoted_items: [],
      missing_input_categories: ["Inventories"],
      model_repair_used: true,
      notes: ["Validated after structural repair."],
    },
    ...overrides,
  };
}

function dossier(
  id: string,
  analytical: ResearchBrainOutputV1,
  previousDossierId: string | null = null,
): MarketDossierV2 {
  return {
    id,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: previousDossierId,
    as_of: analytical.as_of,
    freshness: {
      warnings: [{ message: "Optional macro enrichment is partial." }],
    },
    research_gaps: [{
      gap_id: "gap-1",
      category: "Energy",
      severity: "high",
      description: "Inventory data missing.",
    }],
    payload: {
      contract_version: analytical.contract_version,
      packet_id: analytical.packet_id,
      system1_policy_outlook: [{
        id: "system1:policy:strong_activity_surprise",
        ruleId: "STRONG_ACTIVITY_SURPRISE",
        trigger: "US Flash Manufacturing PMI was 57.0 versus 53.6 expected.",
        triggerEvidenceRef: "verified-macro:us-flash-pmi",
        triggerMetrics: { observed: 57, expected: 53.6, previous: 53.9, unit: "index" },
        policyImpulse: "HAWKISH",
        nextMeetingRateOutlook: "MORE_HAWKISH",
        fedWatchExpectedDirection: "HIKE_ODDS_UP",
        observedRatePricing: null,
        observedRatePricingEvidenceRef: null,
        expectedMarketReactions: [{ instrument: "US02Y", direction: "UP" }],
        observedConfirmation: "US 2Y yield rose after the PMI release.",
        observedConfirmationEvidenceRef: "verified-macro:pmi-reaction",
        gaps: ["Post-trigger FedWatch probability is not yet present in canonical evidence."],
      }],
      analytical_output: analytical,
    },
    created_at: "2026-09-21T12:48:06.522Z",
  };
}

test("presentation adapter exposes the canonical Live/Hybrid sections without re-ranking", () => {
  const current = dossier(
    "afd9bb75-ffdc-4f51-8f5c-28131d3d2495",
    output(),
    "ac95d007-70a2-4e33-99bb-4d933208c1e7",
  );

  const result = buildDossierV2Presentation(current);

  assert.equal(result.contractVersion, DOSSIER_PRESENTATION_V1);
  assert.equal(result.health.state, "healthy");
  assert.equal(result.health.repairUsed, true);
  assert.deepEqual(result.health.freshnessWarnings, ["Optional macro enrichment is partial."]);
  assert.equal(result.header.headline, "Energy, rates and semis define the current regime.");
  assert.equal(result.header.regimeFamily, "RATES_LED_TIGHTENING");
  assert.equal(result.whatMattersNow.stories[0].id, "story-1");
  assert.equal(result.watchNext[0].id, "inv-1");
  assert.equal(result.researchNow[0].rank, 1);
  assert.equal(result.charts.core[0].lane, "core");
  assert.equal(result.stockRadar[0].symbol, "SMH");
  assert.equal(result.themes[0].theme_id, "theme-1");
  assert.equal(result.policyOutlook.length, 1);
  assert.equal(result.policyOutlook[0].policyImpulse, "HAWKISH");
  assert.equal(result.policyOutlook[0].observedConfirmation, "US 2Y yield rose after the PMI release.");
  assert.equal(result.rateRegime.state, "HAWKISH");
  assert.equal(result.rateRegime.nextMeetingRateOutlook, "MORE_HAWKISH");
  assert.equal(result.rateRegime.fedWatchExpectedDirection, "HIKE_ODDS_UP");
  assert.equal(result.rateRegime.fredBacked, true);
  assert.ok(result.rateRegime.evidenceRefs.includes("market-monitor:us2y:2026-09-21"));

  assert.deepEqual(
    result.regimeStrip.map((lens) => lens.key),
    ["US_RATES", "GOLD"],
  );
  assert.equal(result.regimeStrip[0].observed, true);
  assert.equal(result.regimeStrip[1].observed, false);
});

test("presentation adapter preserves the canonical expected-vs-observed divergence journey", () => {
  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    expected_reaction: "Energy supply stress should lift WTI and refined products.",
    observed_reaction: "WTI fell after the trigger while the investigation remained open.",
    divergence: "MATERIAL",
    observed_evidence: ["ev-energy-trigger", "ev-wti"],
  };

  const current = dossier("afd9bb75-ffdc-4f51-8f5c-28131d3d2495", currentOutput);
  current.payload.system1_reaction_assessments = [{
    check_id: "system1:energy_supply_stress:wti",
    rule_id: "ENERGY_SUPPLY_STRESS",
    trigger_evidence_id: "ev-energy-trigger",
    market_evidence_id: "ev-wti",
    instrument: "WTI",
    expected_direction: "UP",
    observed_direction: "DOWN",
    observed_change_pct: -1.4,
    observed_instrument: "WTI",
    is_proxy: false,
    reaction_window: "30m",
    timing_precision: "INTRADAY",
    relation: "DIVERGENT",
    severity: "HIGH",
  }];

  const result = buildDossierV2Presentation(current);

  assert.equal(result.watchNext[0].expectedReaction, "Energy supply stress should lift WTI and refined products.");
  assert.equal(result.watchNext[0].observedReaction, "WTI fell after the trigger while the investigation remained open.");
  assert.equal(result.watchNext[0].divergence, "MATERIAL");
  assert.deepEqual(result.watchNext[0].storyIds, ["story-1"]);
  assert.deepEqual(result.watchNext[0].thesisIds, ["thesis-1"]);
  assert.equal(result.watchNext[0].reactionChecks.length, 1);
  assert.deepEqual(result.watchNext[0].reactionChecks[0], {
    checkId: "system1:energy_supply_stress:wti",
    instrument: "WTI",
    expectedDirection: "UP",
    observedDirection: "DOWN",
    observedChangePct: -1.4,
    observedInstrument: "WTI",
    isProxy: false,
    reactionWindow: "30m",
    relation: "DIVERGENT",
    timingPrecision: "INTRADAY",
    triggerEvidenceRef: "ev-energy-trigger",
    marketEvidenceRef: "ev-wti",
  });
});

test("presentation adapter keeps pre-window reaction audits from older Dossiers visible", () => {
  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    observed_evidence: ["ev-trigger", "ev-market"],
  };

  const current = dossier("legacy-reaction-audit", currentOutput);
  current.payload.system1_reaction_assessments = [{
    check_id: "system1:legacy:dxy",
    rule_id: "STRONG_ACTIVITY_SURPRISE",
    trigger_evidence_id: "ev-trigger",
    market_evidence_id: "ev-market",
    instrument: "DXY",
    expected_direction: "UP",
    observed_direction: "DOWN",
    observed_change_pct: -0.6,
    timing_precision: "INTRADAY",
    relation: "DIVERGENT",
    severity: "MEDIUM",
  }];

  const result = buildDossierV2Presentation(current);
  assert.deepEqual(result.watchNext[0].reactionChecks[0], {
    checkId: "system1:legacy:dxy",
    instrument: "DXY",
    expectedDirection: "UP",
    observedDirection: "DOWN",
    observedChangePct: -0.6,
    observedInstrument: "DXY",
    isProxy: false,
    reactionWindow: null,
    relation: "DIVERGENT",
    timingPrecision: "INTRADAY",
    triggerEvidenceRef: "ev-trigger",
    marketEvidenceRef: "ev-market",
  });
});

test("investigation journey detects divergence transition by exact investigation ID", () => {
  const previousOutput = output();
  previousOutput.investigations[0] = {
    ...previousOutput.investigations[0],
    expected_reaction: "Energy stress should lift WTI.",
    divergence: "UNRESOLVED",
  };

  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    expected_reaction: "Energy stress should lift WTI.",
    observed_reaction: "WTI fell after the catalyst.",
    divergence: "MATERIAL",
  };

  const previous = dossier("prior-journey", previousOutput);
  const current = dossier("current-journey", currentOutput, previous.id);
  const result = buildDossierV2Presentation(current, previous);

  assert.equal(result.watchNext[0].journey.transition, "DIVERGENCE_DETECTED");
  assert.equal(result.watchNext[0].journey.matchedBy, "id");
  assert.equal(result.watchNext[0].journey.previousDivergence, "UNRESOLVED");
  assert.equal(result.watchNext[0].journey.currentDivergence, "MATERIAL");
  assert.equal(result.watchNext[0].journey.previousExpectedReaction, "Energy stress should lift WTI.");
  assert.equal(result.watchNext[0].journey.currentExpectedReaction, "Energy stress should lift WTI.");
  assert.equal(result.watchNext[0].journey.expectationChanged, false);
});

test("investigation journey preserves prior expectation when current wording changes", () => {
  const previousOutput = output();
  previousOutput.investigations[0] = {
    ...previousOutput.investigations[0],
    expected_reaction: "Hot inflation should lift front-end yields and the dollar.",
  };

  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    expected_reaction: "Rates and USD should rise if the inflation impulse persists.",
  };

  const previous = dossier("prior-expectation", previousOutput);
  const current = dossier("current-expectation", currentOutput, previous.id);
  const result = buildDossierV2Presentation(current, previous);

  assert.equal(
    result.watchNext[0].journey.previousExpectedReaction,
    "Hot inflation should lift front-end yields and the dollar.",
  );
  assert.equal(
    result.watchNext[0].journey.currentExpectedReaction,
    "Rates and USD should rise if the inflation impulse persists.",
  );
  assert.equal(result.watchNext[0].journey.expectationChanged, true);
});

test("investigation journey can bridge a changed model ID only through unique story/thesis linkage", () => {
  const previousOutput = output();
  previousOutput.investigations[0] = {
    ...previousOutput.investigations[0],
    investigation_id: "inv:old-duration",
    divergence: "UNRESOLVED",
    linked_story_ids: ["story:duration"],
    linked_thesis_ids: ["thesis:duration"],
  };

  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    investigation_id: "inv:new-duration",
    divergence: "NONE",
    linked_story_ids: ["story:duration"],
    linked_thesis_ids: ["thesis:duration"],
  };

  const previous = dossier("prior-linkage", previousOutput);
  const current = dossier("current-linkage", currentOutput, previous.id);
  const result = buildDossierV2Presentation(current, previous);

  assert.equal(result.watchNext[0].journey.transition, "ALIGNED_CONFIRMED");
  assert.equal(result.watchNext[0].journey.matchedBy, "linkage");
  assert.equal(result.watchNext[0].journey.previousId, "inv:old-duration");
});

test("investigation journey bridges reformulated duration questions through a unique primary Regime route", () => {
  const previousOutput = output();
  previousOutput.investigations[0] = {
    ...previousOutput.investigations[0],
    investigation_id: "inv:prior-duration",
    question: "Is duration and real-yield repricing broadening into sustained financial-conditions tightening?",
    why_it_matters: "A broader duration shock would tighten financial conditions.",
    current_explanation: "Long-end real yields are elevated while transmission is incomplete.",
    expected_reaction: "Credit spreads widen and breadth deteriorates if duration stress transmits.",
    linked_story_ids: ["story:old-duration"],
    linked_thesis_ids: ["thesis:old-duration"],
  };

  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    investigation_id: "inv:current-duration",
    question: "Is US duration and real-yield pressure now transmitting into credit, volatility and broad equity breadth?",
    why_it_matters: "Transmission would convert a rates-led reprice into broader tightening.",
    current_explanation: "Higher real yields coexist with contained credit spreads.",
    expected_reaction: "Credit spreads widen, VIX rises and breadth deteriorates.",
    linked_story_ids: ["story:new-duration"],
    linked_thesis_ids: ["thesis:new-duration"],
  };

  const previous = dossier("prior-route", previousOutput);
  const current = dossier("current-route", currentOutput, previous.id);
  const result = buildDossierV2Presentation(current, previous);

  assert.equal(result.watchNext[0].journey.matchedBy, "regime_route");
  assert.equal(result.watchNext[0].journey.previousId, "inv:prior-duration");
  assert.equal(
    result.watchNext[0].journey.previousExpectedReaction,
    "Credit spreads widen and breadth deteriorates if duration stress transmits.",
  );
  assert.equal(result.watchNext[0].journey.expectationChanged, true);
});

test("investigation journey never infers resolution when a prior question disappears", () => {
  const previousOutput = output();
  const currentOutput = output({ investigations: [] });

  const previous = dossier("prior-missing", previousOutput);
  const current = dossier("current-missing", currentOutput, previous.id);
  const result = buildDossierV2Presentation(current, previous);

  assert.equal(result.watchNext.length, 0);
  assert.equal(result.investigationJourney.length, 1);
  assert.equal(result.investigationJourney[0].transition, "NOT_CARRIED_FORWARD");
  assert.equal(result.investigationJourney[0].previousStatus, "open");
  assert.equal(result.investigationJourney[0].currentStatus, null);
});

test("investigation journey fails closed when linkage is ambiguous", () => {
  const base = output().investigations[0];
  const previousOutput = output({
    investigations: [
      {
        ...base,
        investigation_id: "inv:prior-a",
        linked_story_ids: ["story:shared"],
        linked_thesis_ids: ["thesis:shared"],
      },
      {
        ...base,
        investigation_id: "inv:prior-b",
        question: "Second prior question",
        linked_story_ids: ["story:shared"],
        linked_thesis_ids: ["thesis:shared"],
      },
    ],
  });
  const currentOutput = output({
    investigations: [{
      ...base,
      investigation_id: "inv:current",
      linked_story_ids: ["story:shared"],
      linked_thesis_ids: ["thesis:shared"],
    }],
  });

  const previous = dossier("prior-ambiguous", previousOutput);
  const current = dossier("current-ambiguous", currentOutput, previous.id);
  const result = buildDossierV2Presentation(current, previous);

  assert.equal(result.watchNext[0].journey.transition, "NEW");
  assert.equal(result.watchNext[0].journey.matchedBy, null);
  assert.equal(
    result.investigationJourney.filter((item) => item.transition === "NOT_CARRIED_FORWARD").length,
    2,
  );
});

test("presentation adapter computes thesis changes against the previous dossier only", () => {
  const previousOutput = output({
    thesis_ledger: {
      contract_version: "thesis-ledger/2",
      entries: [{
        ...output().thesis_ledger.entries[0],
        state: "unresolved",
        version: 1,
        state_reason: "Awaiting evidence.",
      }],
    },
  });

  const previous = dossier(
    "ac95d007-70a2-4e33-99bb-4d933208c1e7",
    previousOutput,
  );
  const current = dossier(
    "afd9bb75-ffdc-4f51-8f5c-28131d3d2495",
    output(),
    previous.id,
  );

  const result = buildDossierV2Presentation(current, previous);

  assert.equal(result.thesisChanges.length, 1);
  assert.equal(result.thesisChanges[0].change, "state_changed");
  assert.equal(result.thesisChanges[0].previousState, "unresolved");
  assert.equal(result.thesisChanges[0].state, "confirmed");
  assert.equal(result.thesisChanges[0].previousVersion, 1);
  assert.equal(result.thesisChanges[0].version, 2);
});

test("presentation evidence index shows where each canonical evidence ID is used", () => {
  const current = dossier(
    "afd9bb75-ffdc-4f51-8f5c-28131d3d2495",
    output(),
  );

  const result = buildDossierV2Presentation(current);
  const wti = result.evidenceIndex.find((item) => item.evidenceId === "ev-wti");
  const smh = result.evidenceIndex.find((item) => item.evidenceId === "ev-smh");

  assert.ok(wti);
  assert.deepEqual(wti.usedIn, [
    "investigation:inv-1",
    "main_thread",
    "story:story-1",
    "theme:theme-1",
    "thesis:thesis-1",
  ]);

  assert.ok(smh);
  assert.deepEqual(smh.usedIn, ["main_thread", "stock:SMH"]);
});

test("resolved investigations are not promoted into Watch Next", () => {
  const currentOutput = output();
  currentOutput.investigations[0] = {
    ...currentOutput.investigations[0],
    status: "resolved",
  };

  const result = buildDossierV2Presentation(
    dossier("afd9bb75-ffdc-4f51-8f5c-28131d3d2495", currentOutput),
  );

  assert.equal(result.watchNext.length, 0);
});

test("malformed persisted Dossier payload fails closed", () => {
  const current = dossier(
    "afd9bb75-ffdc-4f51-8f5c-28131d3d2495",
    output(),
  );
  current.payload = {};

  assert.throws(
    () => buildDossierV2Presentation(current),
    /has no analytical_output payload/,
  );
});


test("presentation prefers the persisted multi-signal rate regime over event-only fallback", () => {
  const current = dossier(
    "afd9bb75-ffdc-4f51-8f5c-28131d3d2495",
    output(),
  );
  current.payload.system1_rate_regime = {
    contractVersion: "rate-regime/1",
    asOf: "2026-09-21T12:45:41.378Z",
    state: "MIXED",
    score: 0,
    confidence: "HIGH",
    summary: "Rates conditions are internally mixed.",
    nextMeetingRateOutlook: "MORE_HAWKISH",
    fedWatchExpectedDirection: "HIKE_ODDS_UP",
    trigger: "Strong PMI.",
    observedRatePricing: "55.4% hike odds.",
    observedConfirmation: "2Y rose after PMI.",
    usRatesReaction: "US 2Y 5D -4.0 bp",
    usRatesInterpretation: "Front end eased while breakevens rose.",
    fredBacked: true,
    curve: {
      spreadBps: 20,
      state: "POSITIVE",
      detail: "10Y minus 2Y is +20.0 bp.",
      evidenceRefs: ["market-monitor:us2y:2026-09-21", "market-monitor:us10y-fred:2026-09-21"],
    },
    signals: [{
      key: "FRONT_END",
      label: "Front-end pricing",
      state: "DOVISH",
      score: -1,
      detail: "US 2Y eased.",
      evidenceRefs: ["market-monitor:us2y:2026-09-21"],
    }],
    drivers: ["Front-end pricing: dovish."],
    contradictions: ["Hawkish signals: Policy.", "Dovish signals: Front-end pricing."],
    evidenceRefs: ["market-monitor:us2y:2026-09-21"],
    coverage: { present: 5, total: 5, missing: [] },
    gaps: [],
  };

  const result = buildDossierV2Presentation(current);

  assert.equal(result.rateRegime.state, "MIXED");
  assert.equal(result.rateRegime.score, 0);
  assert.equal(result.rateRegime.confidence, "HIGH");
  assert.equal(result.rateRegime.curve?.state, "POSITIVE");
  assert.equal(result.rateRegime.signals?.[0]?.state, "DOVISH");
});


test("presentation hides non-material refinement gaps and keeps material blockers", () => {
  const current = dossier(
    "afd9bb75-ffdc-4f51-8f5c-28131d3d2495",
    output(),
  );
  current.research_gaps = [
    {
      gap_id: "gap-refinement",
      category: "market-flow",
      severity: "high",
      description: "Need intraday dealer flow to refine the explanation.",
    },
    {
      gap_id: "gap-blocker",
      category: "PRICE_DATA",
      severity: "MATERIAL",
      description: "Required current price evidence is unavailable.",
    },
  ];

  const result = buildDossierV2Presentation(current);

  assert.deepEqual(result.health.researchGaps.map((gap) => gap.id), ["gap-blocker"]);
  assert.equal(result.health.researchGaps[0]?.severity, "MATERIAL");
});
