import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = readFileSync(
  path.join(root, "supabase", "migrations", "20260908113000_provenance_complete_research_graph_p2.sql"),
  "utf8",
);
const runtime = readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");

test("MRU P2 captures research intake into immutable raw and normalised memory", () => {
  assert.match(migration, /capture_research_intake_provenance\(/);
  assert.match(migration, /research_intake_items_capture_provenance/);
  assert.match(migration, /provider\s*=\s*'research_intake'|\s*'research_intake',/);
  assert.match(migration, /'research_intake_claim'/);
  assert.match(migration, /'research-intake-provenance-v1'/);
  assert.match(migration, /for v_intake_item_id in[\s\S]*select id from public\.research_intake_items/);
});

test("MRU P2 makes canonical Evidence provenance mandatory", () => {
  assert.match(migration, /normalised_observation_id uuid/);
  assert.match(migration, /derived_metric_version_id uuid/);
  assert.match(migration, /intelligence_evidence_enforce_provenance/);
  assert.match(migration, /intelligence_evidence_provenance_required/);
  assert.match(
    migration,
    /normalised_observation_id is not null[\s\S]*or derived_metric_version_id is not null/,
  );
  assert.match(migration, /input_observation_ids/);
});

test("MRU P2 exposes the complete deterministic provenance graph without a new reasoning stage", () => {
  assert.match(migration, /research_provenance_edges_v1/);
  assert.match(migration, /research_claim_lineage_v1/);
  for (const node of [
    "research_intake_item",
    "raw_source_record",
    "normalised_observation",
    "derived_metric_version",
    "intelligence_evidence",
    "story_claim",
    "story_thesis_version",
    "asset_entity",
    "topic_entity",
  ]) {
    assert.match(migration, new RegExp(`'${node}'`));
  }
  assert.doesNotMatch(migration, /create table public\.research_(?:reasoning|story_reasoning)/i);
});

test("P2 keeps the canonical research-intake Evidence identity used by Live", () => {
  assert.match(runtime, /external_evidence_id:\s*`research-intake:\$\{item\.id\}`/);
  assert.match(migration, /'research-intake:' \|\| intake\.id::text/);
});
