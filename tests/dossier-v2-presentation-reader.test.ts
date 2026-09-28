import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  selectDossierV2Presentation,
} from "../lib/dossier-v2/presentation-reader.ts";

function brain({
  degraded = false,
  state = "confirmed",
  version = 2,
}: {
  degraded?: boolean;
  state?: "confirmed" | "weakened" | "invalidated" | "unresolved" | "evolved";
  version?: number;
} = {}): ResearchBrainOutputV1 {
  return {
    contract_version: "research-brain/1",
    packet_id: "packet",
    as_of: "2026-09-21T12:45:41.378Z",
    main_thread: {
      thread_id: "thread-1",
      headline: degraded ? "Research Brain degraded" : "Energy, rates and semis define the current regime.",
      answer: degraded ? "Primary reasoning unavailable." : "Cross-asset state is supported.",
      regime_implication: degraded ? "UNRESOLVED" : "Energy and rates remain the main constraints.",
      regime_family: degraded ? "UNRESOLVED" : "RATES_LED_TIGHTENING",
      epistemic_label: degraded ? "SPECULATIVE" : "SUPPORTED",
      evidence_references: degraded ? [] : ["ev-1"],
      supporting_story_ids: degraded ? [] : ["story-1"],
      contradiction_references: [],
      what_would_change_mind: "New evidence.",
    },
    major_stories: degraded ? [] : [{
      story_id: "story-1",
      title: "Energy strength",
      what_changed: "WTI rose.",
      why_it_matters: "Inflation pressure.",
      headline_decomposition: "WTI higher.",
      causal_mechanism: "Energy transmits into inflation.",
      market_evidence: { confirming: ["ev-1"], contradicting: [], unresolved: [] },
      conclusion: "Energy is firm.",
      what_would_change_mind: "WTI reversal.",
      linked_thesis_ids: ["thesis-1"],
      linked_investigation_ids: ["inv-1"],
      linked_chart_task_ids: ["chart-1"],
      epistemic_label: "OBSERVED",
      evidence_ids: ["ev-1"],
    }],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict-1",
      lenses: {},
      cross_asset_readthrough: degraded ? "Degraded." : "Energy and rates dominate.",
      epistemic_label: degraded ? "SPECULATIVE" : "SUPPORTED",
      dominant_confirmation: degraded ? "None" : "Energy",
      dominant_contradiction: "None",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/2",
      entries: [{
        thesis_id: "thesis-1",
        contract_version: "thesis-ledger/2",
        root_thesis_id: "thesis-1",
        parent_thesis_id: null,
        successor_thesis_id: null,
        title: "Energy thesis",
        statement: "Energy remains firm.",
        state,
        version,
        created_at: "2026-09-20T00:00:00Z",
        updated_at: "2026-09-21T12:45:41.378Z",
        lineage: [],
        state_reason: "Evidence changed.",
        current_evidence_refs: degraded ? [] : ["ev-1"],
        observed_market_reaction: degraded ? null : "WTI higher",
        next_catalyst_or_tripwire: "EIA",
      }],
    },
    contradictions_detected: [],
    research_gaps: degraded ? [{
      gap_id: "gap-degraded",
      category: "RESEARCH_BRAIN_DEGRADED",
      description: "Model pass degraded.",
      severity: "MATERIAL",
    }] : [],
    diagnostics: {
      degraded,
      degradation_reasons: degraded ? ["Model pass degraded."] : [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
    },
  };
}

function dossier({
  id,
  asOf,
  previousDossierId = null,
  output = brain(),
}: {
  id: string;
  asOf: string;
  previousDossierId?: string | null;
  output?: ResearchBrainOutputV1;
}): MarketDossierV2 {
  return {
    id,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: previousDossierId,
    as_of: asOf,
    freshness: { warnings: [] },
    research_gaps: [...output.research_gaps],
    payload: {
      contract_version: output.contract_version,
      packet_id: output.packet_id,
      analytical_output: {
        ...output,
        as_of: asOf,
      },
    },
    created_at: asOf,
  };
}

