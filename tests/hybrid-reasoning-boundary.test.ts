import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
const projection = readFileSync(new URL("../lib/hybrid-reasoning-projection.ts", import.meta.url), "utf8");
const a3 = readFileSync(new URL("../lib/dossier-v2/reevaluation-propagation.ts", import.meta.url), "utf8");

test("Hybrid reasoning projection is read-only and leaves Story waking to existing A3", () => {
  const combined = [page, projection].join("\n");
  assert.match(page, /buildHybridReasoningProjection/);
  assert.match(projection, /A3_QUEUE_ONLY/);
  assert.doesNotMatch(combined, /\.from\(["']stories["']\)/);
  assert.doesNotMatch(combined, /story_thesis_versions.*insert|insert.*story_thesis_versions/i);
  assert.doesNotMatch(combined, /intelligence_reevaluation_queue.*insert|insert.*intelligence_reevaluation_queue/i);
  assert.match(a3, /intelligence_reevaluation_queue/);
  assert.match(a3, /requested_by_evidence_id/);
});

test("Hybrid scenario tails stay guarded rather than inferred from prose", () => {
  assert.match(projection, /Scenario D does not gain probability automatically/);
  assert.match(projection, /Scenario E does not gain probability automatically/);
  assert.doesNotMatch(projection, /marketReaction.*Scenario E|headline.*Scenario D/);
});
