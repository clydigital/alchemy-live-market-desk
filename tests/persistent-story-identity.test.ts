import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260904002000_preserve_persistent_story_identity.sql", import.meta.url), "utf8");
const questionIdentityMigration = readFileSync(new URL("../supabase/migrations/20260930130000_preserve_persistent_story_question.sql", import.meta.url), "utf8");
const synthesisContract = readFileSync(new URL("../lib/intelligence/story-synthesis-contract-v1.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("existing Story updates normalise the parent title before atomic persistence", () => {
  assert.match(migration, /if p_story_id is not null then/i);
  assert.match(migration, /select existing_story\.title[\s\S]*for update;/i);
  assert.match(migration, /normalised_story := jsonb_set\([\s\S]*'\{title\}'[\s\S]*to_jsonb\(durable_title\)/i);
  assert.match(migration, /persist_canonical_story_reasoning_v1\([\s\S]*normalised_story/i);
});

test("fresh development headline remains the append-only event headline", () => {
  assert.match(runtime, /event:\s*\{[\s\S]*headline:\s*candidate\.title\.slice\(0, 180\)/);
  assert.match(runtime, /metadata:\s*\{\s*novelty_class:\s*"existing_story_update"\s*\}/);
});

test("new Story synthesis title is defined as a durable thematic identity", () => {
  assert.match(synthesisContract, /Durable persistent Story identity, not the latest event headline/);
  assert.match(synthesisContract, /Put the newest event-specific wording in whatChanged and the append-only Story event instead/);
});


test("existing Story updates preserve an established market question at the persistence boundary", () => {
  assert.match(questionIdentityMigration, /select[\s\S]*existing_story\.title,[\s\S]*existing_story\.market_question/i);
  assert.match(questionIdentityMigration, /nullif\(btrim\(durable_market_question\), ''\) is not null/i);
  assert.match(questionIdentityMigration, /jsonb_set\([\s\S]*'\{market_question\}'[\s\S]*to_jsonb\(durable_market_question\)/i);
  assert.match(questionIdentityMigration, /persist_canonical_story_reasoning_v1\([\s\S]*normalised_story/i);
});

test("runtime expresses existing Story identity explicitly instead of relying only on the database wrapper", () => {
  assert.match(runtime, /const existingStoryPayload = \{[\s\S]*title: matched\.title/);
  assert.match(runtime, /market_question: matched\.market_question\?\.trim\(\)[\s\S]*matched\.market_question[\s\S]*storyPayload\.market_question/);
  assert.match(runtime, /storyId: matched\.id,[\s\S]*storyPayload: existingStoryPayload/);
});

test("new Stories still take their durable identity from Story Synthesis", () => {
  assert.match(runtime, /storyId: null,[\s\S]*storyPayload: \{[\s\S]*slug,[\s\S]*\.\.\.storyPayload/);
});
