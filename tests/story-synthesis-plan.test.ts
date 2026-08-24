import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalNextTestFromSelectionV1,
  buildValidatedStorySynthesisPlanV1,
  validateVisualPlanV1,
  type VisualPlanAllowListV1,
} from "../lib/intelligence/story-synthesis-plan.ts";
import type {
  CanonicalEntityRefV1,
  CanonicalSeriesRefV1,
  VisualPlanV1,
} from "../lib/intelligence/story-reasoning.ts";

const evidenceIds = new Set(["e1", "e2", "e3"]);
const edgeIds = new Set(["edge:1", "edge:2", "edge:3"]);
const claimIds = new Set(["claim:root", "claim:a", "claim:b"]);

const canonicalSeries: CanonicalSeriesRefV1 = {
  seriesId: "series:dxy",
  label: "DXY",
  geography: "US",
  transform: "level",
  role: "asset",
};

const canonicalEntity: CanonicalEntityRefV1 = {
  entityId: "entity:us",
  label: "United States",
  geography: { kind: "country", countryCode: "US" },
  evidenceIds: ["e1"],
};

function allowList(overrides: Partial<VisualPlanAllowListV1> = {}): VisualPlanAllowListV1 {
  return {
    edgeIds,
    claimIds,
    evidenceIds,
    seriesById: new Map([[canonicalSeries.seriesId, canonicalSeries]]),
    entityById: new Map([[canonicalEntity.entityId, canonicalEntity]]),
    expectedRelationships: new Set(["inverse"]),
    confirmationCount: 2,
    invalidationCount: 2,
    hasNextTest: true,
    ...overrides,
  };
}

test("full Story Synthesis next test can only select an exact frozen catalyst candidate", () => {
  const candidates = [
    {
      label: "US CPI release",
      catalystRef: "calendar:us-cpi",
      dueAt: "2026-08-25T12:30:00Z",
      evidenceIds: ["e1"],
    },
  ];
  const accepted = buildCanonicalNextTestFromSelectionV1({
    ownerKey: "candidate-1",
    selection: { label: "US CPI release", catalystRef: "calendar:us-cpi" },
    candidates,
    knownEvidenceIds: evidenceIds,
    now: "2026-08-24T00:00:00Z",
  });
  assert.ok(accepted);
  assert.equal(accepted.label, "US CPI release");
  assert.equal(accepted.catalystRef, "calendar:us-cpi");
  assert.equal(accepted.status, "upcoming");
  assert.deepEqual(accepted.evidenceIds, ["e1"]);

  const invented = buildCanonicalNextTestFromSelectionV1({
    ownerKey: "candidate-1",
    selection: { label: "Invented FOMC test", catalystRef: "calendar:fomc" },
    candidates,
    knownEvidenceIds: evidenceIds,
    now: "2026-08-24T00:00:00Z",
  });
  assert.equal(invented, null);
});

test("next-test status is deterministic from frozen timestamps and resolution evidence", () => {
  const due = buildCanonicalNextTestFromSelectionV1({
    ownerKey: "candidate-due",
    selection: { label: "Due test", catalystRef: null },
    candidates: [{ label: "Due test", catalystRef: null, dueAt: "2026-08-23T00:00:00Z" }],
    knownEvidenceIds: evidenceIds,
    now: "2026-08-24T00:00:00Z",
  });
  assert.equal(due?.status, "due");

  const expired = buildCanonicalNextTestFromSelectionV1({
    ownerKey: "candidate-expired",
    selection: { label: "Expired test", catalystRef: null },
    candidates: [{ label: "Expired test", catalystRef: null, expiresAt: "2026-08-23T00:00:00Z" }],
    knownEvidenceIds: evidenceIds,
    now: "2026-08-24T00:00:00Z",
  });
  assert.equal(expired?.status, "expired");

  const resolved = buildCanonicalNextTestFromSelectionV1({
    ownerKey: "candidate-resolved",
    selection: { label: "Resolved test", catalystRef: null },
    candidates: [{
      label: "Resolved test",
      catalystRef: null,
      expiresAt: "2026-08-23T00:00:00Z",
      resolutionEvidenceIds: ["e2"],
    }],
    knownEvidenceIds: evidenceIds,
    now: "2026-08-24T00:00:00Z",
  });
  assert.equal(resolved?.status, "resolved");
  assert.deepEqual(resolved?.resolutionEvidenceIds, ["e2"]);
});

test("valid canonical edge visuals survive in order and model-supplied visual IDs are replaced deterministically", () => {
  const input: VisualPlanV1[] = [
    { id: "model-a", title: "Transmission", type: "linear_chain", edgeIds: ["edge:2", "edge:1"] },
    { id: "model-b", title: "Loop", type: "feedback_loop", edgeIds: ["edge:1", "edge:2"], loopClosureEdgeId: "edge:3" },
  ];
  const result = validateVisualPlanV1(input, allowList());
  assert.equal(result.length, 2);
  assert.equal(result[0].type, "linear_chain");
  if (result[0].type === "linear_chain") assert.deepEqual(result[0].edgeIds, ["edge:2", "edge:1"]);
  assert.equal(result[1].type, "feedback_loop");
  assert.notEqual(result[0].id, "model-a");
  assert.match(result[0].id, /^visual:0:/);
  assert.match(result[1].id, /^visual:1:/);
});

