import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "lib", "intelligence", "schemas.ts"), "utf8");
const checkpoints = fs.readFileSync(path.join(root, "lib", "intelligence", "resumable-checkpoints.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821131500_budget_neutral_story_review_repair.sql"), "utf8");
const macroPage = fs.readFileSync(path.join(root, "app", "data", "macro", "page.tsx"), "utf8");

test("existing Story maintenance piggybacks on the one Market Belief call", () => {
  assert.equal((runtime.match(/modelStage<MarketBeliefOutput>/g) || []).length, 1);
  assert.match(runtime, /stageKey: "market_belief"/);
  assert.match(runtime, /input: \{[^\n]*evidence, storyReviewTargets \}/);
  assert.match(runtime, /maxOutputTokens: 2_800/);
  assert.doesNotMatch(runtime, /stageKey: "story_(?:review|maintenance)"/);
  assert.doesNotMatch(checkpoints, /"story_(?:review|maintenance)"/);
  assert.match(schema, /storyAssessments:[\s\S]*maxItems: 4/);
});

test("target list is frozen durably and queue omission is retryable", () => {
  assert.match(runtime, /freezeStoryReviewTargets\(selected\)/);
  assert.match(migration, /freeze_intelligence_story_review_targets/);
  assert.match(migration, /jsonb_array_length\(p_targets\) > 4/);
  assert.match(runtime, /status: "retryable"/);
  assert.match(runtime, /omitted or duplicated the required Story assessment/);
});

test("assessment application is idempotent and queue completion follows persisted application", () => {
  assert.match(migration, /unique\(engine_run_id, story_id\)/);
  assert.match(migration, /if assessment\.applied_at is not null/);
  assert.match(migration, /if material_allowed then[\s\S]*update public\.stories/);
  assert.match(migration, /update public\.intelligence_story_assessments[\s\S]*applied_at = evaluated_at[\s\S]*update public\.intelligence_reevaluation_queue/);
  assert.match(migration, /queue\.claimed_by_engine_run_id = assessment\.engine_run_id/);
});

test("unchanged and creator-only assessments advance state without rewriting Story", () => {
  assert.match(runtime, /Material mutation was suppressed because no eligible non-creator evidence/);
  assert.match(migration, /material_allowed := assessment\.disposition <> 'unchanged'[\s\S]*cardinality\(assessment\.eligible_evidence_ids\) > 0/);
  assert.match(migration, /set last_evaluated_at = evaluated_at/);
});

test("Macro stale_error requires an explicit exhausted retry and source health is separate", () => {
  assert.match(migration, /when release\.last_ingestion_attempt_at is null then 'ingestion_pending'/);
  assert.match(migration, /when release\.ingestion_retry_exhausted then 'stale_error'/);
  assert.doesNotMatch(migration, /release_date >= p_now - p_ingestion_grace[\s\S]{0,120}stale_error/);
  assert.match(macroPage, /Latest Macro source attempt degraded/);
  assert.match(macroPage, /prior COMPLETE snapshot remains canonical/);
});
