import test from "node:test";
import assert from "node:assert/strict";
import { parseVisualPayload, isPublicVisualEligible, scoreQualifiedIdea } from "../lib/bluebelly-visual-evidence.ts";

const valid = {
  schema_version: "bluebelly.visual.v1", visual_id: "oct-fed-1", kind: "table",
  title: "FedWatch", description: "Rate expectations", unit: "percent",
  as_of_et: "2026-10-28T16:00:00-04:00", retrieved_at: "2026-10-29T00:00:00Z",
  period_basis: "same source", columns: ["meeting", "probability"], rows: [["Dec", 81.8]],
  series: [], sources: [{url: "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", publisher: "CME", observed_at: "2026-10-28T16:00:00-04:00"}],
  evidence_status: "ORIGINAL_VERIFIED", limitations: []
};
test("valid native table and public evidence", () => {
  assert.ok(parseVisualPayload(valid));
  assert.equal(isPublicVisualEligible(valid), true);
});
test("reject unverified public promotion", () => {
  assert.ok(parseVisualPayload({...valid, evidence_status:"RESEARCH_LEAD"}));
  assert.equal(isPublicVisualEligible({...valid, evidence_status:"RESEARCH_LEAD"}), false);
});
test("reject missing source vintage, malformed rows and nonfinite numbers", () => {
  assert.equal(parseVisualPayload({...valid, as_of_et:"yesterday"}), null);
  assert.equal(parseVisualPayload({...valid, rows:[["Dec"]]}), null);
  assert.equal(parseVisualPayload({...valid, rows:[["Dec", Infinity]]}), null);
  assert.equal(parseVisualPayload({...valid, sources:[]}), null);
});
test("rank only qualified ideas with complete bounded criteria", () => {
  const scores = {market_impact:25,evidence_quality:20,decision_utility:17,novelty:12,timeliness:15};
  const context = {source_vintage:"2026-10-29T00:00:00Z",reason:"Strong upcoming catalyst",confidence:"HIGH" as const};
  assert.equal(scoreQualifiedIdea(true,scores,context)?.total,89);
  assert.equal(scoreQualifiedIdea(false,scores,context),null);
  assert.equal(scoreQualifiedIdea(true,{...scores,novelty:16},context),null);
  assert.equal(scoreQualifiedIdea(true,{...scores,novelty:undefined},context),null);
  assert.equal(scoreQualifiedIdea(true,scores,{...context,editor_override:95}),null);
  assert.equal(scoreQualifiedIdea(true,scores,{...context,editor_override:95,override_reason:"Editorial review"})?.editor_override,95);
});