function investigation({
  id = "inv-1",
  status = "open",
  divergence = "UNRESOLVED",
  expectedReaction = "Hot inflation should lift the dollar.",
  observedReaction = null,
}: {
  id?: string;
  status?: "open" | "weakened" | "resolved" | "parked";
  divergence?: "NONE" | "PARTIAL" | "MATERIAL" | "UNRESOLVED";
  expectedReaction?: string | null;
  observedReaction?: string | null;
} = {}): ResearchBrainOutputV1["investigations"][number] {
  return {
    investigation_id: id,
    question: "Did the macro surprise transmit through the expected cross-asset channel?",
    why_it_matters: "The answer determines whether the initial policy impulse is dominating the tape.",
    current_explanation: divergence === "MATERIAL"
      ? "The expected dollar transmission did not appear in the measured reaction window."
      : "The measured reaction was consistent with the directional prior.",
    expected_reaction: expectedReaction,
    observed_reaction: observedReaction,
    divergence,
    competing_explanations: divergence === "MATERIAL" ? ["A competing growth impulse may have offset the policy channel."] : [],
    observed_evidence: ["ev-trigger", "ev-market"],
    missing_evidence: [],
    research_next: "Compare the next rates, USD and gold reaction window.",
    chart_task_links: [],
    confirmation_condition: "The same transmission appears on the next comparable catalyst.",
    invalidation_condition: "The relationship reverses on comparable evidence.",
    status,
    linked_story_ids: ["story-1"],
    linked_thesis_ids: ["thesis-1"],
    leads_referenced: [],
  };
}

function addReactionAssessment(
  target: MarketDossierV2,
  relation: "ALIGNED" | "DIVERGENT",
  observedDirection: "UP" | "DOWN",
) {
  target.payload.system1_reaction_assessments = [{
    check_id: `system1:history:dxy:${relation.toLowerCase()}`,
    rule_id: "HOT_INFLATION_SURPRISE",
    trigger_evidence_id: "ev-trigger",
    market_evidence_id: "ev-market",
    instrument: "DXY",
    expected_direction: "UP",
    observed_direction: observedDirection,
    observed_change_pct: observedDirection === "UP" ? 0.5 : -0.6,
    observed_instrument: "UUP",
    is_proxy: true,
    reaction_window: "30m",
    timing_precision: "INTRADAY",
    relation,
    severity: "MEDIUM",
  }];
}

const HEALTHY_ID = "11111111-1111-4111-8111-111111111111";
const DEGRADED_ID = "22222222-2222-4222-8222-222222222222";
const OLDER_ID = "33333333-3333-4333-8333-333333333333";

test("reader selects the latest healthy Dossier as current", () => {
  const result = selectDossierV2Presentation([
    dossier({ id: HEALTHY_ID, asOf: "2026-09-21T12:45:00Z" }),
    dossier({ id: OLDER_ID, asOf: "2026-09-21T10:00:00Z" }),
  ]);

  assert.equal(result.status, "current");
  assert.equal(result.selectedDossierId, HEALTHY_ID);
  assert.equal(result.latestDossierId, HEALTHY_ID);
  assert.equal(result.usingFallback, false);
  assert.equal(result.notice.tone, "ready");
});

test("reader falls back to the previous healthy Dossier when latest is degraded", () => {
  const healthy = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
  });
  const degraded = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T13:00:00Z",
    previousDossierId: HEALTHY_ID,
    output: brain({ degraded: true }),
  });

  const result = selectDossierV2Presentation([healthy, degraded]);

  assert.equal(result.status, "fallback_previous_healthy");
  assert.equal(result.latestDossierId, DEGRADED_ID);
  assert.equal(result.selectedDossierId, HEALTHY_ID);
  assert.equal(result.usingFallback, true);
  assert.equal(result.notice.tone, "warn");
  assert.match(result.notice.detail, /latest Dossier is degraded/i);
});

test("reader falls back when latest analytical payload is malformed", () => {
  const healthy = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
  });
  const malformed = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T13:00:00Z",
    previousDossierId: HEALTHY_ID,
  });
  malformed.payload = {};

  const result = selectDossierV2Presentation([healthy, malformed]);

  assert.equal(result.status, "fallback_previous_healthy");
  assert.equal(result.latestDossierId, DEGRADED_ID);
  assert.equal(result.selectedDossierId, HEALTHY_ID);
  assert.match(result.notice.detail, /could not be rendered safely/i);
});

test("reader exposes the degraded latest Dossier only when no healthy fallback exists", () => {
  const degraded = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T13:00:00Z",
    output: brain({ degraded: true }),
  });

  const result = selectDossierV2Presentation([degraded]);

  assert.equal(result.status, "degraded_latest");
  assert.equal(result.selectedDossierId, DEGRADED_ID);
  assert.equal(result.presentation?.health.degraded, true);
  assert.equal(result.notice.tone, "warn");
});

