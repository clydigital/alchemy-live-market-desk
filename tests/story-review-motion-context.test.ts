import assert from "node:assert/strict";
import test from "node:test";

import {
  extractDossierMotionStoryReviewContext,
  parseDossierMotionRefreshReason,
  resolveDossierMotionStoryReviewContexts,
  STORY_REVIEW_MOTION_CONTEXT_VERSION,
} from "../lib/intelligence/story-review-motion-context.ts";

const DOSSIER_ID = "55555555-5555-4555-8555-555555555555";
const MOTION_ID = "11111111-1111-4111-8111-111111111111";
const STORY_ID = "22222222-2222-4222-8222-222222222222";
const PACKET_EVIDENCE_ID = "research-intake:exact-item";

function payload(input: {
  decision?: "ACCEPT" | "REFINE";
  scope?: "STORY" | "STORY_AND_REGIME";
  storyId?: string | null;
  packetEvidenceId?: string;
  evidenceReferences?: string[];
  refinedHeadline?: string | null;
}) {
  const decision = input.decision ?? "REFINE";
  return {
    motion_attention_snapshot: [{
      motion_id: MOTION_ID,
      headline: "Original over-broad Motion headline",
      what_happened: "A supported development occurred.",
      market_reaction: "Rates stayed elevated.",
      why_interesting: "Original over-broad Motion why.",
      big_picture_bridge: "Original over-broad Motion bridge.",
      next_test: "Check the next discriminator.",
      primary_story_id: input.storyId === undefined ? STORY_ID : input.storyId,
      primary_regime_slug: "global-cost-of-capital",
      packet_evidence_id: input.packetEvidenceId ?? PACKET_EVIDENCE_ID,
      verification_state: "VERIFIED",
      materiality: 94,
      relevance: 95,
      novelty: 84,
    }],
    analytical_output: {
      motion_attention_assessments: [{
        motion_id: MOTION_ID,
        decision,
        canonical_reassessment_scope: input.scope ?? "STORY",
        reason: "System 2 evaluated the exact Motion against canonical evidence.",
        evidence_references: input.evidenceReferences ?? [PACKET_EVIDENCE_ID],
        story_implication: "Reassess the exact linked Story using the narrower evidence-supported framing.",
        regime_implication: null,
        investigation_next: "Test whether the narrower mechanism persists.",
        refined_headline: decision === "REFINE"
          ? (input.refinedHeadline === undefined ? "Corrected evidence-bounded headline" : input.refinedHeadline)
          : null,
        refined_why_interesting: decision === "REFINE"
          ? "Corrected evidence-bounded why."
          : null,
        refined_big_picture_bridge: decision === "REFINE"
          ? "Corrected evidence-bounded bridge."
          : null,
      }],
    },
  };
}

test("C1.4a parses only exact Dossier Motion refresh reasons", () => {
  assert.deepEqual(
    parseDossierMotionRefreshReason(`dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:REFINE`),
    {
      dossierId: DOSSIER_ID,
      motionId: MOTION_ID,
      decision: "REFINE",
    },
  );
  assert.equal(parseDossierMotionRefreshReason("dossier_motion_refresh:bad"), null);
  assert.equal(parseDossierMotionRefreshReason(`dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:UNRESOLVED`), null);
});

test("C1.4a REFINE Story context exposes only corrected framing", () => {
  const result = extractDossierMotionStoryReviewContext({
    dossierId: DOSSIER_ID,
    storyId: STORY_ID,
    packetEvidenceId: PACKET_EVIDENCE_ID,
    canonicalEvidenceId: "44444444-4444-4444-8444-444444444444",
    queueReason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:REFINE`,
    dossierPayload: payload({ decision: "REFINE" }),
  });

  assert.ok(result);
  assert.equal(result?.contractVersion, STORY_REVIEW_MOTION_CONTEXT_VERSION);
  assert.equal(result?.authority, "CONTEXT_ONLY");
  assert.equal(result?.decision, "REFINE");
  assert.equal(result?.canonicalEvidenceId, "44444444-4444-4444-8444-444444444444");
  assert.deepEqual(result?.framing, {
    headline: "Corrected evidence-bounded headline",
    whyInteresting: "Corrected evidence-bounded why.",
    bigPictureBridge: "Corrected evidence-bounded bridge.",
  });
  assert.notEqual(result?.framing.headline, "Original over-broad Motion headline");
  assert.notEqual(result?.framing.whyInteresting, "Original over-broad Motion why.");
  assert.notEqual(result?.framing.bigPictureBridge, "Original over-broad Motion bridge.");
});

test("C1.4a ACCEPT may carry the already accepted original Motion framing", () => {
  const result = extractDossierMotionStoryReviewContext({
    dossierId: DOSSIER_ID,
    storyId: STORY_ID,
    packetEvidenceId: PACKET_EVIDENCE_ID,
    canonicalEvidenceId: "44444444-4444-4444-8444-444444444444",
    queueReason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:ACCEPT`,
    dossierPayload: payload({ decision: "ACCEPT" }),
  });

  assert.deepEqual(result?.framing, {
    headline: "Original over-broad Motion headline",
    whyInteresting: "Original over-broad Motion why.",
    bigPictureBridge: "Original over-broad Motion bridge.",
  });
});

