import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierStoryReassessmentProposal,
  DOSSIER_STORY_REASSESSMENT_PROPOSAL_VERSION,
  type DossierStoryReassessmentBaseline,
} from "../lib/dossier-v2/motion-story-reassessment-proposal.ts";
import type { ResolvedDossierMotionStoryWakeTarget } from "../lib/dossier-v2/motion-story-wake-target.ts";

const STORY_ID = "story-rates";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const BASE_VERSION_ID = "22222222-2222-4222-8222-222222222222";

function target(
  overrides: Partial<ResolvedDossierMotionStoryWakeTarget> = {},
): ResolvedDossierMotionStoryWakeTarget {
  return {
    contract_version: "dossier-motion-story-wake-target/1",
    dossier_id: "dossier-1",
    motion_id: "motion-1",
    story_id: STORY_ID,
    decision: "ACCEPT",
    canonical_reassessment_scope: "STORY",
    packet_evidence_reference: "verified-macro:rates-1",
    canonical_evidence_id: EVIDENCE_ID,
    story_implication: "Reassess whether the current rates thesis still holds.",
    reason: "System 2 accepted the evidence-bounded implication.",
    regime_implication: null,
    investigation_next: "Check the next rates discriminator.",
    refined_motion: null,
    priority_signals: {
      materiality: 94,
      relevance: 95,
      novelty: 84,
    },
    ...overrides,
  };
}

function story(
  overrides: Partial<DossierStoryReassessmentBaseline> = {},
): DossierStoryReassessmentBaseline {
  return {
    id: STORY_ID,
    current_thesis_version_id: BASE_VERSION_ID,
    thesis: "Higher long-end yields keep financial conditions restrictive.",
    status: "developing",
    confidence: 72,
    market_question: "Are higher long-end yields becoming a durable cost-of-capital regime?",
    ...overrides,
  };
}

test("B4.2 ACCEPT becomes a proposal bound to the exact current thesis version", () => {
  const result = buildDossierStoryReassessmentProposal({
    target: target(),
    story: story(),
  });

  assert.ok(result);
  assert.equal(result.contract_version, DOSSIER_STORY_REASSESSMENT_PROPOSAL_VERSION);
  assert.equal(result.authority, "PROPOSAL_ONLY");
  assert.equal(result.proposal_kind, "REASSESS_EXISTING_STORY");
  assert.equal(result.story_id, STORY_ID);
  assert.equal(result.expected_base_version_id, BASE_VERSION_ID);
  assert.deepEqual(result.required_canonical_evidence_ids, [EVIDENCE_ID]);
  assert.deepEqual(result.requested_update, {
    action: "REASSESS_WITH_CANONICAL_EVIDENCE",
    implication: "Reassess whether the current rates thesis still holds.",
  });
});

test("B4.2 freezes the current Story thesis as baseline but does not invent the next thesis", () => {
  const result = buildDossierStoryReassessmentProposal({
    target: target(),
    story: story(),
  });

  assert.ok(result);
  assert.deepEqual(result.baseline, {
    thesis: "Higher long-end yields keep financial conditions restrictive.",
    status: "developing",
    confidence: 72,
    market_question: "Are higher long-end yields becoming a durable cost-of-capital regime?",
  });
  assert.equal("new_thesis" in result, false);
  assert.equal("proposed_thesis" in result, false);
  assert.equal("new_confidence" in result, false);
  assert.equal("proposed_status" in result, false);
});

test("B4.2 REFINE preserves only the corrected framing supplied by B4.1", () => {
  const refinedMotion = {
    headline: "Narrower evidence-bounded rates framing",
    why_interesting: "Only the long-end mechanism survives.",
    big_picture_bridge: "Long-end yields -> financing costs -> valuation.",
  };
  const result = buildDossierStoryReassessmentProposal({
    target: target({
      decision: "REFINE",
      refined_motion: refinedMotion,
    }),
    story: story(),
  });

  assert.ok(result);
  assert.equal(result.decision, "REFINE");
  assert.deepEqual(result.refined_motion, refinedMotion);
});

test("B4.2 STORY_AND_REGIME preserves scope without granting Regime mutation authority", () => {
  const result = buildDossierStoryReassessmentProposal({
    target: target({
      canonical_reassessment_scope: "STORY_AND_REGIME",
      regime_implication: "This may later require Regime reassessment.",
    }),
    story: story(),
  });

  assert.ok(result);
  assert.equal(result.canonical_reassessment_scope, "STORY_AND_REGIME");
  assert.equal(result.regime_implication, "This may later require Regime reassessment.");
  assert.equal(result.authority, "PROPOSAL_ONLY");
});

test("B4.2 exact Story mismatch fails closed", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target(),
    story: story({ id: "story-other" }),
  }), null);
});

test("B4.2 missing or invalid immutable base version fails closed", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target(),
    story: story({ current_thesis_version_id: null }),
  }), null);

  assert.equal(buildDossierStoryReassessmentProposal({
    target: target(),
    story: story({ current_thesis_version_id: "not-a-uuid" }),
  }), null);
});

test("B4.2 discarded Story fails closed", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target(),
    story: story({ status: "discarded" }),
  }), null);
});

test("B4.2 empty baseline thesis fails closed", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target(),
    story: story({ thesis: "   " }),
  }), null);
});

test("B4.2 only admits a canonical evidence UUID", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target({ canonical_evidence_id: "verified-macro:rates-1" }),
    story: story(),
  }), null);
});

test("B4.2 non-finite confidence fails closed", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target(),
    story: story({ confidence: Number.NaN }),
  }), null);
});

test("B4.2 incomplete REFINE fails closed even if a caller bypasses B4.1", () => {
  assert.equal(buildDossierStoryReassessmentProposal({
    target: target({
      decision: "REFINE",
      refined_motion: {
        headline: "",
        why_interesting: "Narrower framing.",
        big_picture_bridge: "Evidence -> Story.",
      },
    }),
    story: story(),
  }), null);
});

test("B4.2 is deterministic and does not mutate its inputs", () => {
  const wakeTarget = target();
  const baselineStory = story();
  const targetBefore = structuredClone(wakeTarget);
  const storyBefore = structuredClone(baselineStory);

  const first = buildDossierStoryReassessmentProposal({
    target: wakeTarget,
    story: baselineStory,
  });
  const second = buildDossierStoryReassessmentProposal({
    target: wakeTarget,
    story: baselineStory,
  });

  assert.deepEqual(first, second);
  assert.deepEqual(wakeTarget, targetBefore);
  assert.deepEqual(baselineStory, storyBefore);
});

test("B4.2 carries exactly the required canonical packet evidence, not unresolved Motion refs", () => {
  const result = buildDossierStoryReassessmentProposal({
    target: target({
      packet_evidence_reference: "research-intake:rates-1",
      canonical_evidence_id: EVIDENCE_ID,
    }),
    story: story(),
  });

  assert.ok(result);
  assert.equal(result.packet_evidence_reference, "research-intake:rates-1");
  assert.deepEqual(result.required_canonical_evidence_ids, [EVIDENCE_ID]);
  assert.equal(result.required_canonical_evidence_ids.every((id) => id.includes("-")), true);
});
