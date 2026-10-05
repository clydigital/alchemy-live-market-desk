import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";

import { buildDossierEvidenceSufficiency } from "../lib/dossier-v2/evidence-sufficiency.ts";
import {
  buildDossierV2Presentation,
  DOSSIER_PRESENTATION_V1,
} from "../lib/dossier-v2/presentation-adapter.ts";
import {
  decideResearchGapDiscriminatorLifecycle,
  type ResearchGapDiscriminatorLifecycleSnapshot,
} from "../lib/research-gap-discriminator-lifecycle.ts";

const STORY_UUID = "11111111-1111-4111-8111-111111111111";
const ANALYTICAL_STORY_ID = "story:rates-duration-stress";

function mockBrainOutput(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "research-brain/1",
    contract_version: "research-brain/1",
    packet_id: "packet-1",
    as_of: "2026-10-05T12:00:00.000Z",
    diagnostics: {
      degraded: false,
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
      omitted_or_demoted_items: [],
    },
    contradictions_detected: [],
    main_thread: {
      thread_id: "thread-1",
      headline: "US duration stress persisting across long-end rates.",
      question: "Is US duration stress persisting?",
      answer: "US duration stress persisted.",
      regime_implication: "Yields remain elevated and financing tight.",
      regime_family: "RATES_DURATION_STRESS",
      epistemic_label: "SUPPORTED",
      evidence_references: ["ev:rates-10y"],
      supporting_story_ids: [ANALYTICAL_STORY_ID],
      contradiction_references: [],
      what_changed: "Long-end yields held elevated levels.",
      why_it_matters: "Financial conditions stay tight.",
      what_would_change_mind: "Durable yield reversal.",
    },
    major_stories: [
      {
        story_id: ANALYTICAL_STORY_ID,
        persistent_story_id: STORY_UUID,
        title: "Rates duration stress",
        what_changed: "Yields held near highs.",
        why_it_matters: "Borrowing costs remain high.",
        headline_decomposition: "Long-end rates drive overall conditions.",
        causal_mechanism: "Term premium and supply pressure.",
        market_evidence: {
          confirming: ["ev:rates-10y"],
          contradicting: [],
          accelerating: [],
          unresolved: [],
        },
        conclusion: "Rates thesis supported.",
        what_would_change_mind: "Yield breakdown.",
        linked_thesis_ids: [],
        linked_investigation_ids: [],
        linked_chart_task_ids: [],
        epistemic_label: "OBSERVED",
        evidence_ids: ["ev:rates-10y"],
      },
    ],
    chart_investigation_queue: {
      core: [],
      optional: [],
    },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict-1",
      lenses: {
        US_RATES: {
          lens_name: "US_RATES",
          observed_reaction: "10Y elevated",
          observed_reaction_evidence_refs: ["ev:rates-10y"],
          interpretation: "Rates remain restrictive.",
          contradiction_references: [],
          unresolved_signals: [],
        },
      },
      cross_asset_readthrough: "Rates dominate conditions.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "Yields elevated.",
      dominant_contradiction: "None.",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/2",
      entries: [],
    },
    motion_acceptance: {
      contractVersion: "dossier-motion-acceptance/1",
      decisions: [],
    },
    ...overrides,
  } as any;
}

function mockDossier(id: string, brainOutput = mockBrainOutput()): MarketDossierV2 {
  return {
    id,
    contract_version: "market-dossier-v2/1",
    as_of: "2026-10-05T12:00:00.000Z",
    run_mode: "SCHEDULED_AUTOMATED",
    source_run_ledger_id: null,
    prior_dossier_id: null,
    dossier_version: "2.0.0",
    freshness: {
      warnings: [],
      evidence_states: [],
    },
    research_gaps: [],
    payload: {
      contract_version: brainOutput.contract_version ?? "research-brain/1",
      input_packet: {
        contract_version: "dossier-v2-input/1",
        packet_id: "packet-1",
        as_of: "2026-10-05T12:00:00.000Z",
        previous_dossier_id: null,
        persistent_story_bindings: [
          {
            analytical_story_id: ANALYTICAL_STORY_ID,
            persistent_story_id: STORY_UUID,
          },
        ],
        observed_evidence: [],
        research_leads: [],
        prior_analytical_state: {
          previous_dossier_id: null,
          as_of: null,
          prior_claims: [],
          prior_investigations: [],
        },
        development_clusters: [],
        creator_themes: [],
        catalysts: [],
        rate_context: { evidence: [] },
        freshness_warnings: [],
        evidence_states: [],
        research_gaps: [],
        diagnostics: {
          omitted_clusters_count: 0,
          omitted_evidence_count: 0,
          omitted_leads_count: 0,
          omitted_creator_themes_count: 0,
          omitted_creator_claims_count: 0,
          omitted_catalysts_count: 0,
          omitted_prior_claims_count: 0,
          omitted_thesis_entries_count: 0,
          omitted_research_gaps_count: 0,
          byte_limit_truncation_applied: false,
          notes: [],
        },
      },
      analytical_output: brainOutput,
    },
    created_at: "2026-10-05T12:00:00.000Z",
  } as any;
}