test("C1.4a fails closed on exact Dossier, Story, Motion-evidence or assessment mismatch", () => {
  const common = {
    dossierId: DOSSIER_ID,
    storyId: STORY_ID,
    packetEvidenceId: PACKET_EVIDENCE_ID,
    canonicalEvidenceId: "44444444-4444-4444-8444-444444444444",
    queueReason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:REFINE`,
  };

  assert.equal(extractDossierMotionStoryReviewContext({
    ...common,
    dossierId: "other-dossier",
    dossierPayload: payload({ decision: "REFINE" }),
  }), null);

  assert.equal(extractDossierMotionStoryReviewContext({
    ...common,
    storyId: "other-story",
    dossierPayload: payload({ decision: "REFINE" }),
  }), null);

  assert.equal(extractDossierMotionStoryReviewContext({
    ...common,
    packetEvidenceId: "ev:other",
    dossierPayload: payload({ decision: "REFINE" }),
  }), null);

  assert.equal(extractDossierMotionStoryReviewContext({
    ...common,
    dossierPayload: payload({ decision: "ACCEPT" }),
  }), null);

  assert.equal(extractDossierMotionStoryReviewContext({
    ...common,
    dossierPayload: payload({ decision: "REFINE", evidenceReferences: ["ev:other"] }),
  }), null);
});

test("C1.4a fails closed if REFINE corrected framing is incomplete", () => {
  const result = extractDossierMotionStoryReviewContext({
    dossierId: DOSSIER_ID,
    storyId: STORY_ID,
    packetEvidenceId: PACKET_EVIDENCE_ID,
    canonicalEvidenceId: "44444444-4444-4444-8444-444444444444",
    queueReason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:REFINE`,
    dossierPayload: payload({ decision: "REFINE", refinedHeadline: null }),
  });

  assert.equal(result, null);
});

test("C1.4a only admits Story-bearing canonical scopes", () => {
  const result = extractDossierMotionStoryReviewContext({
    dossierId: DOSSIER_ID,
    storyId: STORY_ID,
    packetEvidenceId: PACKET_EVIDENCE_ID,
    canonicalEvidenceId: "44444444-4444-4444-8444-444444444444",
    queueReason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:ACCEPT`,
    dossierPayload: {
      ...payload({ decision: "ACCEPT" }),
      analytical_output: {
        motion_attention_assessments: [{
          motion_id: MOTION_ID,
          decision: "ACCEPT",
          canonical_reassessment_scope: "REGIME",
          reason: "Regime only.",
          evidence_references: [PACKET_EVIDENCE_ID],
          story_implication: "Stale Story prose.",
          regime_implication: "Reassess Regime only.",
          investigation_next: null,
          refined_headline: null,
          refined_why_interesting: null,
          refined_big_picture_bridge: null,
        }],
      },
    },
  });

  assert.equal(result, null);
});


test("C1.4b resolver joins queue row to exact Dossier payload and canonical packet evidence identity", () => {
  const queueId = "queue-1";
  const result = resolveDossierMotionStoryReviewContexts({
    queueRows: [{
      id: queueId,
      target_id: STORY_ID,
      reason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:REFINE`,
      requested_by_evidence_id: "44444444-4444-4444-8444-444444444444",
    }],
    dossiers: [{
      id: DOSSIER_ID,
      payload: payload({ decision: "REFINE" }),
    }],
    evidenceRows: [{
      id: "44444444-4444-4444-8444-444444444444",
      external_evidence_id: PACKET_EVIDENCE_ID,
    }],
  });

  assert.equal(result.size, 1);
  assert.equal(result.get(queueId)?.motionId, MOTION_ID);
  assert.equal(result.get(queueId)?.framing.headline, "Corrected evidence-bounded headline");
});

test("C1.4b resolver fails closed on missing Dossier or evidence identity", () => {
  const row = {
    id: "queue-1",
    target_id: STORY_ID,
    reason: `dossier_motion_refresh:${DOSSIER_ID}:${MOTION_ID}:REFINE`,
    requested_by_evidence_id: "44444444-4444-4444-8444-444444444444",
  };

  assert.equal(resolveDossierMotionStoryReviewContexts({
    queueRows: [row],
    dossiers: [],
    evidenceRows: [{
      id: "44444444-4444-4444-8444-444444444444",
      external_evidence_id: PACKET_EVIDENCE_ID,
    }],
  }).size, 0);

  assert.equal(resolveDossierMotionStoryReviewContexts({
    queueRows: [row],
    dossiers: [{ id: DOSSIER_ID, payload: payload({ decision: "REFINE" }) }],
    evidenceRows: [],
  }).size, 0);
});
