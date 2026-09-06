import assert from "node:assert/strict";
import test from "node:test";

import {
  CandidateEvidenceContractError,
  normalizeStorySynthesisCandidate,
} from "../lib/intelligence/candidate-evidence-contract.ts";

const known = new Set(["evidence-a", "evidence-b"]);

test("exact evidence transport markers are normalised without widening identity", () => {
  const result = normalizeStorySynthesisCandidate({
    candidateKey: "candidate-a",
    primaryHypothesisId: "hypothesis-a",
    title: "Candidate A",
    decisiveEvidenceIds: ["[[evidence:evidence-a]]", "evidence-b"],
  }, known);

  assert.deepEqual(result.candidate.decisiveEvidenceIds, ["evidence-a", "evidence-b"]);
  assert.equal(result.diagnostics[0]?.code, "repaired_contract_format");
});

test("unknown or absent decisive evidence remains fail-closed for only that candidate", () => {
  assert.throws(
    () => normalizeStorySynthesisCandidate({
      candidateKey: "candidate-b",
      primaryHypothesisId: "hypothesis-b",
      title: "Candidate B",
      decisiveEvidenceIds: ["unknown-evidence"],
    }, known),
    (error: unknown) => error instanceof CandidateEvidenceContractError && error.code === "rejected_unknown_evidence",
  );
  assert.throws(
    () => normalizeStorySynthesisCandidate({
      candidateKey: "candidate-c",
      primaryHypothesisId: "hypothesis-c",
      title: "Candidate C",
      decisiveEvidenceIds: [],
    }, known),
    (error: unknown) => error instanceof CandidateEvidenceContractError && error.code === "rejected_missing_required_evidence",
  );
});

test("a valid neighboring candidate remains promotable after a malformed candidate is omitted", () => {
  const candidates = [
    { candidateKey: "bad", primaryHypothesisId: "h-bad", decisiveEvidenceIds: ["unknown-evidence"] },
    { candidateKey: "good", primaryHypothesisId: "h-good", decisiveEvidenceIds: ["evidence-a"] },
  ];
  const accepted = candidates.flatMap((candidate) => {
    try {
      return [normalizeStorySynthesisCandidate(candidate, known).candidate];
    } catch {
      return [];
    }
  });

  assert.deepEqual(accepted.map((candidate) => candidate.candidateKey), ["good"]);
});
