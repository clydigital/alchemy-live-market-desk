import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/blue-desk/PublicMarketScreener.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../components/blue-desk/PublicMarketScreener.module.css", import.meta.url), "utf8");

test("all XL sectors are the default comparison, ranked by completed 1D return", () => {
  assert.match(component, /useState<string\[\]>\(\(\) => observations\.filter\(row => row\.type === "Sector"\)/);
  assert.match(component, /useState<EtfComparisonSortColumn \| null>\("1D"\)/);
  assert.match(component, /useState\(false\);\s*\n\s*function sortComparisonColumn/);
  assert.match(component, /sortEtfComparisonRows\(comparisonRows, comparisonSort, comparisonAscending, equalWeight\)/);
});
test("rotation is calculated only from matching observed sessions and enough sector coverage", () => {
  assert.match(component, /row\.asOf/);
  assert.match(component, /Number\.isFinite\(row\.change\)/);
  assert.match(component, /row\.asOf === date/);
  assert.match(component, /rows\.length >= 8/);
  assert.match(component, /sectorSnapshot\.asOf/);
  assert.match(component, /Sector rotation summary unavailable/);
  assert.doesNotMatch(component, /2026-11-04.*XLY|XLY.*2026-11-04/);
});
test("direction, provenance, accessibility and existing user controls remain", () => {
  assert.match(component, /Source-matched ETF price rotation, not confirmed investment flows/);
  assert.match(component, /data-direction="down"/);
  assert.match(component, /publicMarketWindowChange\(row,period\) === null \? "unknown"/);
  assert.match(component, /aria-label="Source-dated XL sector rotation"/);
  assert.match(component, /All XL sectors/);
  assert.match(component, /RSP vs XL sectors/);
  assert.match(component, /Full market screening|All instruments · search and advanced filters/);
  assert.match(stylesheet, /\.rotationSummary\{/);
  assert.doesNotMatch(component, /fetch\(|axios|createSupabaseAdminClient|\.insert\(|\.upsert\(/);
});
