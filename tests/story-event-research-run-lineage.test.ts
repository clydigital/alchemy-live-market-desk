import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261021033500_story_event_research_run_lineage.sql", import.meta.url),
  "utf8",
);

test("the existing canonical Story writer remains the only writer", () => {
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION public\.capture_story_thesis_version\(\)/gi) || []).length, 1);
  assert.equal((migration.match(/insert into public\.story_events\s*\(/gi) || []).length, 1);
  assert.equal((migration.match(/insert into public\.story_thesis_versions\s*\(/gi) || []).length, 1);
  assert.match(migration, /update public\.stories story\s+set current_thesis_version_id = new_version_id/i);
  assert.match(migration, /SET search_path TO ''/);
  assert.doesNotMatch(migration, /CREATE\s+TRIGGER\b/i);
  assert.doesNotMatch(migration, /CREATE\s+TABLE\b/i);
});

test("new maintenance events attach an exact persisted engine research-run identity", () => {
  assert.match(migration, /origin_research_run_id uuid;/);
  assert.match(migration, /maintenance_context ->> 'engineRunId'/);
  assert.match(migration, /select run\.research_run_id into origin_research_run_id\s+from public\.intelligence_engine_runs run\s+where run\.id = \(maintenance_context ->> 'engineRunId'\)::uuid/i);
  assert.match(migration, /story_id,event_type,headline,detail,confidence_delta,event_at,metadata,research_run_id/);
  assert.match(migration, /event_metadata,origin_research_run_id/);
  assert.match(migration, /\{12\}\$' then/);
});

test("the release never mutates append-only historical events", () => {
  const statements = migration.replace(/--[^\n]*/g, "").toLowerCase();
  assert.doesNotMatch(statements, /update\s+(?:public\.)?story_events\b/);
  assert.doesNotMatch(statements, /delete\s+from\s+(?:public\.)?story_events\b/);
  assert.doesNotMatch(statements, /alter\s+table\s+(?:public\.)?story_events\b/);
  assert.doesNotMatch(statements, /insert\s+into\s+public\.intelligence_engine_runs\b/);
});
