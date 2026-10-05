import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storyReview = readFileSync(
  new URL("../lib/intelligence/story-review.ts", import.meta.url),
  "utf8",
);
const runtime = readFileSync(
  new URL("../lib/intelligence/runtime.ts", import.meta.url),
  "utf8",
);
const supabase = readFileSync(
  new URL("../lib/intelligence/supabase.ts", import.meta.url),
  "utf8",
);
const freezeMigration = readFileSync(
  new URL("../supabase/migrations/20260821080427_story_review_proof_hardening.sql", import.meta.url),
  "utf8",
);

test("C1.4c2 frozen Story targets retain exact Dossier Motion reassessment context", () => {
  assert.match(
    storyReview,
    /dossierMotionReassessments,\s*\n\s*catalystCandidates/,
  );
  assert.match(
    runtime,
    /const owned = await claimStoryReviewQueues\(engineRunId, selected\);\s*\n\s*return freezeStoryReviewTargets\(owned\)/,
  );
  assert.match(
    supabase,
    /storyReviewTargets: durableFrozenArray\(existingFrozen\.storyReviewTargets, state\.frozenInputs\.storyReviewTargets\)/,
  );
  assert.match(
    supabase,
    /rpc\/freeze_intelligence_story_review_targets/,
  );
});

test("C1.4c2 database freeze enriches reviewContext without replacing existing context fields", () => {
  assert.match(
    freezeMigration,
    /item \|\| jsonb_build_object\(\s*'reviewContext',\s*coalesce\(item -> 'reviewContext', '\{\}'::jsonb\) \|\| jsonb_build_object/,
  );
  assert.doesNotMatch(
    freezeMigration,
    /item\s*-\s*'reviewContext'/,
  );
  assert.doesNotMatch(
    freezeMigration,
    /jsonb_build_object\(\s*'reviewContext'[\s\S]{0,100}'dossierMotionReassessments',\s*'\[\]'::jsonb/,
  );
});

test("C1.4c2 Market Belief receives the same frozen target object and no parallel Story-review stage", () => {
  assert.match(
    runtime,
    /const storyReviewTargets = await loadOrCreateStoryReviewTargets/,
  );
  assert.match(
    runtime,
    /const modelStoryReviewTargets = storyReviewTargets\.filter/,
  );
  assert.match(
    runtime,
    /stageKey: "market_belief"[\s\S]*storyReviewTargets: modelStoryReviewTargets/,
  );
  assert.doesNotMatch(
    runtime,
    /stageKey: "story_(?:review|maintenance)"/,
  );
});
