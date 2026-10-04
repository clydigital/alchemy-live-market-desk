import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { DossierStoryReassessmentProposal } from "../lib/dossier-v2/motion-story-reassessment-proposal.ts";
import type { DossierStoryCanonicalPersistenceHandoff } from "../lib/dossier-v2/story-reassessment-persistence-handoff.ts";
import {
  DOSSIER_STORY_REASONING_MATERIALISATION_VERSION,
  materialiseDossierStoryCanonicalReasoning,
  type DossierStoryCanonicalReasoningInput,
} from "../lib/dossier-v2/story-reassessment-reasoning-materialisation.ts";

const STORY_ID = "story-rates";
const BASE_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";

function proposal(
  overrides: Partial<DossierStoryReassessmentProposal> = {},
): DossierStoryReassessmentProposal {
  return {
    contract_version: "dossier-story-reassessment-proposal/1",
    authority: "PROPOSAL_ONLY",
    proposal_kind: "REASSESS_EXISTING_STORY",
    dossier_id: "dossier-1",
    motion_id: "motion-1",
    story_id: STORY_ID,
    decision: "ACCEPT",
    canonical_reassessment_scope: "STORY",
    expected_base_version_id: BASE_VERSION_ID,
    baseline: {
      thesis: "Higher long-end yields keep financial conditions restrictive.",
      status: "developing",
      confidence: 72,
      market_question: "Are long-end yields becoming a durable cost-of-capital regime?",
    },
    packet_evidence_reference: "verified-macro:rates-1",
    required_canonical_evidence_ids: [EVIDENCE_ID],
    dossier_reason: "System 2 accepted the evidence-bounded implication.",
    story_implication: "MOTION-TEXT-MUST-NOT-BE-INJECTED-AUTOMATICALLY",
    regime_implication: null,
    investigation_next: "Check the next rates discriminator.",
    refined_motion: null,
    requested_update: {
      action: "REASSESS_WITH_CANONICAL_EVIDENCE",
      implication: "MOTION-TEXT-MUST-NOT-BE-INJECTED-AUTOMATICALLY",
    },
    ...overrides,
  };
}

function handoff(
  overrides: Partial<DossierStoryCanonicalPersistenceHandoff> = {},
): DossierStoryCanonicalPersistenceHandoff {
  return {
    contract_version: "dossier-story-canonical-handoff/1",
    authority: "HANDOFF_ONLY",
    mutation_kind: "existing_story_update",
    writer_route: "rpc/persist_canonical_story_reasoning",
    required_reasoning_contract: "canonical-story-reasoning/v1",
    mutation_key: `dossier-story-reassessment:${STORY_ID}:${BASE_VERSION_ID}:stable`,
    dossier_id: "dossier-1",
    motion_id: "motion-1",
    story_id: STORY_ID,
    expected_base_version_id: BASE_VERSION_ID,
    decision: "ACCEPT",
    canonical_reassessment_scope: "STORY",
    required_canonical_evidence_ids: [EVIDENCE_ID],
    proposal_fingerprint: "proposal-fingerprint",
    ...overrides,
  };
}

function reassessment(
  overrides: Partial<DossierStoryCanonicalReasoningInput> = {},
): DossierStoryCanonicalReasoningInput {
  return {
    synthesis: {
      lifecycleStatus: "developing",
      thesis: "Long-end yields remain restrictive, but the latest evidence narrows the mechanism.",
      whatChanged: "The latest canonical rates evidence narrows the transmission path.",
      previousState: "The Story treated broad yields as the dominant financing constraint.",
      currentState: "The evidence now points specifically to persistent long-end pressure.",
      marketReaction: null,
      acceptedExplanation: "Persistent long-end yields continue to transmit through financing costs.",
      acceptedExplanationEvidenceIds: [EVIDENCE_ID],
      overlookedVariable: null,
      overlookedVariableEvidenceStatus: null,
      overlookedVariableEvidenceIds: [],
      marketMayBeRight: null,
      decisiveEvidenceIds: [EVIDENCE_ID],
    },
    hypothesis: {
      id: "hyp-dossier-rates-1",
      statement: "Persistent long-end yields keep financing conditions restrictive.",
      mechanism: "Higher long-end yields raise the cost of capital and constrain duration-sensitive valuations.",
      mechanismCode: "UNKNOWN",
      confidence: 74,
      evidenceForIds: [EVIDENCE_ID],
      evidenceAgainstIds: [],
      causalChain: [{
        from: "Persistent long-end yields",
        relationship: "raise",
        to: "cost of capital",
        evidenceState: "strongly_supported",
        evidenceIds: [EVIDENCE_ID],
      }],
      confirmationCriteria: ["Long-end yields remain elevated while financing conditions stay restrictive."],
      invalidationCriteria: ["Long-end yields fall materially without a corresponding easing in financing conditions."],
    },
    competingHypotheses: [],
    challenger: null,
    scenarios: [],
    evidence: [{
      id: EVIDENCE_ID,
      claim: "Canonical market evidence shows long-end yields remained elevated.",
    }],
    ...overrides,
  };
}

