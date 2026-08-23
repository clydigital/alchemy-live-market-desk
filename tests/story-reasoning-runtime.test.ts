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

const reasoningBuilder = section("function buildStoryReasoningSnapshot", "async function createInitialVersion");
const initialVersion = section("async function createInitialVersion", "async function createRevisionVersion");
const revisionVersion = section("async function createRevisionVersion", "async function promoteCandidate");
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

test("initial Story creation preserves metadata and persists reasoning", () => {
  assert.match(promotion, /const reasoning = buildStoryReasoningSnapshot\(candidate, reasoningContext, lifecycleStatus\)/);
  assert.ok(
    promotion.indexOf("const reasoning = buildStoryReasoningSnapshot") < promotion.indexOf("intelligenceRest<StoryRow[]>(`stories"),
    "Canonical reasoning must be validated before the first Story mutation.",
  );
  assert.match(initialVersion, /snapshot: \{ origin: "alchemy_research_engine", reasoning \}/);
  assert.match(initialVersion, /best_explanation: reasoningContext\.hypothesis\.causal_mechanism/);
  assert.match(initialVersion, /next_catalyst: reasoningContext\.hypothesis\.next_catalysts\.join/);
  assert.match(initialVersion, /const versionId = versions\[0\]\?\.id/);
  assert.match(initialVersion, /if \(!versionId\) throw new Error/);
  assert.match(initialVersion, /current_thesis_version_id: versionId/);
});

test("full-reasoning Story revision preserves metadata and persists reasoning", () => {
  assert.match(revisionVersion, /snapshot: \{ origin: "alchemy_research_engine", priorVersion: versionNumber - 1, reasoning \}/);
  assert.match(revisionVersion, /best_explanation: reasoningContext\.hypothesis\.causal_mechanism/);
  assert.match(revisionVersion, /next_catalyst: reasoningContext\.hypothesis\.next_catalysts\.join/);
  assert.match(revisionVersion, /if \(!versionId\) throw new Error/);
  assert.match(revisionVersion, /current_thesis_version_id: versionId/);
});

test("runtime retains the two existing direct thesis-version inserts", () => {
  const writes = runtime.match(/intelligenceRest<Array<\{ id: string \}>>\("story_thesis_versions", \{/g) ?? [];
  assert.equal(writes.length, 2);
  assert.match(runtime, /await createRevisionVersion\(story, candidate, reasoningContext, reasoning\)/);
  assert.match(runtime, /await createInitialVersion\(story, candidate, reasoningContext, reasoning\)/);
});
