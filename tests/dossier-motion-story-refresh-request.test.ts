import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierMotionStoryRefreshRequests,
  DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION,
  MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS,
} from "../lib/dossier-v2/motion-story-refresh-request.ts";
import type {
  ResearchBrainMotionAssessment,
  ResearchBrainMotionAttention,
} from "../lib/dossier-v2/research-brain-contracts.ts";

function motion(
  id: string,
  overrides: Partial<ResearchBrainMotionAttention> = {},
): ResearchBrainMotionAttention {
  return {
    motion_id: id,
    headline: `Motion ${id}`,
    what_happened: "A canonical development occurred.",
    market_reaction: null,
    why_interesting: "Tests the current Story.",
    big_picture_bridge: "Evidence -> Story -> Regime.",
    next_test: "Check the next discriminating signal.",
    primary_story_id: "story-rates",
    primary_regime_slug: "global-cost-of-capital",
    packet_evidence_id: `ev:${id}`,
    verification_state: "VERIFIED",
    materiality: 90,
    relevance: 90,
    novelty: 80,
    ...overrides,
  };
}

function assessment(
  id: string,
  decision: ResearchBrainMotionAssessment["decision"] = "ACCEPT",
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): ResearchBrainMotionAssessment {
  return {
    motion_id: id,
    decision,
    canonical_reassessment_scope:
      decision === "ACCEPT" || decision === "REFINE" ? "STORY" : "NONE",
    reason: "System 2 assessed the Motion against exact canonical packet evidence.",
    evidence_references: [`ev:${id}`],
    story_implication: decision === "ACCEPT" || decision === "REFINE"
      ? "Reassess the exact linked Story using this evidence-supported development."
      : null,
    regime_implication: null,
    investigation_next: null,
    refined_headline: decision === "REFINE" ? "Corrected evidence-bounded Motion" : null,
    refined_why_interesting: decision === "REFINE" ? "The narrower framing survives the evidence test." : null,
    refined_big_picture_bridge: decision === "REFINE" ? "Evidence -> corrected Story question -> Regime." : null,
    ...overrides,
  };
}

test("C1.1 Story ACCEPT becomes a reevaluation request, not a Story mutation", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-1")],
    assessments: [assessment("motion-1", "ACCEPT")],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.contract_version, DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION);
  assert.equal(result[0]?.request_kind, "REASSESS_STORY");
  assert.equal(result[0]?.authority, "REEVALUATION_REQUEST_ONLY");
  assert.equal(result[0]?.motion_id, "motion-1");
  assert.equal(result[0]?.story_id, "story-rates");
  assert.equal(result[0]?.packet_evidence_id, "ev:motion-1");
  assert.equal(result[0]?.decision, "ACCEPT");
  assert.equal(result[0]?.refined_motion, null);
});

test("C1.1 regime-only ACCEPT does not manufacture a Story refresh request", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-regime", { primary_story_id: null })],
    assessments: [assessment("motion-regime", "ACCEPT", {
      canonical_reassessment_scope: "REGIME",
      story_implication: null,
      regime_implication: "Reassess only the exact Regime.",
    })],
  });

  assert.deepEqual(result, []);
});

test("C1.3b explicit REGIME scope never emits a Story reassessment request even when a Story ID exists", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-regime-scoped")],
    assessments: [assessment("motion-regime-scoped", "ACCEPT", {
      canonical_reassessment_scope: "REGIME",
      story_implication: null,
      regime_implication: "Only the exact Regime requires reassessment.",
    })],
  });

  assert.deepEqual(result, []);
});

test("C1.1 REFINE carries only the explicit corrected framing into the Story request", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-refine")],
    assessments: [assessment("motion-refine", "REFINE")],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.decision, "REFINE");
  assert.deepEqual(result[0]?.refined_motion, {
    headline: "Corrected evidence-bounded Motion",
    why_interesting: "The narrower framing survives the evidence test.",
    big_picture_bridge: "Evidence -> corrected Story question -> Regime.",
  });
});

test("C1.1 UNRESOLVED and REJECT never become Story reassessment requests", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-u"), motion("motion-r")],
    assessments: [
      assessment("motion-u", "UNRESOLVED", {
        story_implication: null,
        regime_implication: null,
        investigation_next: "Fund the next discriminator.",
      }),
      assessment("motion-r", "REJECT", {
        story_implication: null,
        regime_implication: null,
      }),
    ],
  });

  assert.deepEqual(result, []);
});

test("C1.1 request fails closed unless the exact Motion packet evidence is cited", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-1")],
    assessments: [assessment("motion-1", "ACCEPT", {
      evidence_references: ["ev:other"],
    })],
  });

  assert.deepEqual(result, []);
});

test("C1.1 REFINE fails closed when corrected framing is incomplete", () => {
  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-1")],
    assessments: [assessment("motion-1", "REFINE", {
      refined_headline: null,
    })],
  });

  assert.deepEqual(result, []);
});

test("C1.1 request budget is deterministic and materiality-first", () => {
  const motions = Array.from({ length: 7 }, (_, index) => motion(`motion-${index}`, {
    materiality: 80 + index,
    relevance: 90,
    novelty: 80,
  }));
  const assessments = motions.map((item) => assessment(item.motion_id, "ACCEPT"));

  const result = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: motions,
    assessments,
  });

  assert.equal(result.length, MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS);
  assert.deepEqual(
    result.map((item) => item.motion_id),
    ["motion-6", "motion-5", "motion-4", "motion-3"],
  );
});
