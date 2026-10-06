import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRelatedDistinctStoryRelation } from "../lib/intelligence/story-relations.ts";
import type { DeduplicationOutput } from "../lib/intelligence/schemas.ts";

const PRIOR = "11111111-1111-4111-8111-111111111111";
const NEW = "22222222-2222-4222-8222-222222222222";

function decision(
  noveltyClass: DeduplicationOutput["decisions"][number]["noveltyClass"],
  matchedStoryId: string | null,
): DeduplicationOutput["decisions"][number] {
  return {
    candidateKey: "candidate-1",
    noveltyClass,
    matchedStoryId,
    similarityScore: 64,
    rationale: "The causal question has split from the prior Story while retaining clear lineage.",
    exceptionProof: {
      distinctEvent: false,
      distinctMechanism: true,
      distinctDecisiveEvidence: true,
      distinctCatalyst: true,
    },
  };
}

test("related-distinct Story promotion persists exact canonical lineage", () => {
  assert.deepEqual(buildRelatedDistinctStoryRelation(decision("related_distinct", PRIOR), NEW), {
    story_id: NEW,
    related_story_id: PRIOR,
    relation_type: "related_distinct",
    similarity_score: 64,
    rationale: "The causal question has split from the prior Story while retaining clear lineage.",
    exception_proof: {
      distinctEvent: false,
      distinctMechanism: true,
      distinctDecisiveEvidence: true,
      distinctCatalyst: true,
    },
  });
});

test("non-related Story outcomes do not create split lineage", () => {
  for (const noveltyClass of ["new_story", "existing_story_update", "duplicate", "insufficient_novelty"] as const) {
    assert.equal(buildRelatedDistinctStoryRelation(decision(noveltyClass, PRIOR), NEW), null);
  }
});

test("related-distinct lineage fails closed without an exact prior Story or on self-relation", () => {
  assert.throws(
    () => buildRelatedDistinctStoryRelation(decision("related_distinct", null), NEW),
    /requires an exact matched Story ID/,
  );
  assert.throws(
    () => buildRelatedDistinctStoryRelation(decision("related_distinct", NEW), NEW),
    /cannot point to the promoted Story itself/,
  );
});

test("runtime requires lineage reference and persists the relation after Story promotion", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.match(
    runtime,
    /For noveltyClass "duplicate", "existing_story_update", or "related_distinct", return exactly one storyRef/,
  );
  assert.match(runtime, /buildRelatedDistinctStoryRelation\(decision, promotedStory\.id\)/);
  assert.match(
    runtime,
    /intelligence_story_relations\?on_conflict=story_id,related_story_id,relation_type/,
  );
  assert.match(runtime, /resolution=merge-duplicates,return=minimal/);
});
