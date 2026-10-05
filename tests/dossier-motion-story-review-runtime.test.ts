import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(
  path.join(root, "lib", "intelligence", "runtime.ts"),
  "utf8",
);

function storyReviewRuntimeSection() {
  const start = runtime.indexOf("async function loadOrCreateStoryReviewTargets");
  const end = runtime.indexOf("async function markStoryReviewRetryable", start);
  assert.ok(start >= 0 && end > start, "Story review runtime section must exist");
  return runtime.slice(start, end);
}

test("C1.4b2 runtime recovers only persisted Dossiers named by exact Motion queue reasons", () => {
  const section = storyReviewRuntimeSection();

  assert.match(section, /parseDossierMotionQueueReason\(item\.reason\)/);
  assert.match(section, /if \(!item\.requested_by_evidence_id\) return \[\]/);
  assert.match(
    section,
    /market_dossiers_v2\?select=id,contract_version,previous_dossier_id,as_of,freshness,research_gaps,payload,created_at&id=in\.\(/,
  );
  assert.match(section, /validateMarketDossierV2Record\(row\)/);
  assert.match(section, /\.catch\(\(\) => \[\]\)/);
});

test("C1.4b2 attaches recovered System-2 framing to the existing Story queue row only", () => {
  const section = storyReviewRuntimeSection();

  assert.match(section, /buildDossierMotionStoryReviewContext\(\{/);
  assert.match(section, /queueReason: item\.reason/);
  assert.match(section, /targetStoryId: item\.target_id/);
  assert.match(section, /canonicalEvidenceId: item\.requested_by_evidence_id/);
  assert.match(section, /dossierMotionContext,/);

  assert.doesNotMatch(section, /method:\s*"POST"[\s\S]*market_dossiers_v2/);
  assert.doesNotMatch(section, /research_gap\/run-one|research_gap\/handoff|runStructuredStage/);
});
