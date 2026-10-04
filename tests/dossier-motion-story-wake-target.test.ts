import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierMotionStoryRefreshRequests,
  type DossierMotionStoryRefreshRequest,
  MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS,
} from "../lib/dossier-v2/motion-story-refresh-request.ts";
import {
  DOSSIER_MOTION_STORY_WAKE_TARGET_VERSION,
  resolveDossierMotionStoryWakeTarget,
  resolveDossierMotionStoryWakeTargets,
} from "../lib/dossier-v2/motion-story-wake-target.ts";
import type {
  ResearchBrainMotionAssessment,
  ResearchBrainMotionAttention,
} from "../lib/dossier-v2/research-brain-contracts.ts";

const EVIDENCE_1 = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_2 = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_3 = "33333333-3333-4333-8333-333333333333";
const EVIDENCE_4 = "44444444-4444-4444-8444-444444444444";
const EVIDENCE_5 = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_6 = "66666666-6666-4666-8666-666666666666";

function request(
  overrides: Partial<DossierMotionStoryRefreshRequest> = {},
): DossierMotionStoryRefreshRequest {
  return {
    contract_version: "dossier-motion-story-refresh-request/1",
    dossier_id: "dossier-1",
    request_kind: "REASSESS_STORY",
    authority: "REEVALUATION_REQUEST_ONLY",
    motion_id: "motion-1",
    story_id: "story-rates",
    packet_evidence_id: EVIDENCE_1,
    decision: "ACCEPT",
    canonical_reassessment_scope: "STORY",
    reason: "System 2 accepted the evidence-bounded reassessment.",
    evidence_references: [EVIDENCE_1],
    story_implication: "Reassess the exact linked Story.",
    regime_implication: null,
    investigation_next: null,
    refined_motion: null,
    priority_signals: {
      materiality: 90,
      relevance: 90,
      novelty: 80,
    },
    ...overrides,
  };
}

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
    packet_evidence_id: EVIDENCE_1,
    verification_state: "VERIFIED",
    materiality: 90,
    relevance: 90,
    novelty: 80,
    ...overrides,
  };
}

function assessment(
  id: string,
  decision: ResearchBrainMotionAssessment["decision"],
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): ResearchBrainMotionAssessment {
  return {
    motion_id: id,
    decision,
    canonical_reassessment_scope:
      decision === "ACCEPT" || decision === "REFINE" ? "STORY" : "NONE",
    reason: "System 2 assessed exact canonical packet evidence.",
    evidence_references: [EVIDENCE_1],
    story_implication:
      decision === "ACCEPT" || decision === "REFINE"
        ? "Reassess the exact linked Story."
        : null,
    regime_implication: null,
    investigation_next: null,
    refined_headline: decision === "REFINE" ? "Refined Motion" : null,
    refined_why_interesting: decision === "REFINE" ? "Narrower framing survives." : null,
    refined_big_picture_bridge: decision === "REFINE" ? "Evidence -> Story." : null,
    ...overrides,
  };
}

const activeStory = [{ id: "story-rates", status: "active" }];

test("B4.1 ACCEPT + canonical UUID resolves exact Story and evidence UUID", () => {
  const result = resolveDossierMotionStoryWakeTarget({
    request: request(),
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_1, external_evidence_id: "verified-macro:rates-1" }],
  });

  assert.ok(result);
  assert.equal(result.contract_version, DOSSIER_MOTION_STORY_WAKE_TARGET_VERSION);
  assert.equal(result.story_id, "story-rates");
  assert.equal(result.packet_evidence_reference, EVIDENCE_1);
  assert.equal(result.canonical_evidence_id, EVIDENCE_1);
  assert.equal(result.decision, "ACCEPT");
});

test("B4.1 ev:<uuid> resolves to the same canonical UUID", () => {
  const packetRef = `ev:${EVIDENCE_1}`;
  const result = resolveDossierMotionStoryWakeTarget({
    request: request({
      packet_evidence_id: packetRef,
      evidence_references: [packetRef],
    }),
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_1 }],
  });

  assert.ok(result);
  assert.equal(result.packet_evidence_reference, packetRef);
  assert.equal(result.canonical_evidence_id, EVIDENCE_1);
});

test("B4.1 external evidence identity resolves to canonical database UUID", () => {
  const externalId = "verified-macro:rates-1";
  const result = resolveDossierMotionStoryWakeTarget({
    request: request({
      packet_evidence_id: externalId,
      evidence_references: [externalId],
    }),
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_1, external_evidence_id: externalId }],
  });

  assert.ok(result);
  assert.equal(result.packet_evidence_reference, externalId);
  assert.equal(result.canonical_evidence_id, EVIDENCE_1);
});

test("B4.1 valid REFINE resolves and preserves only its explicit refined framing", () => {
  const result = resolveDossierMotionStoryWakeTarget({
    request: request({
      decision: "REFINE",
      refined_motion: {
        headline: "Refined Motion",
        why_interesting: "Narrower framing survives.",
        big_picture_bridge: "Evidence -> corrected Story.",
      },
    }),
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_1 }],
  });

  assert.ok(result);
  assert.equal(result.decision, "REFINE");
  assert.deepEqual(result.refined_motion, {
    headline: "Refined Motion",
    why_interesting: "Narrower framing survives.",
    big_picture_bridge: "Evidence -> corrected Story.",
  });
});

