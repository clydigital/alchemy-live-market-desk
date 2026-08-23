import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "lib", "intelligence", "schemas.ts"), "utf8");
const checkpoints = fs.readFileSync(path.join(root, "lib", "intelligence", "resumable-checkpoints.ts"), "utf8");
const openai = fs.readFileSync(path.join(root, "lib", "intelligence", "openai.ts"), "utf8");
const baseMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821075252_budget_neutral_story_review_repair.sql"), "utf8");
const hardeningMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821080427_story_review_proof_hardening.sql"), "utf8");
const atomicReasoningMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260823131844_canonical_story_reasoning_atomic_persistence.sql"), "utf8");
const migration = `${baseMigration}\n${hardeningMigration}\n${atomicReasoningMigration}`;
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

test("target list and blocker context are frozen durably, including a fresh null metadata path", () => {
  assert.match(runtime, /freezeStoryReviewTargets\(selected\)/);
  assert.match(hardeningMigration, /freeze_intelligence_story_review_targets/);
  assert.match(hardeningMigration, /jsonb_array_length\(p_targets\) > 4/);
  assert.match(hardeningMigration, /jsonb_typeof\(existing_targets\) is distinct from 'array'/);
  assert.match(hardeningMigration, /'reviewContext'/);
  assert.match(hardeningMigration, /'researchDebt'/);
  assert.match(hardeningMigration, /'reason', debt\.reason/);
  assert.match(hardeningMigration, /'nextAction', debt\.next_action/);
  assert.match(hardeningMigration, /'queueReasons'/);
});

test("material Story maintenance reuses canonical version trigger and suppresses duplicate mirrored events", () => {
  assert.match(baseMigration, /unique\(engine_run_id, story_id\)/);
  assert.match(hardeningMigration, /if assessment\.applied_at is not null/);
  assert.match(migration, /alchemy\.story_maintenance_context/);
  assert.match(migration, /marketBeliefStageRunId/);
  assert.match(atomicReasoningMigration, /create or replace function public\.capture_story_thesis_version/);
  assert.match(atomicReasoningMigration, /insert into public\.story_events/);
  assert.match(atomicReasoningMigration, /insert into public\.story_thesis_versions/);
  assert.match(atomicReasoningMigration, /current_thesis_version_id = new_version_id/);
  assert.match(atomicReasoningMigration, /suppress_event_mirror[\s\S]*true/);
  assert.match(hardeningMigration, /suppress_event_mirror boolean not null default false/);
  assert.match(hardeningMigration, /if new\.suppress_event_mirror then/);
  assert.match(hardeningMigration, /suppress_event_mirror\)[\s\S]*true/);
  assert.match(hardeningMigration, /update public\.intelligence_story_assessments[\s\S]*applied_at=evaluated_at[\s\S]*update public\.intelligence_reevaluation_queue/);
});

test("unchanged and creator-only assessments advance freshness without rewriting Story", () => {
  assert.match(runtime, /Material mutation was suppressed because no eligible non-creator evidence/);
  assert.match(hardeningMigration, /effective_status := case when material_allowed then assessment\.disposition else 'unchanged' end/);
  assert.match(hardeningMigration, /update public\.intelligence_story_states state[\s\S]*last_evaluated_at=evaluated_at/);
  assert.match(hardeningMigration, /if material_allowed then[\s\S]*update public\.stories story/);
});

test("automatic invalidation uses the strict evidence policy", () => {
  assert.match(hardeningMigration, /evidence\.evidence_class not in \('transcript', 'research_analysis'\)/);
  assert.match(hardeningMigration, /source\.source_tier <= 4/);
  assert.match(hardeningMigration, /assessment\.disposition <> 'invalidated'[\s\S]*has_tier_one_or_two[\s\S]*independent_groups >= 2/);
  assert.match(hardeningMigration, /when effective_status='invalidated' then 'archived'/);
  assert.match(hardeningMigration, /when effective_status='invalidated' then 'invalidated'/);
});

test("abandoned reevaluation queue claims recover without another cron", () => {
  assert.match(baseMigration, /Recovered abandoned Story reevaluation claim/);
  assert.match(baseMigration, /queue\.updated_at < now\(\) - interval '20 minutes'/);
  assert.match(baseMigration, /run\.status in \('completed', 'failed', 'blocked'\)/);
  assert.match(runtime, /status: "retryable"/);
  assert.match(runtime, /omitted or duplicated the required Story assessment/);
});

test("due high and critical Story debt is rescheduled after assessment rather than globally blocking", () => {
  assert.match(hardeningMigration, /debt\.severity in \('high','critical'\)/);
  assert.match(hardeningMigration, /debt\.severity='critical' then interval '6 hours' else interval '24 hours'/);
  assert.match(hardeningMigration, /last_attempt_at=evaluated_at/);
  assert.doesNotMatch(hardeningMigration, /status='resolved'/);
});

test("Belief, Hypothesis and Story assets are intersected with explicit evidence attribution", () => {
  assert.match(runtime, /persistBeliefs\(output: MarketBeliefOutput, evidenceById:/);
  assert.match(runtime, /affected_assets: onlyExplicitAssets\(belief\.affectedAssets, allowedAssets\)/);
  assert.match(runtime, /affected_assets: onlyExplicitAssets\(hypothesis\.affectedAssets, belief\?\.affected_assets \?\? \[\]\)/);
  assert.match(runtime, /const affectedAssets = onlyExplicitAssets\(candidate\.affectedAssets, reviewedById/);
});

test("Macro stale_error requires an explicit exhausted retry and source health is separate", () => {
  assert.match(baseMigration, /when release\.last_ingestion_attempt_at is null then 'ingestion_pending'/);
  assert.match(baseMigration, /when release\.ingestion_retry_exhausted then 'stale_error'/);
  assert.doesNotMatch(baseMigration, /release_date >= p_now - p_ingestion_grace[\s\S]{0,120}stale_error/);
  assert.match(macroPage, /Latest Macro source attempt degraded/);
  assert.match(macroPage, /prior COMPLETE snapshot remains canonical/);
});
