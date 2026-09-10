import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDivergenceStageAdmissionShadow,
  observeDivergenceStageAdmissionShadow,
} from "../lib/intelligence/stage-admission-shadow.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

function evidence(id: string, overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id,
    claim: `Claim ${id}`,
    summary: null,
    evidenceClass: "news",
    sourceName: "Test",
    sourceTier: 2,
    reliabilityScore: 80,
    ancestryGroupId: `group-${id}`,
    supportDirection: "supports",
    eventAt: "2026-09-10T00:00:00.000Z",
    publishedAt: "2026-09-10T00:00:00.000Z",
    availableAt: "2026-09-10T00:00:00.000Z",
    receivedAt: "2026-09-10T00:00:00.000Z",
    freshnessStatus: "fresh",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: [`https://example.com/${id}`],
    structuredPayload: {},
    ...overrides,
  };
}

test("admission shadow would skip when no context exists beyond exact belief evidence", () => {
  const decision = buildDivergenceStageAdmissionShadow({
    beliefs: [{ evidence_ids: ["anchor"], affected_assets: ["SPY"] }],
    evidence: [evidence("anchor")],
  });

  assert.equal(decision.decision, "would_skip");
  assert.equal(decision.reason, "no_context_beyond_belief_evidence");
  assert.equal(decision.contextualEvidenceCount, 0);
});

test("admission shadow would run when affected-asset context exists", () => {
  const decision = buildDivergenceStageAdmissionShadow({
    beliefs: [{ evidence_ids: ["anchor"], affected_assets: ["SPY"] }],
    evidence: [
      evidence("anchor"),
      evidence("market", { evidenceClass: "market_observation", affectedAssets: ["SPY"] }),
    ],
  });

  assert.equal(decision.decision, "would_run");
  assert.equal(decision.reason, "material_context_present");
  assert.equal(decision.contextualEvidenceCount, 1);
});

test("admission shadow fails open when belief evidence cannot be resolved", () => {
  const decision = buildDivergenceStageAdmissionShadow({
    beliefs: [{ evidence_ids: ["missing"], affected_assets: ["SPY"] }],
    evidence: [evidence("other")],
  });

  assert.equal(decision.decision, "would_run");
  assert.equal(decision.reason, "unresolved_belief_anchors_fail_open");
});

test("admission shadow marks empty belief input as a skip candidate", () => {
  const decision = buildDivergenceStageAdmissionShadow({
    beliefs: [],
    evidence: [evidence("a")],
  });

  assert.equal(decision.decision, "would_skip");
  assert.equal(decision.reason, "no_beliefs");
});

test("admission result compares shadow decision against actual Divergence output", () => {
  const decision = buildDivergenceStageAdmissionShadow({
    beliefs: [{ evidence_ids: ["anchor"], affected_assets: [] }],
    evidence: [evidence("anchor")],
  });
  const none = observeDivergenceStageAdmissionShadow(decision, { divergences: [] });
  const material = observeDivergenceStageAdmissionShadow(decision, {
    divergences: [{ marketBeliefId: "belief", observedChange: "x", expectedChange: null, magnitude: 70, persistenceScore: 60, decisiveEvidenceIds: ["anchor"] }],
  });

  assert.equal(none.actualMaterialResult, false);
  assert.equal(none.actualOutputCount, 0);
  assert.equal(material.actualMaterialResult, true);
  assert.equal(material.actualOutputCount, 1);
});
