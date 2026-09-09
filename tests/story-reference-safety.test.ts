import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { completedStageCheckpoints, runCheckpointedStage } from "../lib/intelligence/resumable-checkpoints.ts";
import type { ExistingStoryPackItem } from "../lib/intelligence/schemas.ts";
import {
  buildFrozenStoryReferenceSet,
  resolveDeduplicationStoryReferences,
} from "../lib/intelligence/story-references.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function story(id: string, title: string): ExistingStoryPackItem {
  return {
    id,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    thesis: `${title} thesis`,
    status: "developing",
    confidence: 70,
    marketQuestion: null,
    dominantNarrative: null,
    strongestSupport: null,
    strongestContradiction: null,
    confirmationTrigger: null,
    invalidationTrigger: null,
    nextCatalyst: null,
    assets: ["SPX"],
  };
}

const FROZEN_STORIES = [
  story(UUID_A, "Story A"),
  story(UUID_B, "Story B"),
  story(UUID_C, "Story C"),
];

function decision(
  reference: string | null,
  noveltyClass: "existing_story_update" | "duplicate" | "new_story" = "existing_story_update",
) {
  return {
    candidateKey: "candidate-1",
    noveltyClass,
    matchedStoryRef: reference,
    similarityScore: 91,
    rationale: "The evidence updates the same causal thesis.",
    exceptionProof: {
      distinctEvent: false,
      distinctMechanism: false,
      distinctDecisiveEvidence: false,
      distinctCatalyst: false,
    },
  } as const;
}

test("safe Story references hide UUIDs from the model and resolve to the intended canonical Story", () => {
  const references = buildFrozenStoryReferenceSet(FROZEN_STORIES);

  assert.deepEqual(references.modelStories.map((item) => item.storyRef), ["STORY_0001", "STORY_0002", "STORY_0003"]);
  assert.equal(Object.hasOwn(references.modelStories[1]!, "id"), false);

  const output = resolveDeduplicationStoryReferences(
    { decisions: [decision("STORY_0002")] },
    references,
  );
  assert.equal(output.decisions[0]?.noveltyClass, "existing_story_update");
  assert.equal(output.decisions[0]?.matchedStoryId, UUID_B);
});

test("unknown, malformed and non-frozen references fail closed without fuzzy fallback", () => {
  const references = buildFrozenStoryReferenceSet([
    story(UUID_A, "Oil supply disruption"),
    story(UUID_B, "Oil physical disruption"),
  ]);

  for (const invalidRef of ["STORY_9999", "story_0001", UUID_C, null]) {
    const output = resolveDeduplicationStoryReferences(
      { decisions: [decision(invalidRef)] },
      references,
    );
    assert.equal(output.decisions[0]?.noveltyClass, "insufficient_novelty");
    assert.equal(output.decisions[0]?.matchedStoryId, null);
    assert.match(output.decisions[0]?.rationale ?? "", /absent from the frozen input/);
  }
});

test("a resumed run keeps its frozen mapping when current database ordering changes", () => {
  const frozenReferences = buildFrozenStoryReferenceSet(FROZEN_STORIES);
  const originalRefForStoryB = frozenReferences.modelStories[1]!.storyRef;

  const currentDatabaseStories = [
    story(UUID_C, "Story C"),
    story("44444444-4444-4444-8444-444444444444", "Story D"),
    story(UUID_A, "Story A"),
  ];
  const newRunReferences = buildFrozenStoryReferenceSet(currentDatabaseStories);

  const resumed = resolveDeduplicationStoryReferences(
    { decisions: [decision(originalRefForStoryB)] },
    frozenReferences,
  );
  assert.equal(resumed.decisions[0]?.matchedStoryId, UUID_B);
  assert.equal(newRunReferences.storyIdByRef.get(originalRefForStoryB), "44444444-4444-4444-8444-444444444444");
  assert.equal(frozenReferences.storyIdByRef.get(originalRefForStoryB), UUID_B);
});