test("D1 story identity + Evidence Sufficiency boundary: superseded or missing governance blocks high confidence", () => {
  const brainOutput = mockBrainOutput();
  const governanceSnapshot = {
    contractVersion: "dossier-evidence-governance/1" as const,
    asOf: "2026-10-05T12:00:00.000Z",
    items: [
      {
        evidenceId: "ev:rates-10y",
        sourceType: "MARKET_DATA",
        availableAt: "2026-10-05T12:00:00.000Z",
        occurrenceTime: null,
        publishedAt: [],
        conflictGroupId: null,
        supersededEvidenceIds: [],
        supersededByEvidenceIds: [],
        temporalState: "SUPERSEDED" as const,
        sourceLineageKeys: ["rates"],
        independentLineageCount: 1,
      },
    ],
    conflictGroups: [],
    diagnostics: {
      duplicateEvidenceIds: [],
      missingProvenanceEvidenceIds: [],
      unknownSupersededEvidenceIds: [],
      policy: [],
    },
  };

  const sufficiency = buildDossierEvidenceSufficiency({
    current: brainOutput,
    previous: null,
    governance: governanceSnapshot,
  });

  assert.equal(sufficiency.stories.length, 1);
  const storySufficiency = sufficiency.stories[0]!;
  assert.equal(storySufficiency.analyticalStoryId, ANALYTICAL_STORY_ID);
  assert.equal(storySufficiency.persistentStoryId, STORY_UUID);
  assert.equal(storySufficiency.highConfidenceBlocked, true);
  assert.ok(storySufficiency.blockers.includes("SUPERSEDED_SUPPORT"));
});

test("D5 Decision Packet + D6 Longitudinal Adjudication baseline boundary: initial run initializes without NaN or unresolved distortion", () => {
  const dossier = mockDossier("afd9bb75-ffdc-4f51-8f5c-28131d3d2495");
  const presentation = buildDossierV2Presentation(dossier);

  assert.equal(presentation.contractVersion, DOSSIER_PRESENTATION_V1);
  assert.equal(presentation.decisionPacket?.basis, "DOSSIER_READ_MODEL");
  assert.equal(presentation.decisionPacket?.state, "BASELINE");
  assert.equal(presentation.longitudinalAdjudication?.basis, "EXACT_PRIOR_DOSSIER");
  assert.equal(presentation.longitudinalAdjudication?.previousDossierId, null);
  assert.equal(presentation.longitudinalAdjudication?.reactionOutcome, "BASELINE");
  assert.equal(presentation.longitudinalAdjudication?.evaluatedExpectations, 0);
  assert.equal(presentation.longitudinalAdjudication?.alignedExpectations, 0);
  assert.equal(presentation.longitudinalAdjudication?.divergentExpectations, 0);
});

test("Sequential Research Gap Discriminator lifecycle boundary: handed-off state without admitted evidence preserves frozen lifecycle and exhausts on final discriminator", () => {
  const candidatePlan = {
    contractVersion: "research-gap-causal-discriminator/1" as const,
    planSignature: "sig-abc-123",
    baseEvidenceNeeded: ["ev:base"],
    discriminators: ["ev:disc-1", "ev:disc-2"],
  };

  const frozenLifecycle: ResearchGapDiscriminatorLifecycleSnapshot = {
    contractVersion: "research-gap-discriminator-lifecycle/1",
    planSignature: "sig-abc-123",
    baseEvidenceNeeded: ["ev:base"],
    discriminators: ["ev:disc-1", "ev:disc-2"],
    activeIndex: 0,
    activeDiscriminator: "ev:disc-1",
  };

  const unadmittedDecision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan,
    existingStatus: "HANDED_OFF",
    existingResearchPlan: { causalDiscriminator: frozenLifecycle },
    canonicalHandoffAdmitted: false,
  });

  assert.equal(unadmittedDecision.transition, "PRESERVE");
  assert.equal(unadmittedDecision.shouldRequeue, false);
  assert.equal(unadmittedDecision.shouldClose, false);
  assert.equal(unadmittedDecision.lifecycle.activeIndex, 0);

  const finalLifecycle: ResearchGapDiscriminatorLifecycleSnapshot = {
    ...frozenLifecycle,
    activeIndex: 1,
    activeDiscriminator: "ev:disc-2",
  };
  const exhaustedDecision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan,
    existingStatus: "HANDED_OFF",
    existingResearchPlan: { causalDiscriminator: finalLifecycle },
    canonicalHandoffAdmitted: true,
  });

  assert.equal(exhaustedDecision.transition, "EXHAUST");
  assert.equal(exhaustedDecision.shouldClose, true);
});