test("reader reconstructs bounded calibration history including closed investigations", () => {
  const olderOutput = brain();
  olderOutput.investigations = [investigation({
    status: "resolved",
    divergence: "NONE",
    observedReaction: "UUP rose over the measured 30m window.",
  })];
  const older = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    output: olderOutput,
  });
  addReactionAssessment(older, "ALIGNED", "UP");

  const currentOutput = brain();
  currentOutput.investigations = [investigation({
    divergence: "MATERIAL",
    observedReaction: "UUP fell over the measured 30m window.",
  })];
  const current = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: currentOutput,
  });
  addReactionAssessment(current, "DIVERGENT", "DOWN");

  const result = selectDossierV2Presentation([current, older]);

  assert.equal(result.calibrationHistory.length, 2);
  assert.equal(result.calibrationHistory[0].dossierId, HEALTHY_ID);
  assert.equal(result.calibrationHistory[0].cases[0].outcome, "DIVERGENT");
  assert.equal(result.calibrationHistory[0].cases[0].precision, "INTRADAY");
  assert.equal(result.calibrationHistory[0].cases[0].requiresReview, true);
  assert.equal(result.calibrationHistory[1].dossierId, OLDER_ID);
  assert.equal(result.calibrationHistory[1].cases[0].status, "resolved");
  assert.equal(result.calibrationHistory[1].cases[0].outcome, "ALIGNED");
  assert.equal(result.calibrationHistory[1].cases[0].requiresReview, false);

  assert.equal(result.calibrationLineages.length, 1);
  assert.equal(result.calibrationLineages[0].caseVintages, 2);
  assert.equal(result.calibrationLineages[0].evaluatedVintages, 2);
  assert.equal(result.calibrationLineages[0].measuredVintages, 2);
  assert.equal(result.calibrationLineages[0].rewriteOnlyVintages, 0);
  assert.deepEqual(
    result.calibrationLineages[0].cases.map((item) => item.outcome),
    ["ALIGNED", "DIVERGENT"],
  );
  assert.equal(result.calibrationLineages[0].hasDivergence, true);
  assert.equal(result.calibrationLineages[0].learningState, "DIVERGENCE_REVIEW");
  assert.equal(result.calibrationLineages[0].reactionRead, "DID_NOT_FOLLOW_EXPECTATION");
  assert.match(result.calibrationLineages[0].learningSummary, /did not follow/i);
});

test("rewrite-only lineages remain transmission-unresolved rather than falsely aligned", () => {
  const oldestOutput = brain();
  oldestOutput.investigations = [investigation({
    expectedReaction: "Rates should rise if the inflation impulse persists.",
  })];
  const oldest = dossier({
    id: "44444444-4444-4444-8444-444444444444",
    asOf: "2026-09-21T09:00:00Z",
    output: oldestOutput,
  });

  const middleOutput = brain();
  middleOutput.investigations = [investigation({
    expectedReaction: "Rates and USD should rise if inflation remains sticky.",
  })];
  const middle = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    previousDossierId: oldest.id,
    output: middleOutput,
  });

  const currentOutput = brain();
  currentOutput.investigations = [investigation({
    expectedReaction: "Credit and breadth should weaken if the rates shock transmits.",
  })];
  const current = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: currentOutput,
  });

  const result = selectDossierV2Presentation([current, middle, oldest]);

  assert.equal(result.calibrationLineages.length, 1);
  const lineage = result.calibrationLineages[0];
  assert.equal(lineage.caseVintages, 2);
  assert.equal(lineage.evaluatedVintages, 0);
  assert.equal(lineage.measuredVintages, 0);
  assert.equal(lineage.rewriteOnlyVintages, 2);
  assert.equal(lineage.learningState, "TRANSMISSION_UNRESOLVED");
  assert.equal(lineage.reactionRead, "NOT_MEASURED");
  assert.match(lineage.learningSummary, /hypothesis refinement, not forecast calibration/i);
});

