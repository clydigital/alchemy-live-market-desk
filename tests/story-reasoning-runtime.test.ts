import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");

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

test("runtime builds reasoning from persisted stage-owned records", () => {
  assert.match(reasoningBuilder, /buildCanonicalStoryReasoningSnapshotV1\(\{/);
  assert.match(reasoningBuilder, /causalMechanism: context\.hypothesis\.causal_mechanism/);
  assert.match(reasoningBuilder, /causalChain: persistedCausalChain\(context\.hypothesis\)/);
  assert.match(reasoningBuilder, /confirmationCriteria: context\.hypothesis\.confirmation_criteria/);
  assert.match(reasoningBuilder, /invalidationCriteria: context\.hypothesis\.invalidation_criteria/);
  assert.match(reasoningBuilder, /nextCatalysts: context\.hypothesis\.next_catalysts/);
  assert.match(reasoningBuilder, /strongestCountercase: context\.challenger\.strongestCountercase/);
  assert.match(reasoningBuilder, /conflictingEvidenceIds: context\.challenger\.conflictingEvidenceIds/);
  assert.match(reasoningBuilder, /context\.scenarios[\s\S]*scenario\.hypothesis_id === context\.hypothesis\.id/);
  assert.match(reasoningBuilder, /claim: item\.claim/);
  assert.doesNotMatch(reasoningBuilder, /synthesis\.causalMechanism/);
});

test("initial Story creation preserves metadata and persists reasoning", () => {
  assert.match(initialVersion, /const reasoning = buildStoryReasoningSnapshot\(synthesis, reasoningContext\)/);
  assert.match(initialVersion, /snapshot: \{ origin: "alchemy_research_engine", reasoning \}/);
  assert.match(initialVersion, /const versionId = versions\[0\]\?\.id/);
  assert.match(initialVersion, /current_thesis_version_id: versionId/);
});

test("full-reasoning Story revision preserves metadata and persists reasoning", () => {
  assert.match(revisionVersion, /const reasoning = buildStoryReasoningSnapshot\(synthesis, reasoningContext\)/);
  assert.match(revisionVersion, /snapshot: \{ origin: "alchemy_research_engine", priorVersion: versionNumber - 1, reasoning \}/);
  assert.match(revisionVersion, /current_thesis_version_id: versions\[0\]\.id/);
});

test("runtime retains exactly the two existing thesis-version write paths", () => {
  const writes = runtime.match(/intelligenceRest<Array<\{ id: string \}>>\("story_thesis_versions", \{/g) ?? [];
  assert.equal(writes.length, 2);
  assert.match(runtime, /await createRevisionVersion\(story, candidate, reasoningContext\)/);
  assert.match(runtime, /await createInitialVersion\(story, candidate, reasoningContext\)/);
});
