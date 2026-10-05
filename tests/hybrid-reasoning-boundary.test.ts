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


test("B3 Hybrid loads exact-Dossier Research Gap status without raw Motion eligibility", () => {
  assert.match(page, /loadHybridResearchGapStatus/);
  assert.match(page, /selection\.selectedDossierId/);
  assert.doesNotMatch(page, /marketMotionInvestigationEligibility/);
  assert.doesNotMatch(page, /operational Research Gap worker uses the same eligibility gate/i);
  assert.doesNotMatch(page, /INVESTIGATION ELIGIBLE/);
});

test("B3 Hybrid renders Research Gap lifecycle as operational status only", () => {
  assert.match(page, /Research complete; canonical handoff pending/);
  assert.match(page, /Returned to canonical research; current Dossier remains authoritative/);
  assert.doesNotMatch(page, /HANDED_OFF[^\n]*incorporated|incorporated[^\n]*HANDED_OFF/i);
  assert.doesNotMatch(page, /researchGapStatus[^\n]*(CONFIRMING|CONTRADICTING|NO_CHANGE)/);
});

test("B3 Research Gap lifecycle does not enter Hybrid analytical reasoning inputs", () => {
  const call = page.match(/buildHybridReasoningProjection\(\{[\s\S]*?\}\);/)?.[0] ?? "";
  assert.ok(call);
  assert.doesNotMatch(call, /researchGap|gapStatus|lifecycle/i);
  assert.doesNotMatch(projection, /research_outcome|ResearchGapOutcome|HybridResearchGapStatus/);
});
