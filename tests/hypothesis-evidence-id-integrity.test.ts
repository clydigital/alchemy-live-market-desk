import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { sanitizeHypothesisOutputEvidenceIds } from "../lib/intelligence/hypothesis-core.ts";
import type { HypothesisOutput } from "../lib/intelligence/schemas.ts";

const REAL_EVIDENCE_ID = "8b2c46ed-969f-4158-8246-285101f7d243";
const TYPO_EVIDENCE_ID = "8b2c46ed-969f-4159-8246-285101f7d243";

function hypothesisOutput(edge: HypothesisOutput["hypotheses"][number]["causalChain"][number]): HypothesisOutput {
  return {
    hypotheses: [{
      divergenceId: "divergence-1",
      question: "Why are long yields moving?",
      statement: "Term-premium pressure is driving the long end.",
      causalMechanism: "Treasury duration supply raises term premium.",
      affectedAssets: ["US10Y"],
      evidenceForIds: [REAL_EVIDENCE_ID],
      evidenceAgainstIds: [],
      causalChain: [edge],
      confirmationCriteria: ["Long-end yields remain elevated"],
      invalidationCriteria: ["Term premium falls materially"],
      nextCatalysts: ["Treasury auction"],
      confidence: 70,
    }],
  };
}

test("Hypothesis evidence integrity: one-character UUID mutation is removed without fuzzy correction", () => {
  const result = sanitizeHypothesisOutputEvidenceIds(
    hypothesisOutput({
      from: "Treasury duration supply",
      relationship: "raises",
      to: "term premium",
      evidenceState: "inferred",
      evidenceIds: [TYPO_EVIDENCE_ID],
    }),
    new Set([REAL_EVIDENCE_ID]),
  );

  assert.equal(result.removedReferenceCount, 1);
  assert.equal(result.droppedHypothesisCount, 0);
  assert.equal(result.output.hypotheses.length, 1);
  assert.deepEqual(result.output.hypotheses[0].causalChain[0].evidenceIds, []);
  assert.ok(!result.output.hypotheses[0].causalChain[0].evidenceIds.includes(REAL_EVIDENCE_ID));
});

test("Hypothesis evidence integrity: unsupported strong causal edge drops only the poisoned hypothesis", () => {
  const result = sanitizeHypothesisOutputEvidenceIds(
    hypothesisOutput({
      from: "Fed holdings",
      relationship: "compress",
      to: "free float",
      evidenceState: "strongly_supported",
      evidenceIds: [TYPO_EVIDENCE_ID],
    }),
    new Set([REAL_EVIDENCE_ID]),
  );

  assert.equal(result.removedReferenceCount, 1);
  assert.equal(result.droppedHypothesisCount, 1);
  assert.deepEqual(result.output.hypotheses, []);
});

test("Hypothesis evidence integrity: a valid canonical ID survives beside an invalid mutation", () => {
  const result = sanitizeHypothesisOutputEvidenceIds(
    hypothesisOutput({
      from: "Fed holdings",
      relationship: "compress",
      to: "free float",
      evidenceState: "strongly_supported",
      evidenceIds: [TYPO_EVIDENCE_ID, REAL_EVIDENCE_ID, REAL_EVIDENCE_ID],
    }),
    new Set([REAL_EVIDENCE_ID]),
  );

  assert.equal(result.removedReferenceCount, 1);
  assert.equal(result.droppedHypothesisCount, 0);
  assert.deepEqual(result.output.hypotheses[0].causalChain[0].evidenceIds, [REAL_EVIDENCE_ID]);
});

test("Production provider boundary sanitizes Hypothesis output before returning it to modelStage", () => {
  const source = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");
  assert.match(source, /sanitizeHypothesisOutputEvidenceIds\(output, allowedEvidenceIds\)/);
  assert.match(source, /data:\s*canonicalStageOutput\(stageKey, modelInput, result\.data\)/);
  assert.match(source, /hypothesis_evidence_reference_sanitized/);
});
