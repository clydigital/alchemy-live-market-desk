import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const provenanceMigration = readFileSync(
  path.join(root, "supabase", "migrations", "20260908113000_provenance_complete_research_graph_p2.sql"),
  "utf8",
);
const entityMigration = readFileSync(
  path.join(root, "supabase", "migrations", "20260908114500_provenance_canonical_entities_p2.sql"),
  "utf8",
);
const migration = `${provenanceMigration}\n${entityMigration}`;
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
});

test("MRU P2 requires derived metrics to resolve to real canonical observations", () => {
  assert.match(migration, /validate_derived_metric_observation_lineage/);
  assert.match(migration, /derived_metric_versions_validate_inputs/);
  assert.match(migration, /derived_metric_versions_inputs_required/);
  assert.match(migration, /cardinality\(new\.input_observation_ids\) = 0/);
  assert.match(migration, /from public\.normalised_observations observation/);
});

test("MRU P2 activates the existing canonical entity/evidence graph deterministically", () => {
  assert.match(migration, /sync_intelligence_evidence_entities/);
  assert.match(migration, /public\.intelligence_entities/);
  assert.match(migration, /public\.intelligence_evidence_entities/);
  assert.match(migration, /'affected_asset'/);
  assert.match(migration, /'affected_topic'/);
  assert.match(entityMigration, /no free-text NER or LLM inference is introduced/i);
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
    "canonical_entity",
    "story_claim",
    "story_thesis_version",
  ]) {
    assert.match(migration, new RegExp(`'${node}'`));
  }
  assert.doesNotMatch(migration, /create table public\.research_(?:reasoning|story_reasoning)/i);
});

test("P2 keeps the canonical research-intake Evidence identity used by Live", () => {
  assert.match(runtime, /external_evidence_id:\s*`research-intake:\$\{item\.id\}`/);
  assert.match(migration, /'research-intake:' \|\| intake\.id::text/);
});
