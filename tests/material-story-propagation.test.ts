import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { explicitlyMentionedInstrumentSpecs } from "../lib/instrument-mentions.ts";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260908142909_repair_material_story_propagation.sql"),
  "utf8",
);

test("canonical intake keeps exact asset metadata needed for deterministic Story recruitment", () => {
  const instruments = explicitlyMentionedInstrumentSpecs(
    "United States · Central bank · USD, US02Y, SPX, GOLD. Yen strength drove USD/JPY lower. Netflix met resistance.",
  ).map((item) => item.instrument);

  assert.ok(instruments.includes("US02Y"));
  assert.ok(instruments.includes("SPX"));
  assert.ok(instruments.includes("XAUUSD"));
  assert.ok(instruments.includes("USDJPY"));
  assert.ok(instruments.includes("NFLX"));
  assert.match(runtime, /item\.stats_signal,[\s\S]*item\.news_signal,[\s\S]*item\.review_reason/);
  assert.match(runtime, /intelligence_story_evidence\?on_conflict=story_id,evidence_id,evidence_role/);
  assert.match(runtime, /resolution=ignore-duplicates/);
  assert.match(runtime, /canonicalisedEvidenceIds = await canonicaliseIntake\(stories\)/);
  assert.match(runtime, /loadEvidence\(canonicalisedEvidenceIds\)/);
  assert.match(runtime, /const boundedLimit = MAX_EVIDENCE \+ unique\(includeIds\)\.length/);
});

test("Story assessment application uses the transactional v2 repair boundary", () => {
  assert.match(runtime, /rpc\/apply_intelligence_story_assessment_v2/);
  assert.match(migration, /from public\.apply_intelligence_story_assessment\(p_assessment_id\)/);
  assert.match(migration, /candidate ->> 'evidenceNature' = 'scheduled_event'/);
  assert.match(migration, /evidence\.structured_payload ->> 'evidenceNature' = 'scheduled_event'/);
  assert.match(migration, /'operationalCatalystRefresh', true/);
});

test("material freshness advances only from an applied material assessment", () => {
  assert.match(migration, /if new\.material_change_applied and new\.applied_at is not null/);
  assert.match(migration, /set last_material_update_at = greatest/);
  assert.match(migration, /where material_change_applied[\s\S]*and applied_at is not null/);
  assert.match(migration, /article_verdict = 'theme_seed_unverified'[\s\S]*set last_material_update_at = null|set last_material_update_at = null[\s\S]*article_verdict = 'theme_seed_unverified'/);
});

test("scheduled evidence is removed from the database material-evidence set", () => {
  assert.match(migration, /filter_story_assessment_material_evidence/);
  assert.match(migration, /<> 'scheduled_event'/);
  assert.doesNotMatch(migration, /set material_change_applied\s*=\s*true/);
});
