import assert from "node:assert/strict";
import { test } from "node:test";
import { THESIS_LEDGER_V2_CONTRACT_VERSION } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  buildResearchBrainSystemInstructions,
  getResearchBrainJsonSchema,
} from "../lib/dossier-v2/research-brain-prompt.ts";

test("Research Brain first-pass instructions keep reference arrays ID-only", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /REFERENCE FIELDS ARE ID-ONLY/);
  assert.match(instructions, /market_evidence\.unresolved may contain ONLY supplied packet\.observed_evidence\.evidence_id values or packet\.research_leads\.lead_id values/);
  assert.match(instructions, /Never place prose, missing-data descriptions, chart questions, or invented IDs in those arrays/);
  assert.match(instructions, /Put missing-data prose in investigations\[\*\]\.missing_evidence, research_now, or research_gaps instead/);
  assert.match(instructions, /NEVER write raw evidence IDs, source IDs, UUIDs, filenames, ingestion keys, provider handles/);
  assert.match(instructions, /ASDA-file/);
  assert.match(instructions, /provenance is rendered separately by Live\/Hybrid/);
});

test("Research Brain first-pass instructions enforce valid evolved thesis lineage", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /THESIS LEDGER V2/);
  assert.match(instructions, /Use state "evolved" ONLY when both predecessor and successor entries are present in the output ledger/);
  assert.match(instructions, /successor\.parent_thesis_id points back to the predecessor/);
  assert.match(instructions, /Otherwise do not use "evolved"/);
});

test("Research Brain JSON schema pins thesis ledger contract versions to V2", () => {
  const schema = getResearchBrainJsonSchema() as any;
  const ledger = schema.properties.thesis_ledger;
  const entry = ledger.properties.entries.items;

  assert.deepEqual(
    ledger.properties.contract_version.enum,
    [THESIS_LEDGER_V2_CONTRACT_VERSION],
  );
  assert.deepEqual(
    entry.properties.contract_version.enum,
    [THESIS_LEDGER_V2_CONTRACT_VERSION],
  );
});


test("Research Brain Divergence V1 stays inside priority investigations", () => {
  const instructions = buildResearchBrainSystemInstructions();
  const schema = getResearchBrainJsonSchema() as any;
  const investigation = schema.properties.investigations.items;

  assert.match(instructions, /DIVERGENCE V1 LIVES ONLY INSIDE PRIORITY INVESTIGATIONS/);
  assert.match(instructions, /A System 1 candidate may prioritise the investigation but must not force a divergence label or causal explanation/);
  assert.deepEqual(investigation.properties.divergence.enum, [
    "NONE",
    "PARTIAL",
    "MATERIAL",
    "UNRESOLVED",
  ]);
  assert.ok(investigation.required.includes("expected_reaction"));
  assert.ok(investigation.required.includes("observed_reaction"));
  assert.ok(investigation.required.includes("divergence"));
});
