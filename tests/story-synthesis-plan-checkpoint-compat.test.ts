import assert from "node:assert/strict";
import test from "node:test";

import { buildValidatedStorySynthesisPlanV1, type StorySynthesisPlanSelectionV1 } from "../lib/intelligence/story-synthesis-plan.ts";

test("pre-PR3B Story Synthesis checkpoints degrade to no next test and no visual plan", () => {
  const legacySelection = {} as StorySynthesisPlanSelectionV1;
  const result = buildValidatedStorySynthesisPlanV1({
    ownerKey: "legacy-checkpoint",
    selection: legacySelection,
    catalystCandidates: [{ label: "PCE", catalystRef: null }],
    knownEvidenceIds: new Set(),
    visualAllowList: {
      edgeIds: new Set(),
      claimIds: new Set(),
      evidenceIds: new Set(),
      seriesById: new Map(),
      entityById: new Map(),
      expectedRelationships: new Set(),
      confirmationCount: 0,
      invalidationCount: 0,
    },
    now: "2026-08-24T00:00:00Z",
  });

  assert.equal(result.nextTest, null);
  assert.deepEqual(result.visualPlan, []);
});