test("B4.1 REJECT produces no request and therefore no wake target", () => {
  const requests = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-reject")],
    assessments: [assessment("motion-reject", "REJECT")],
  });

  assert.deepEqual(requests, []);
  assert.deepEqual(resolveDossierMotionStoryWakeTargets({
    requests,
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_1 }],
  }), []);
});

test("B4.1 UNRESOLVED produces no request and therefore no wake target", () => {
  const requests = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-unresolved")],
    assessments: [assessment("motion-unresolved", "UNRESOLVED", {
      investigation_next: "Fund the next discriminator.",
    })],
  });

  assert.deepEqual(requests, []);
  assert.deepEqual(resolveDossierMotionStoryWakeTargets({
    requests,
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_1 }],
  }), []);
});

test("B4.1 missing exact Story fails closed", () => {
  const result = resolveDossierMotionStoryWakeTarget({
    request: request(),
    stories: [{ id: "story-other", status: "active" }],
    evidenceRows: [{ id: EVIDENCE_1 }],
  });

  assert.equal(result, null);
});

test("B4.1 discarded exact Story fails closed", () => {
  const result = resolveDossierMotionStoryWakeTarget({
    request: request(),
    stories: [{ id: "story-rates", status: "discarded" }],
    evidenceRows: [{ id: EVIDENCE_1 }],
  });

  assert.equal(result, null);
});

test("B4.1 packet evidence missing from canonical registry fails closed", () => {
  const result = resolveDossierMotionStoryWakeTarget({
    request: request(),
    stories: activeStory,
    evidenceRows: [{ id: EVIDENCE_2 }],
  });

  assert.equal(result, null);
});

test("B4.1 matching external evidence row with non-UUID database id fails closed", () => {
  const externalId = "research-intake:rates-1";
  const result = resolveDossierMotionStoryWakeTarget({
    request: request({
      packet_evidence_id: externalId,
      evidence_references: [externalId],
    }),
    stories: activeStory,
    evidenceRows: [{ id: "not-a-canonical-uuid", external_evidence_id: externalId }],
  });

  assert.equal(result, null);
});

test("B4.1 request builder fails closed when assessment does not cite exact packet evidence", () => {
  const requests = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-uncited")],
    assessments: [assessment("motion-uncited", "ACCEPT", {
      evidence_references: [EVIDENCE_2],
    })],
  });

  assert.deepEqual(requests, []);
});

test("B4.1 incomplete REFINE fails before canonical wake resolution", () => {
  const requests = buildDossierMotionStoryRefreshRequests({
    dossierId: "dossier-1",
    motionAttention: [motion("motion-refine")],
    assessments: [assessment("motion-refine", "REFINE", {
      refined_headline: null,
    })],
  });

  assert.deepEqual(requests, []);
});

test("B4.1 ambiguous external evidence identity fails closed", () => {
  const externalId = "verified-macro:ambiguous";
  const result = resolveDossierMotionStoryWakeTarget({
    request: request({
      packet_evidence_id: externalId,
      evidence_references: [externalId],
    }),
    stories: activeStory,
    evidenceRows: [
      { id: EVIDENCE_1, external_evidence_id: externalId },
      { id: EVIDENCE_2, external_evidence_id: externalId },
    ],
  });

  assert.equal(result, null);
});

test("B4.1 duplicate exact Story identities fail closed rather than choosing a row", () => {
  const result = resolveDossierMotionStoryWakeTarget({
    request: request(),
    stories: [
      { id: "story-rates", status: "active" },
      { id: "story-rates", status: "archived" },
    ],
    evidenceRows: [{ id: EVIDENCE_1 }],
  });

  assert.equal(result, null);
});

test("B4.1 multiple valid requests are deterministic, materiality-first, and capped at four", () => {
  const evidenceIds = [
    EVIDENCE_1,
    EVIDENCE_2,
    EVIDENCE_3,
    EVIDENCE_4,
    EVIDENCE_5,
    EVIDENCE_6,
  ];
  const requests = evidenceIds.map((evidenceId, index) => request({
    motion_id: `motion-${index}`,
    story_id: `story-${index}`,
    packet_evidence_id: evidenceId,
    evidence_references: [evidenceId],
    priority_signals: {
      materiality: 80 + index,
      relevance: 90,
      novelty: 80,
    },
  }));

  const result = resolveDossierMotionStoryWakeTargets({
    requests,
    stories: evidenceIds.map((_, index) => ({ id: `story-${index}`, status: "active" })),
    evidenceRows: evidenceIds.map((id) => ({ id })),
  });

  assert.equal(result.length, MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS);
  assert.deepEqual(
    result.map((item) => item.motion_id),
    ["motion-5", "motion-4", "motion-3", "motion-2"],
  );
});