test("B4.4 materialises through the existing canonical Story reasoning contract", () => {
  const result = materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: reassessment(),
  });

  assert.ok(result);
  assert.equal(result.contract_version, DOSSIER_STORY_REASONING_MATERIALISATION_VERSION);
  assert.equal(result.authority, "CANONICAL_REASONING_PAYLOAD_ONLY");
  assert.equal(result.reasoning_contract, "canonical-story-reasoning/v1");
  assert.equal(result.reasoning.contractVersion, "canonical-story-reasoning/v1");
  assert.equal(result.story_id, STORY_ID);
  assert.equal(result.expected_base_version_id, BASE_VERSION_ID);
  assert.equal(result.mutation_key, handoff().mutation_key);
});

test("B4.4 exact Dossier packet evidence remains decisive fact and thesis support", () => {
  const result = materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: reassessment(),
  });

  assert.ok(result);
  assert.deepEqual(result.required_canonical_evidence_ids, [EVIDENCE_ID]);

  const fact = result.reasoning.claims.find((claim) => claim.type === "fact");
  const thesis = result.reasoning.claims.find((claim) => claim.type === "thesis");
  assert.deepEqual(fact?.evidenceIds, [EVIDENCE_ID]);
  assert.deepEqual(thesis?.evidenceIds, [EVIDENCE_ID]);
});

test("B4.4 may use additional canonical Story evidence without displacing required packet evidence", () => {
  const input = reassessment();
  input.evidence.push({
    id: OTHER_EVIDENCE_ID,
    claim: "A second canonical record provides supporting market context.",
  });
  input.synthesis.decisiveEvidenceIds.push(OTHER_EVIDENCE_ID);
  input.hypothesis.evidenceForIds.push(OTHER_EVIDENCE_ID);

  const result = materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: input,
  });

  assert.ok(result);
  const thesis = result.reasoning.claims.find((claim) => claim.type === "thesis");
  assert.deepEqual(thesis?.evidenceIds, [EVIDENCE_ID, OTHER_EVIDENCE_ID]);
  assert.deepEqual(result.required_canonical_evidence_ids, [EVIDENCE_ID]);
});

test("B4.4 fails closed when required packet evidence is absent from canonical evidence registry", () => {
  const input = reassessment({
    evidence: [{
      id: OTHER_EVIDENCE_ID,
      claim: "Unrelated canonical evidence.",
    }],
  });

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: input,
  }), null);
});

test("B4.4 fails closed when packet evidence is loaded but not decisive", () => {
  const input = reassessment();
  input.synthesis.decisiveEvidenceIds = [];

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: input,
  }), null);
});

test("B4.4 fails closed when packet evidence does not support the reassessed thesis", () => {
  const input = reassessment();
  input.hypothesis.evidenceForIds = [];

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: input,
  }), null);
});

test("B4.4 accepts only canonical UUID evidence identities", () => {
  const input = reassessment({
    evidence: [{
      id: "research-intake:rates-1",
      claim: "Non-canonical external identity.",
    }],
  });

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff({ required_canonical_evidence_ids: ["research-intake:rates-1"] }),
    reassessment: input,
  }), null);
});

test("B4.4 duplicate evidence registry rows fail closed", () => {
  const input = reassessment({
    evidence: [
      { id: EVIDENCE_ID, claim: "First copy." },
      { id: EVIDENCE_ID, claim: "Second copy." },
    ],
  });

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: input,
  }), null);
});

test("B4.4 canonical builder failures are contained and fail closed", () => {
  const input = reassessment();
  input.hypothesis.causalChain[0]!.evidenceIds = [OTHER_EVIDENCE_ID];

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: input,
  }), null);
});

test("B4.4 proposal/handoff identity mismatch fails closed", () => {
  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff({ story_id: "story-other" }),
    reassessment: reassessment(),
  }), null);

  assert.equal(materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff({ expected_base_version_id: "44444444-4444-4444-8444-444444444444" }),
    reassessment: reassessment(),
  }), null);
});

test("B4.4 does not automatically inject Motion framing into canonical reasoning", () => {
  const result = materialiseDossierStoryCanonicalReasoning({
    proposal: proposal(),
    handoff: handoff(),
    reassessment: reassessment(),
  });

  assert.ok(result);
  assert.equal(JSON.stringify(result.reasoning).includes("MOTION-TEXT-MUST-NOT-BE-INJECTED-AUTOMATICALLY"), false);
});

test("B4.4 is deterministic and does not mutate inputs", () => {
  const p = proposal();
  const h = handoff();
  const r = reassessment();
  const pBefore = structuredClone(p);
  const hBefore = structuredClone(h);
  const rBefore = structuredClone(r);

  const first = materialiseDossierStoryCanonicalReasoning({
    proposal: p,
    handoff: h,
    reassessment: r,
  });
  const second = materialiseDossierStoryCanonicalReasoning({
    proposal: p,
    handoff: h,
    reassessment: r,
  });

  assert.deepEqual(first, second);
  assert.deepEqual(p, pBefore);
  assert.deepEqual(h, hBefore);
  assert.deepEqual(r, rBefore);
  assert.equal(first?.reasoning_fingerprint, second?.reasoning_fingerprint);
});

test("B4.4 module has no Story/version/publication writer", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "dossier-v2", "story-reassessment-reasoning-materialisation.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /intelligenceRest\s*</);
  assert.doesNotMatch(source, /insert\s+into/i);
  assert.doesNotMatch(source, /story_thesis_versions/i);
  assert.doesNotMatch(source, /current_thesis_version_id\s*=/);
  assert.doesNotMatch(source, /hybrid_publication_snapshots/i);
  assert.match(source, /buildCanonicalStoryReasoningSnapshotV1/);
});
