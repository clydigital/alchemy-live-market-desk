import assert from "node:assert/strict";
import test from "node:test";

import { buildPriorPersistentStoryBindings } from "../lib/dossier-v2/manual-run.ts";
import {
  buildDossierReevaluationPropagationPlan,
} from "../lib/dossier-v2/reevaluation-propagation.ts";
import { validateResearchBrainOutput } from "../lib/dossier-v2/research-brain-validation.ts";

const STORY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_STORY_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_ROW_ID = "33333333-3333-4333-8333-333333333333";
const ANALYTICAL_STORY_ID = "story:rates-duration-stress";
const CANONICAL_REF = "ev:rates";

function packet(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: "dossier-v2-input/1",
    packet_id: "packet",
    as_of: "2026-10-05T12:00:00.000Z",
    previous_dossier_id: null,
    persistent_story_bindings: [
      {
        analytical_story_id: ANALYTICAL_STORY_ID,
        persistent_story_id: STORY_ID,
      },
    ],
    observed_evidence: [
      {
        evidence_id: CANONICAL_REF,
        source_type: "MARKET_DATA",
        category: "RATES",
        claim_or_fact: "Long-end yields remained elevated.",
        metrics: {},
        provenance: [{ source_type: "MARKET_DATA", source_id: "rates" }],
      },
    ],
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
    ...overrides,
  } as any;
}

function majorStory(overrides: Record<string, unknown> = {}) {
  return {
    story_id: ANALYTICAL_STORY_ID,
    persistent_story_id: STORY_ID,
    title: "Rates duration stress",
    what_changed: "Long-end pressure persisted.",
    why_it_matters: "Financing conditions remain restrictive.",
    headline_decomposition: "Rates remained the main transmission channel.",
    causal_mechanism: "Higher long-end yields raise borrowing costs.",
    market_evidence: {
      confirming: [CANONICAL_REF],
      contradicting: [],
      accelerating: [],
      unresolved: [],
    },
    conclusion: "The rates-stress thesis remains supported.",
    what_would_change_mind: "A durable reversal in long-end yields and credit stress.",
    linked_thesis_ids: [],
    linked_investigation_ids: [],
    linked_chart_task_ids: [],
    epistemic_label: "OBSERVED",
    evidence_ids: [CANONICAL_REF],
    ...overrides,
  } as any;
}

function analyticalOutput(story = majorStory()) {
  return {
    major_stories: [story],
    motion_acceptance: {
      contract_version: "dossier-motion-acceptance/1",
      decisions: [],
    },
  } as any;
}

test("D1 fails closed on ambiguous prior analytical→persistent Story bindings", () => {
  const dossier = {
    payload: {
      analytical_output: {
        major_stories: [
          {
            story_id: ANALYTICAL_STORY_ID,
            persistent_story_id: STORY_ID,
          },
          {
            story_id: ANALYTICAL_STORY_ID,
            persistent_story_id: OTHER_STORY_ID,
          },
        ],
      },
    },
  } as any;

  assert.deepEqual(buildPriorPersistentStoryBindings(dossier), []);
});

test("D1 carries only exact valid persistent Story UUID bindings from prior Dossiers", () => {
  const dossier = {
    payload: {
      analytical_output: {
        major_stories: [
          {
            story_id: ANALYTICAL_STORY_ID,
            persistent_story_id: STORY_ID,
          },
          {
            story_id: "story:unbound",
            persistent_story_id: null,
          },
          {
            story_id: "story:invalid",
            persistent_story_id: "story-slug-not-a-uuid",
          },
        ],
      },
    },
  } as any;

  assert.deepEqual(buildPriorPersistentStoryBindings(dossier), [
    {
      analytical_story_id: ANALYTICAL_STORY_ID,
      persistent_story_id: STORY_ID,
    },
  ]);
});