test("repeated exact alignment supports only the reaction rule, not the whole mechanism", () => {
  const olderOutput = brain();
  olderOutput.investigations = [investigation({
    divergence: "NONE",
    observedReaction: "UUP rose over the measured 30m window.",
  })];
  const older = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    output: olderOutput,
  });
  addReactionAssessment(older, "ALIGNED", "UP");

  const currentOutput = brain();
  currentOutput.investigations = [investigation({
    divergence: "NONE",
    observedReaction: "UUP rose again over the measured 30m window.",
  })];
  const current = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: currentOutput,
  });
  addReactionAssessment(current, "ALIGNED", "UP");

  const result = selectDossierV2Presentation([current, older]);

  const lineage = result.calibrationLineages[0];
  assert.equal(lineage.evaluatedVintages, 2);
  assert.equal(lineage.learningState, "REACTION_RULE_SUPPORTED");
  assert.equal(lineage.reactionRead, "FOLLOWED_EXPECTATION");
  assert.match(lineage.learningSummary, /supports the reaction rule, not the whole causal mechanism/i);
  assert.match(lineage.mechanismRead, /cannot prove the mechanism was right or wrong/i);
});

test("calibration lineage excludes continuity inferred only from broad Regime routing", () => {
  const olderInvestigation = investigation({
    id: "inv:prior-duration",
    divergence: "NONE",
    observedReaction: "UUP rose over the measured 30m window.",
  });
  olderInvestigation.question = "Is duration and real-yield repricing broadening into financial conditions?";
  olderInvestigation.why_it_matters = "A duration shock can tighten financial conditions.";
  olderInvestigation.current_explanation = "Long-end real yields remain elevated.";
  olderInvestigation.expected_reaction = "Credit spreads widen and breadth deteriorates.";
  olderInvestigation.linked_story_ids = ["story:old-duration"];
  olderInvestigation.linked_thesis_ids = ["thesis:old-duration"];

  const currentInvestigation = investigation({
    id: "inv:current-duration",
    divergence: "MATERIAL",
    observedReaction: "UUP fell over the measured 30m window.",
  });
  currentInvestigation.question = "Is US duration and real-yield pressure transmitting into credit, volatility and breadth?";
  currentInvestigation.why_it_matters = "Transmission would broaden the tightening impulse.";
  currentInvestigation.current_explanation = "Rates pressure persists while cross-asset transmission is mixed.";
  currentInvestigation.expected_reaction = "Credit spreads widen, VIX rises and breadth deteriorates.";
  currentInvestigation.linked_story_ids = ["story:new-duration"];
  currentInvestigation.linked_thesis_ids = ["thesis:new-duration"];

  const olderOutput = brain();
  olderOutput.investigations = [olderInvestigation];
  const older = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    output: olderOutput,
  });
  addReactionAssessment(older, "ALIGNED", "UP");

  const currentOutput = brain();
  currentOutput.investigations = [currentInvestigation];
  const current = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: currentOutput,
  });
  addReactionAssessment(current, "DIVERGENT", "DOWN");

  const result = selectDossierV2Presentation([current, older]);

  assert.equal(result.calibrationHistory.length, 2);
  assert.equal(result.calibrationHistory[0].cases[0].matchedBy, null);
  assert.equal(result.calibrationHistory[0].cases[0].priorExpectedReaction, null);
  assert.deepEqual(result.calibrationLineages, []);
});

test("reader omits Dossier vintages with no exact calibration or expectation rewrite from history", () => {
  const result = selectDossierV2Presentation([
    dossier({ id: HEALTHY_ID, asOf: "2026-09-21T12:45:00Z" }),
    dossier({ id: OLDER_ID, asOf: "2026-09-21T10:00:00Z" }),
  ]);

  assert.deepEqual(result.calibrationHistory, []);
  assert.deepEqual(result.calibrationLineages, []);
});

test("reader reports unavailable when no persisted Dossier exists", () => {
  const result = selectDossierV2Presentation([]);

  assert.equal(result.status, "unavailable");
  assert.equal(result.presentation, null);
  assert.equal(result.notice.tone, "error");
});

test("selected healthy presentation receives its prior Dossier for thesis diffs", () => {
  const previous = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    output: brain({ state: "unresolved", version: 1 }),
  });
  const current = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: brain({ state: "confirmed", version: 2 }),
  });

  const result = selectDossierV2Presentation([current, previous]);

  assert.equal(result.status, "current");
  assert.equal(result.presentation?.thesisChanges.length, 1);
  assert.equal(result.presentation?.thesisChanges[0].change, "state_changed");
  assert.equal(result.presentation?.thesisChanges[0].previousState, "unresolved");
  assert.equal(result.presentation?.thesisChanges[0].state, "confirmed");
});
