import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260823131844_canonical_story_reasoning_atomic_persistence.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

function section(start: string, end: string) {
  const startAt = migration.indexOf(start);
  const endAt = migration.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `Missing migration section: ${start}`);
  assert.notEqual(endAt, -1, `Missing migration section boundary: ${end}`);
  return migration.slice(startAt, endAt);
}

const trigger = section(
  "create or replace function public.capture_story_thesis_version()",
  "create or replace function public.persist_canonical_story_reasoning(",
);
const rpc = section(
  "create or replace function public.persist_canonical_story_reasoning(",
  "revoke all on function public.persist_canonical_story_reasoning",
);

test("existing Story revisions keep the canonical trigger as their sole version writer", () => {
  assert.match(trigger, /alchemy\.story_reasoning_context/);
  assert.match(trigger, /'reasoning', reasoning_context -> 'reasoning'/);
  assert.match(trigger, /'canonicalMutationKey', reasoning_context ->> 'mutationKey'/);
  assert.match(trigger, /insert into public\.story_events/);
  assert.match(trigger, /insert into public\.story_thesis_versions/);
  assert.match(trigger, /set current_thesis_version_id = new_version_id/);
  assert.match(trigger, /set_config\('alchemy\.story_reasoning_context', '', true\)[\s\S]*set current_thesis_version_id = new_version_id/);

  const existingBranch = section("else\n    select *", "select to_jsonb(final_story)");
  assert.doesNotMatch(existingBranch, /insert into public\.story_events/);
  assert.doesNotMatch(existingBranch, /insert into public\.story_thesis_versions/);
  assert.match(existingBranch, /set_config\('alchemy\.story_reasoning_context'/);
  assert.match(existingBranch, /suppress_event_mirror[\s\S]*true/);
});

test("the same RPC creates a new Story, event, version, and exact pointer atomically", () => {
  const creationBranch = section("if p_story_id is null then", "else\n    select *");
  assert.match(creationBranch, /insert into public\.stories/);
  assert.match(creationBranch, /insert into public\.story_events/);
  assert.match(creationBranch, /insert into public\.story_thesis_versions/);
  assert.match(creationBranch, /'reasoning', p_reasoning/);
  assert.match(creationBranch, /set current_thesis_version_id = result_version_id/);
  assert.doesNotMatch(creationBranch, /exception when/);
});

test("version failures propagate so PostgreSQL rolls the whole RPC statement back", () => {
  assert.doesNotMatch(rpc, /exception\s+when/);
  assert.match(rpc, /raise exception 'Canonical Story reasoning trigger did not persist the exact version'/);
  assert.match(rpc, /result_event_id is null or result_version_number is null/);
  assert.doesNotMatch(rpc, /commit|start transaction|begin transaction/);
});

test("mutation-key idempotency prevents retry history duplication", () => {
  assert.match(migration, /create unique index if not exists story_thesis_versions_canonical_mutation_key_uidx/);
  assert.match(rpc, /pg_advisory_xact_lock\(hashtextextended\('canonical-story-reasoning:' \|\| mutation_key_value, 0\)\)/);
  assert.match(rpc, /where version\.snapshot ->> 'canonicalMutationKey' = mutation_key_value/);
  assert.match(rpc, /if result_version_id is not null then[\s\S]*false;[\s\S]*return;/);
  assert.match(rpc, /existing_reasoning is distinct from p_reasoning/);
  assert.match(
    rpc,
    /from public\.stories existing_story[\s\S]*for share;[\s\S]*story_row\.current_thesis_version_id is distinct from result_version_id/,
  );
  assert.match(
    rpc,
    /raise exception 'Canonical Story mutation retry is stale because a newer thesis version is current'/,
  );
});

test("PR #94/#95 maintenance and freshness semantics remain active", () => {
  assert.match(trigger, /alchemy\.story_maintenance_context/);
  assert.match(trigger, /and reasoning_context is null then[\s\S]*return new/);
  assert.match(trigger, /'origin', 'existing_story_maintenance'/);
  assert.match(trigger, /'maintenanceContext', maintenance_context/);
  assert.match(trigger, /when maintenance_context ->> 'disposition' = 'invalidated' then 'invalidation'/);
});

test("RPC is service-role-only, invoker-secured, and migration is non-destructive", () => {
  assert.match(rpc, /security invoker/);
  assert.match(rpc, /set search_path = ''/);
  assert.match(migration, /revoke all on function public\.persist_canonical_story_reasoning[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.persist_canonical_story_reasoning[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /create table|drop table|truncate|delete from public\.story_thesis_versions|update public\.story_thesis_versions/);
  assert.match(migration, /No historical row is changed/);
});
