import test from "node:test";
import assert from "node:assert/strict";
import { projectVisualForReader, visualTableHtml } from "../lib/bluebelly-visual-projection.ts";

const table = {
  schema_version: "bluebelly.visual.v1", visual_id: "sample", kind: "table", title: "Sample", description: "Comparable figures",
  unit: "USD", as_of_et: "2026-10-28T16:00:00-04:00", retrieved_at: "2026-10-29T00:00:00Z",
  period_basis: "quarter", columns: ["Issuer", "Cash flow"], rows: [["Example", 10]],
  series: [], sources: [{url: "https://example.com/source", publisher: "Original", observed_at: "2026-10-28T16:00:00-04:00"}],
  evidence_status: "ORIGINAL_VERIFIED", limitations: []
};
test("public projection requires verified status and preserves original values", () => {
  const result = projectVisualForReader(table, "public");
  assert.deepEqual(result?.rows, [["Example", 10]]);
  assert.equal(projectVisualForReader({...table, evidence_status:"RESEARCH_LEAD"}, "public"), null);
  assert.ok(projectVisualForReader({...table, evidence_status:"RESEARCH_LEAD"}, "owner"));
});
test("portable table has source/date and escapes untrusted text", () => {
  const projection = projectVisualForReader({...table, rows:[["<script>", 10]]}, "public");
  assert.ok(projection);
  const html = visualTableHtml(projection!);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /2026-10-28T16:00:00-04:00/);
  assert.match(html, /https:\/\/example.com\/source/);
});
test("misaligned chart series cannot be projected", () => {
  const chart = {...table, kind:"line", series:[{name:"Revenue", values:[1, 2]}]};
  assert.equal(projectVisualForReader(chart, "public"), null);
});
