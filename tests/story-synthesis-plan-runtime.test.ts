import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "lib", "intelligence", "story-synthesis-contract-v1.ts"), "utf8");

function section(start: string, end: string) {
  const startAt = runtime.indexOf(start);
  const endAt = runtime.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `Missing runtime section: ${start}`);
  assert.notEqual(endAt, -1, `Missing runtime section boundary: ${end}`);
  return runtime.slice(startAt, endAt);
}

const planCandidates = section("function storyPlanCandidatesForHypotheses", "function buildStoryReasoningSnapshot");
const reasoningBuilder = section("function buildStoryReasoningSnapshot", "type CanonicalStoryPersistenceResult");
const promotion = section("async function promoteCandidate", "function lifecycleThemeState");

test("Story Synthesis V1 output contract requires structured next-test and visual plan fields", () => {
  assert.match(contract, /StorySynthesisWithPlanOutputV1/);
  assert.match(contract, /nextTestSelection: StorySynthesisNextTestSelectionV1/);
  assert.match(contract, /visualPlan: VisualPlanV1\[\]/);
  assert.match(contract, /required: \[\.\.\.candidate\.required, "nextTestSelection", "visualPlan"\]/);
  assert.match(contract, /maxItems: 4/);
});

test("runtime supplies only frozen persisted Hypothesis plan candidates", () => {
  assert.match(planCandidates, /canonicalCausalEdgeId\(hypothesis\.id, ordinal, edge\)/);
  assert.match(planCandidates, /hypothesis\.next_catalysts\.filter\(Boolean\)/);
  assert.match(planCandidates, /catalystRef: null/);
  assert.match(planCandidates, /claimIds: \[\]/);
  assert.match(planCandidates, /seriesCandidates: \[\]/);
  assert.match(planCandidates, /entityCandidates: \[\]/);
  assert.match(planCandidates, /expectedRelationships: \[\]/);
  assert.doesNotMatch(planCandidates, /title|slug|theme|affected_assets/);
});

test("Story Synthesis stage receives plan candidates and the extended strict schema", () => {
  assert.match(runtime, /const storyPlanCandidates = storyPlanCandidatesForHypotheses\(reviewed\)/);
  assert.match(runtime, /modelStage<StorySynthesisWithPlanOutputV1>/);
  assert.match(runtime, /schema: STORY_SYNTHESIS_WITH_PLAN_SCHEMA/);
  assert.match(runtime, /existingStories: storiesPack,[\s\S]*storyPlanCandidates,/);
});

test("model plan output is validated against the canonical reasoning assembled from persisted stage owners", () => {
  const baseAt = reasoningBuilder.indexOf("const baseReasoning = buildCanonicalStoryReasoningSnapshotV1(reasoningInput)");
  const validateAt = reasoningBuilder.indexOf("buildValidatedStorySynthesisPlanV1({");
  const finalAt = reasoningBuilder.lastIndexOf("buildCanonicalStoryReasoningSnapshotV1({");
  assert.ok(baseAt >= 0 && validateAt > baseAt && finalAt > validateAt);
  assert.match(reasoningBuilder, /nextTest: synthesis\.nextTestSelection/);
  assert.match(reasoningBuilder, /visualPlan: synthesis\.visualPlan/);
  assert.match(reasoningBuilder, /edgeIds: new Set\(baseReasoning\.causalChain\.map/);
  assert.match(reasoningBuilder, /claimIds: new Set\(baseReasoning\.claims\.map/);
  assert.match(reasoningBuilder, /seriesById: new Map\(\)/);
  assert.match(reasoningBuilder, /entityById: new Map\(\)/);
  assert.match(reasoningBuilder, /expectedRelationships: new Set\(\)/);
  assert.match(reasoningBuilder, /nextTest: plan\.nextTest/);
  assert.match(reasoningBuilder, /visualPlan: plan\.visualPlan/);
});

test("canonical Story persistence uses validated next-test ownership rather than raw Story Synthesis catalysts", () => {
  assert.match(promotion, /next_catalyst: reasoning\.nextTest\?\.label \?\? null/);
  assert.doesNotMatch(promotion, /next_catalyst: candidate\.nextCatalysts/);
  assert.doesNotMatch(promotion, /hypothesis\.next_catalysts\.join/);
  assert.match(runtime, /nextTest: story\.next_catalyst \|\| ""/);
});

test("PR3B adds no local series, entity, geography or relationship inference fallback", () => {
  assert.doesNotMatch(reasoningBuilder, /storySeries|pairFor|macroFocusKeys|getStoryConnections|profile\(/);
  assert.doesNotMatch(planCandidates, /DXY|US10Y|SPY|SOXX|JPY=X|CL=F/);
  assert.match(runtime, /Do not use title, slug, theme, asset name or general market knowledge to manufacture a series, geography, entity, causal edge or expected relationship/);
});
