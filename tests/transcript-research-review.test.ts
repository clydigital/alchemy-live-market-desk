import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedTranscriptForReview,
  normaliseTranscriptResearchReview,
  type TranscriptResearchReview,
} from "../lib/transcript-research-review-contract.ts";

function review(overrides: Partial<TranscriptResearchReview> = {}): TranscriptResearchReview {
  return {
    summary: "The creator argues that higher long yields pressure AI valuations while memory demand remains firm.",
    creatorLogic: "Treasury yields rise -> discount rates rise -> long-duration equity multiples compress.",
    recontextualizedSummary: "Treat the yield claim as a lead and verify Treasury data before changing the AI thesis.",
    termsDetected: ["Treasury yields", "discount rate"],
    claimChecks: [{
      claim: "The 30-year Treasury yield rose sharply.",
      kind: "cited_fact",
      verificationNeeded: true,
      verificationTarget: "Official or direct Treasury-market data",
    }],
    expertNotes: [{ kind: "causal_link", note: "Higher yields can compress long-duration valuation multiples." }],
    affectedStorySlugs: ["ai-capex-cash-conversion"],
    researchLeadScore: 78,
    ...overrides,
  };
}

test("filters invented or stale Story slugs out of transcript review output", () => {
  const normalized = normaliseTranscriptResearchReview(review({
    affectedStorySlugs: ["ai-capex-cash-conversion", "invented-story"],
  }), new Set(["ai-capex-cash-conversion"]));
  assert.deepEqual(normalized.affectedStorySlugs, ["ai-capex-cash-conversion"]);
});

test("deduplicates terms and bounds research lead score", () => {
  const normalized = normaliseTranscriptResearchReview(review({
    termsDetected: ["Treasury yields", "Treasury yields", "Discount rates"],
    researchLeadScore: 122,
  }), new Set(["ai-capex-cash-conversion"]));
  assert.deepEqual(normalized.termsDetected, ["Treasury yields", "Discount rates"]);
  assert.equal(normalized.researchLeadScore, 100);
});

test("preserves verification requirements instead of treating creator claims as proof", () => {
  const normalized = normaliseTranscriptResearchReview(review(), new Set(["ai-capex-cash-conversion"]));
  assert.equal(normalized.claimChecks[0]?.verificationNeeded, true);
  assert.equal(normalized.claimChecks[0]?.kind, "cited_fact");
});

test("bounded transcript keeps both the creator frame and closing conditions", () => {
  const input = `OPENING-${"a".repeat(600)}-MIDDLE-${"b".repeat(600)}-CLOSING`;
  const bounded = boundedTranscriptForReview(input, 500);
  assert.equal(bounded.startsWith("OPENING-"), true);
  assert.equal(bounded.endsWith("-CLOSING"), true);
  assert.equal(bounded.includes("middle omitted for bounded review"), true);
});