test("unknown edge, claim, series and entity references reject the whole affected visual", () => {
  const input: VisualPlanV1[] = [
    { id: "bad-edge", title: "Bad edge", type: "linear_chain", edgeIds: ["edge:1", "edge:unknown"] },
    {
      id: "bad-claim",
      title: "Bad claim",
      type: "before_after",
      beforeClaimIds: ["claim:unknown"],
      afterClaimIds: ["claim:a"],
      changeEvidenceIds: ["e1"],
      series: [],
    },
    {
      id: "bad-series",
      title: "Bad series",
      type: "divergence_chart",
      series: [{ ...canonicalSeries, seriesId: "series:invented" }],
      expectedRelationship: "inverse",
      evidenceIds: ["e1"],
      window: { start: null, end: null, observations: null },
    },
    {
      id: "bad-entity",
      title: "Bad entity",
      type: "entity_map",
      entities: [{ ...canonicalEntity, entityId: "entity:invented" }],
      connectionEdgeIds: ["edge:1"],
    },
  ];
  assert.deepEqual(validateVisualPlanV1(input, allowList()), []);
});

test("series and entities are copied from canonical allow-lists rather than model metadata", () => {
  const input: VisualPlanV1[] = [
    {
      id: "chart",
      title: "Dollar divergence",
      type: "divergence_chart",
      series: [{
        seriesId: "series:dxy",
        label: "MODEL ALTERED LABEL",
        geography: null,
        transform: "return",
        role: "driver",
      }],
      expectedRelationship: "positive",
      evidenceIds: ["e1"],
      window: { start: null, end: null, observations: 20 },
    },
    {
      id: "map",
      title: "Canonical entity",
      type: "entity_map",
      entities: [{
        entityId: "entity:us",
        label: "MODEL ALTERED ENTITY",
        geography: { kind: "country", countryCode: "XX" },
        evidenceIds: ["e3"],
      }],
      connectionEdgeIds: [],
    },
  ];
  const result = validateVisualPlanV1(input, allowList());
  assert.equal(result.length, 2);
  assert.equal(result[0].type, "divergence_chart");
  if (result[0].type === "divergence_chart") {
    assert.deepEqual(result[0].series, [canonicalSeries]);
    assert.equal(result[0].expectedRelationship, "none_asserted");
  }
  assert.equal(result[1].type, "entity_map");
  if (result[1].type === "entity_map") assert.deepEqual(result[1].entities, [canonicalEntity]);
});

test("divergence relationship is retained only when explicitly canonical", () => {
  const input: VisualPlanV1[] = [{
    id: "chart",
    title: "Canonical inverse relationship",
    type: "divergence_chart",
    series: [canonicalSeries],
    expectedRelationship: "inverse",
    evidenceIds: ["e1"],
    window: { start: null, end: null, observations: null },
  }];
  const retained = validateVisualPlanV1(input, allowList());
  assert.equal(retained[0].type, "divergence_chart");
  if (retained[0].type === "divergence_chart") assert.equal(retained[0].expectedRelationship, "inverse");

  const noneAsserted = validateVisualPlanV1(input, allowList({ expectedRelationships: new Set() }));
  assert.equal(noneAsserted[0].type, "divergence_chart");
  if (noneAsserted[0].type === "divergence_chart") assert.equal(noneAsserted[0].expectedRelationship, "none_asserted");
});

test("decision-tree branches fail closed on unknown claims or unavailable next tests", () => {
  const valid: VisualPlanV1 = {
    id: "tree",
    title: "Decision tree",
    type: "decision_tree",
    rootClaimId: "claim:root",
    branches: [
      { conditionRef: { kind: "confirmation", index: 0 }, outcomeClaimIds: ["claim:a"] },
      { conditionRef: { kind: "next_test" }, outcomeClaimIds: ["claim:b"] },
    ],
  };
  assert.equal(validateVisualPlanV1([valid], allowList()).length, 1);
  assert.deepEqual(validateVisualPlanV1([valid], allowList({ hasNextTest: false })), []);

  const unknown: VisualPlanV1 = {
    ...valid,
    rootClaimId: "claim:unknown",
  };
  assert.deepEqual(validateVisualPlanV1([unknown], allowList()), []);
});

test("empty visual plan stays exactly empty and an invalid next test disables next-test decision branches", () => {
  const result = buildValidatedStorySynthesisPlanV1({
    ownerKey: "candidate-empty",
    selection: {
      nextTest: { label: "Invented", catalystRef: null },
      visualPlan: [],
    },
    catalystCandidates: [{ label: "Real catalyst", catalystRef: null }],
    knownEvidenceIds: evidenceIds,
    visualAllowList: {
      edgeIds,
      claimIds,
      evidenceIds,
      seriesById: new Map([[canonicalSeries.seriesId, canonicalSeries]]),
      entityById: new Map([[canonicalEntity.entityId, canonicalEntity]]),
      expectedRelationships: new Set(["inverse"]),
      confirmationCount: 2,
      invalidationCount: 2,
    },
    now: "2026-08-24T00:00:00Z",
  });
  assert.equal(result.nextTest, null);
  assert.deepEqual(result.visualPlan, []);
});
