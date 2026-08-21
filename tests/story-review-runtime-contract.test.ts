import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "lib", "intelligence", "schemas.ts"), "utf8");
const checkpoints = fs.readFileSync(path.join(root, "lib", "intelligence", "resumable-checkpoints.ts"), "utf8");
const openai = fs.readFileSync(path.join(root, "lib", "intelligence", "openai.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821131500_budget_neutral_story_review_repair.sql"), "utf8");
const macroPage = fs.readFileSync(path.join(root, "app", "data", "macro", "page.tsx"), "utf8");

test("existing Story maintenance piggybacks on the one Market Belief call", () => {
  assert.equal((runtime.match(/modelStage<MarketBeliefOutput>/g) || []).length, 1);
  assert.match(runtime, /stageKey: "market_belief"/);
  assert.match(runtime, /input: \{[^\n]*evidence, storyReviewTargets \}/);
  assert.doesNotMatch(runtime, /stageKey: "story_(?:review|maintenance)"/);
  assert.doesNotMatch(checkpoints, /"story_(?:review|maintenance)"/);
  assert.match(schema, /storyAssessments:[\s\S]*maxItems: 4/);
  assert.match(openai, /stageKey === "market_belief"[\s\S]*Math\.max\(maxOutputTokens, 4_500\)/);
  assert.match(openai, /max_output_tokens: effectiveMaxOutputTokens/);
});

test("target list and blocker context are frozen durably", () => {
  assert.match(runtime, /freezeStoryReviewTargets\(selected\)/);
  assert.match(migration, /freeze_intelligence_story_review_targets/);
  assert.match(migration, /jsonb_array_length\(p_targets\) > 4/);
  assert.match(migration, /'reviewContext'/);
  assert.match(migration, /'researchDebt'/);
  assert.match(migration, /'reason', debt\.reason/);
  assert.match(migration, /'nextAction', debt\.next_action/);
  assert.match(migration, /'queueReasons'/);
});

test("assessment application is idempotent and material mutation creates canonical history", () => {
  assert.match(migration, /unique\(engine_run_id, story_id\)/);
  assert.match(migration, /if assessment\.applied_at is not null/);
  assert.match(migration, /marketBeliefStageRunId/);
  assert.match(migration, /insert into public\.story_events/);
  assert.match(migration, /insert into public\.story_thesis_versions/);
  assert.match(migration, /current_thesis_version_id = existing_version_id/);
  assert.match(migration, /insert into public\.story_updates/);
  assert.match(migration, /update public\.intelligence_story_assessments[\s\S]*applied_at = evaluated_at[\s\S]*update public\.intelligence_reevaluation_queue/);
  assert.match(migration, /queue\.claimed_by_engine_run_id = assessment\.engine_run_id/);
});

test("unchanged and creator-only assessments advance freshness without rewriting Story", () => {
  assert.match(runtime, /Material mutation was suppressed because no eligible non-creator evidence/);
  assert.match(migration, /effective_status := case when material_allowed then assessment\.disposition else 'unchanged' end/);
  assert.match(migration, /Every valid assessment advances the review watermark/);
  assert.match(migration, /if material_allowed then[\s\S]*insert into public\.story_thesis_versions/);
});

test("automatic invalidation uses the strict evidence policy", () => {
  assert.match(migration, /evidence\.evidence_class not in \('transcript', 'research_analysis'\)/);
  assert.match(migration, /source\.source_tier <= 4/);
  assert.match(migration, /assessment\.disposition <> 'invalidated'[\s\S]*has_tier_one_or_two[\s\S]*independent_groups >= 2/);
  assert.match(migration, /when effective_status = 'invalidated' then 'archived'/);
  assert.match(migration, /when effective_status = 'invalidated' then 'invalidated'/);
});

test("abandoned reevaluation queue claims recover without another cron", () => {
  assert.match(migration, /Recovered abandoned Story reevaluation claim/);
  assert.match(migration, /queue\.updated_at < now\(\) - interval '20 minutes'/);
  assert.match(migration, /run\.status in \('completed', 'failed', 'blocked'\)/);
  assert.match(runtime, /status: "retryable"/);
  assert.match(runtime, /omitted or duplicated the required Story assessment/);
});

test("Belief, Hypothesis and Story assets are intersected with explicit evidence attribution", () => {
  assert.match(runtime, /persistBeliefs\(output: MarketBeliefOutput, evidenceById:/);
  assert.match(runtime, /affected_assets: onlyExplicitAssets\(belief\.affectedAssets, allowedAssets\)/);
  assert.match(runtime, /affected_assets: onlyExplicitAssets\(hypothesis\.affectedAssets, belief\?\.affected_assets \?\? \[\]\)/);
  assert.match(runtime, /const affectedAssets = onlyExplicitAssets\(candidate\.affectedAssets, reviewedById/);
});

test("Macro stale_error requires an explicit exhausted retry and source health is separate", () => {
  assert.match(migration, /when release\.last_ingestion_attempt_at is null then 'ingestion_pending'/);
  assert.match(migration, /when release\.ingestion_retry_exhausted then 'stale_error'/);
  assert.doesNotMatch(migration, /release_date >= p_now - p_ingestion_grace[\s\S]{0,120}stale_error/);
  assert.match(macroPage, /Latest Macro source attempt degraded/);
  assert.match(macroPage, /prior COMPLETE snapshot remains canonical/);
});
