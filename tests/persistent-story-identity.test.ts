import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260904002000_preserve_persistent_story_identity.sql", import.meta.url), "utf8");
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
