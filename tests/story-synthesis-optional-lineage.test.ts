import assert from "node:assert/strict";
import test from "node:test";

import { buildCanonicalStoryReasoningSnapshotV1 } from "../lib/intelligence/story-reasoning.ts";

const evidenceById = new Map([["ev:known", { id: "ev:known", claim: "Known canonical fact" }]]);

function baseInput() {
  return {
    synthesis: {
      lifecycleStatus: "developing" as const,
      thesis: "Test thesis",
      whatChanged: "Something changed",
      previousState: null,
      currentState: "Current state",
      marketReaction: "Observed move",
      acceptedExplanation: "Accepted explanation",
      acceptedExplanationEvidenceIds: ["ev:known", "ev:hallucinated"],
      overlookedVariable: "Optional overlooked variable",
      overlookedVariableEvidenceStatus: "observed" as const,
      overlookedVariableEvidenceIds: ["ev:hallucinated-a", "ev:hallucinated-b"],
      marketMayBeRight: null,
      decisiveEvidenceIds: ["ev:known"],
    },
    hypothesis: {
      id: "hyp:1",
      evidenceForIds: ["ev:known"],
      causalChain: [{ from: "A", relationship: "drives", to: "B", evidenceState: "observed" as const, evidenceIds: ["ev:known"] }],
      confirmationCriteria: ["Confirm"],
      invalidationCriteria: ["Invalidate"],
    },
    challenger: { strongestCountercase: null, conflictingEvidenceIds: [], weakestLink: null },
    scenarios: [],
    evidenceById,
  };
}

test("optional synthesis evidence hallucinations are isolated without entering canonical lineage", () => {
  const snapshot = buildCanonicalStoryReasoningSnapshotV1(baseInput());
  const interpretation = snapshot.claims.find((claim) => claim.type === "interpretation");
  assert.deepEqual(interpretation?.evidenceIds, ["ev:known"]);
  assert.deepEqual(snapshot.overlookedVariable.evidenceIds, []);
  assert.equal(snapshot.overlookedVariable.evidenceState, "speculative");
});

test("decisive evidence remains fail-closed", () => {
  const input = baseInput();
  input.synthesis.decisiveEvidenceIds = ["ev:hallucinated"];
  assert.throws(() => buildCanonicalStoryReasoningSnapshotV1(input), /Decisive evidence references unknown canonical evidence ID/);
});
