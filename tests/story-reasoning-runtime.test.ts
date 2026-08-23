import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const schemas = fs.readFileSync(path.join(root, "lib", "intelligence", "schemas.ts"), "utf8");

function section(start: string, end: string) {
  const startAt = runtime.indexOf(start);
  const endAt = runtime.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `Missing runtime section: ${start}`);
  assert.notEqual(endAt, -1, `Missing runtime section boundary: ${end}`);
  return runtime.slice(startAt, endAt);
}

const reasoningBuilder = section("function buildStoryReasoningSnapshot", "type CanonicalStoryPersistenceResult");
const persistence = section("type CanonicalStoryPersistenceResult", "async function promoteCandidate");
const promotion = section("async function promoteCandidate", "function lifecycleThemeState");

test("runtime builds reasoning from persisted stage-owned records", () => {
  assert.match(reasoningBuilder, /buildCanonicalStoryReasoningSnapshotV1\(\{/);
  assert.match(reasoningBuilder, /lifecycleStatus,/);
  assert.match(reasoningBuilder, /causalChain: persistedCausalChain\(context\.hypothesis\)/);
  assert.match(reasoningBuilder, /confirmationCriteria: context\.hypothesis\.confirmation_criteria/);
  assert.match(reasoningBuilder, /invalidationCriteria: context\.hypothesis\.invalidation_criteria/);
  assert.match(reasoningBuilder, /acceptedExplanationEvidenceIds: synthesis\.acceptedExplanationEvidenceIds/);
  assert.match(reasoningBuilder, /overlookedVariableEvidenceIds: synthesis\.overlookedVariableEvidenceIds/);
  assert.match(reasoningBuilder, /strongestCountercase: context\.challenger\.strongestCountercase/);
  assert.match(reasoningBuilder, /conflictingEvidenceIds: context\.challenger\.conflictingEvidenceIds/);
  assert.match(reasoningBuilder, /context\.scenarios[\s\S]*scenario\.hypothesis_id === context\.hypothesis\.id/);
  assert.match(reasoningBuilder, /baseCase: scenario\.base_case\.summary/);
  assert.match(reasoningBuilder, /claim: item\.claim/);
  assert.doesNotMatch(reasoningBuilder, /(?:causalMechanism|nextCatalysts|bullCase|bearCase|tailCase):/);
});

test("Story Synthesis provenance is required and rejected unless canonical", () => {
  assert.match(schemas, /required: \[[^\]]*"acceptedExplanationEvidenceIds"[^\]]*"overlookedVariableEvidenceIds"/);
  assert.match(schemas, /acceptedExplanationEvidenceIds: stringArray/);
  assert.match(schemas, /overlookedVariableEvidenceIds: stringArray/);
  assert.match(runtime, /acceptedExplanationEvidenceIds = requireKnownEvidenceIds\([\s\S]*candidate\.acceptedExplanationEvidenceIds/);
  assert.match(runtime, /overlookedVariableEvidenceIds = requireKnownEvidenceIds\([\s\S]*candidate\.overlookedVariableEvidenceIds/);
  assert.match(runtime, /decisiveEvidenceIds = requireKnownEvidenceIds\([\s\S]*candidate\.decisiveEvidenceIds/);
  assert.match(runtime, /Hypothesis \$\{hypothesis\.divergenceId\} causal edge \$\{ordinal\}/);
  assert.match(runtime, /Challenger assessment \$\{assessment\.hypothesisId\} conflicting evidence/);
  assert.match(runtime, /Scenario \$\{scenario\.hypothesisId\}\/\$\{scenario\.asset\} explanatory evidence/);
  assert.match(runtime, /references unknown canonical evidence ID\(s\)/);
});

test("reasoning is validated before the one atomic Story persistence call", () => {
  assert.match(promotion, /const reasoning = buildStoryReasoningSnapshot\(candidate, reasoningContext, lifecycleStatus\)/);
  assert.ok(
    promotion.indexOf("const reasoning = buildStoryReasoningSnapshot") < promotion.indexOf("persistCanonicalStoryReasoning({"),
    "Canonical reasoning must be validated before the first Story mutation.",
  );
  assert.match(persistence, /"rpc\/persist_canonical_story_reasoning"/);
  assert.match(persistence, /p_mutation_key: mutationKey/);
  assert.match(persistence, /p_story_id: storyId/);
  assert.match(persistence, /p_reasoning: reasoning/);
  assert.match(persistence, /if \(!result\?\.story\?\.id \|\| !result\.version_id \|\| !result\.event_id/);
  assert.match(persistence, /story: StoryRow & \{ current_thesis_version_id: string \| null \}/);
  assert.match(
    persistence,
    /result\.story\.current_thesis_version_id !== result\.version_id[\s\S]*returned a stale Story thesis version pointer/,
  );
});

test("new and existing Stories use the same mutation-keyed transactional boundary", () => {
  const calls = promotion.match(/persistCanonicalStoryReasoning\(\{/g) ?? [];
  assert.equal(calls.length, 2);
  assert.match(promotion, /mutationKey: candidateRowId,[\s\S]*storyId: matched\.id/);
  assert.match(promotion, /mutationKey: candidateRowId,[\s\S]*storyId: null/);
  assert.match(promotion, /best_explanation: hypothesis\.causal_mechanism/);
  assert.match(promotion, /next_catalyst: hypothesis\.next_catalysts\.join/);
  assert.match(promotion, /isNew = persisted\.created/);
});

test("runtime has no direct Story, event, version, pointer, or mirrored-update writer", () => {
  assert.doesNotMatch(promotion, /intelligenceRest<StoryRow\[]>\(`stories/);
  assert.doesNotMatch(promotion, /intelligenceRest<StoryRow\[]>\("stories"/);
  assert.doesNotMatch(promotion, /intelligenceRest\("story_updates"/);
  assert.doesNotMatch(runtime, /intelligenceRest<Array<\{ id: string \}>>\("story_thesis_versions"/);
  assert.doesNotMatch(runtime, /intelligenceRest<Array<\{ id: string \}>>\("story_events"/);
  assert.doesNotMatch(runtime, /current_thesis_version_id: versionId/);
  assert.doesNotMatch(runtime, /createInitialVersion|createRevisionVersion/);
});