test("D1 validation rejects a persistent Story UUID not backed by the exact analytical binding", () => {
  const output = analyticalOutput(
    majorStory({ persistent_story_id: OTHER_STORY_ID }),
  );

  const result = validateResearchBrainOutput(output, packet());
  assert.equal(
    result.errors.some((error) =>
      error.includes("is not the exact packet binding for this analytical Story")),
    true,
  );
});

test("D1 validation preserves an exact packet binding on the matching analytical Story", () => {
  const result = validateResearchBrainOutput(analyticalOutput(), packet());
  assert.equal(
    result.errors.some((error) => error.includes("persistent_story_id")),
    false,
  );
});

test("D3 sends exact confirming Dossier Story evidence through the existing A3 plan", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet(),
    analyticalOutput: analyticalOutput(),
    stories: [
      { id: STORY_ID, slug: "us-rate-regime", status: "active", confidence: 0.8 },
    ],
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_ROW_ID]),
    queueEvidenceIdByCanonicalRef: new Map([[CANONICAL_REF, EVIDENCE_ROW_ID]]),
  });

  assert.equal(plan.items.length, 1);
  assert.deepEqual(plan.items[0], {
    motion_id: null,
    decision: null,
    source_kind: "dossier_story_evidence",
    source_ref: ANALYTICAL_STORY_ID,
    evidence_classification: "CONFIRMING",
    canonical_evidence_ref: CANONICAL_REF,
    canonical_evidence_id: EVIDENCE_ROW_ID,
    target_story_id: STORY_ID,
    target_story_slug: "us-rate-regime",
    target_regime_slug: null,
    route_kind: "dossier_persistent_story",
    priority: 85,
    route_reason:
      "dossier_story:story:rates-duration-stress|classification:CONFIRMING",
  });
});

test("D3 fails closed when Dossier Story identity does not match the packet binding", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet(),
    analyticalOutput: analyticalOutput(
      majorStory({ persistent_story_id: OTHER_STORY_ID }),
    ),
    stories: [
      { id: STORY_ID, slug: "us-rate-regime", status: "active", confidence: 0.8 },
      { id: OTHER_STORY_ID, slug: "other-story", status: "active", confidence: 0.8 },
    ],
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_ROW_ID]),
    queueEvidenceIdByCanonicalRef: new Map([[CANONICAL_REF, EVIDENCE_ROW_ID]]),
  });

  assert.equal(plan.items.length, 0);
  assert.equal(
    plan.warnings.some((warning) => warning.includes("not backed by the exact packet binding")),
    true,
  );
});

test("D2 suppresses ambiguous multi-bucket classification for the same canonical evidence", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet(),
    analyticalOutput: analyticalOutput(
      majorStory({
        market_evidence: {
          confirming: [CANONICAL_REF],
          contradicting: [],
          accelerating: [CANONICAL_REF],
          unresolved: [],
        },
      }),
    ),
    stories: [
      { id: STORY_ID, slug: "us-rate-regime", status: "active", confidence: 0.8 },
    ],
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_ROW_ID]),
    queueEvidenceIdByCanonicalRef: new Map([[CANONICAL_REF, EVIDENCE_ROW_ID]]),
  });

  assert.equal(plan.items.length, 0);
  assert.equal(
    plan.warnings.some((warning) => warning.includes("multiple Story evidence buckets")),
    true,
  );
});

test("D2 acceleration evidence receives a stronger A3 review priority without mutating Story directly", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet(),
    analyticalOutput: analyticalOutput(
      majorStory({
        market_evidence: {
          confirming: [],
          contradicting: [],
          accelerating: [CANONICAL_REF],
          unresolved: [],
        },
      }),
    ),
    stories: [
      { id: STORY_ID, slug: "us-rate-regime", status: "active", confidence: 0.8 },
    ],
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_ROW_ID]),
    queueEvidenceIdByCanonicalRef: new Map([[CANONICAL_REF, EVIDENCE_ROW_ID]]),
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0]?.evidence_classification, "ACCELERATING");
  assert.equal(plan.items[0]?.priority, 93);
  assert.equal(plan.items[0]?.route_kind, "dossier_persistent_story");
});