test("new runs may assign different references while the existing frozen run remains immutable", () => {
  const firstRun = buildFrozenStoryReferenceSet(FROZEN_STORIES);
  const secondRun = buildFrozenStoryReferenceSet([FROZEN_STORIES[1]!, FROZEN_STORIES[0]!, FROZEN_STORIES[2]!]);

  assert.equal(firstRun.storyIdByRef.get("STORY_0001"), UUID_A);
  assert.equal(secondRun.storyIdByRef.get("STORY_0001"), UUID_B);
  assert.equal(firstRun.storyIdByRef.get("STORY_0001"), UUID_A);
});

test("non-matching novelty classes never retain a Story identity", () => {
  const references = buildFrozenStoryReferenceSet(FROZEN_STORIES);
  const output = resolveDeduplicationStoryReferences(
    { decisions: [decision("STORY_0002", "new_story")] },
    references,
  );

  assert.equal(output.decisions[0]?.noveltyClass, "new_story");
  assert.equal(output.decisions[0]?.matchedStoryId, null);
});

test("legacy UUID checkpoints recover only when reused and present in the frozen Story set", async () => {
  const { matchedStoryRef: _matchedStoryRef, ...legacyBase } = decision(null);
  const legacyDecision = {
    ...legacyBase,
    matchedStoryId: UUID_B,
  };
  const legacyPayload = { decisions: [legacyDecision] };
  const checkpoints = completedStageCheckpoints([{
    id: "dedupe-legacy",
    stage_key: "semantic_deduplication",
    status: "completed",
    output_payload: legacyPayload,
  }]);
  const checkpoint = await runCheckpointedStage({
    stageKey: "semantic_deduplication",
    checkpoints,
    claim: async () => { throw new Error("A completed checkpoint must not be claimed again."); },
    invoke: async () => { throw new Error("A completed checkpoint must not invoke the model again."); },
    valid: (value): value is typeof legacyPayload => Boolean(
      value
      && typeof value === "object"
      && Array.isArray((value as typeof legacyPayload).decisions),
    ),
  });
  assert.equal(checkpoint.source, "reused");

  const references = buildFrozenStoryReferenceSet(FROZEN_STORIES);
  const recovered = resolveDeduplicationStoryReferences(checkpoint.data!, references, { allowLegacyStoryIds: true });
  assert.equal(recovered.decisions[0]?.matchedStoryId, UUID_B);

  const freshContract = resolveDeduplicationStoryReferences(checkpoint.data!, references, { allowLegacyStoryIds: false });
  assert.equal(freshContract.decisions[0]?.noveltyClass, "insufficient_novelty");

  const absent = resolveDeduplicationStoryReferences(
    checkpoint.data!,
    buildFrozenStoryReferenceSet([FROZEN_STORIES[0]!]),
    { allowLegacyStoryIds: true },
  );
  assert.equal(absent.decisions[0]?.noveltyClass, "insufficient_novelty");
});

test("new reference fields take precedence over legacy IDs and fail closed", () => {
  const references = buildFrozenStoryReferenceSet(FROZEN_STORIES);
  const output = resolveDeduplicationStoryReferences({
    decisions: [{ ...decision("STORY_9999"), matchedStoryId: UUID_B }],
  }, references, { allowLegacyStoryIds: true });

  assert.equal(output.decisions[0]?.noveltyClass, "insufficient_novelty");
  assert.equal(output.decisions[0]?.matchedStoryId, null);
});

test("manual and scheduled triggers share the single runtime reference contract", () => {
  const references = buildFrozenStoryReferenceSet(FROZEN_STORIES);
  const byTrigger = (["manual", "scheduled"] as const).map((triggerKind) => ({
    triggerKind,
    resolved: resolveDeduplicationStoryReferences({ decisions: [decision("STORY_0002")] }, references),
  }));
  assert.deepEqual(byTrigger[0]?.resolved, byTrigger[1]?.resolved);

  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  assert.equal(runtime.match(/resolveDeduplicationStoryReferences\(/g)?.length, 1);
  assert.match(runtime, /existingStories: frozenStoryReferences\.modelStories/);
  assert.match(runtime, /allowLegacyStoryIds: dedupeStage\.reused/);
});
