import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("cross-asset Hypothesis assets must come from its own canonical evidence lineage", () => {
  assert.match(runtime, /affectedAssets may broaden beyond the originating Market Belief only when that receiving asset is explicitly present in canonical evidence cited by the hypothesis/);
  assert.match(runtime, /const hypothesisEvidenceById = new Map\(hypothesisEvidence\.map\(\(evidence\) => \[evidence\.id, evidence\]\)\)/);
  assert.match(runtime, /const hypothesisAssetEvidenceIds = unique\(\[/);
  assert.match(runtime, /\.\.\.evidenceFor/);
  assert.match(runtime, /\.\.\.causalChain\.flatMap\(\(edge\) => edge\.evidenceIds\)/);
  assert.match(runtime, /hypothesisEvidenceById\.get\(evidenceId\)\?\.affectedAssets \?\? \[\]/);
  assert.match(runtime, /affected_assets: onlyExplicitAssets\(hypothesis\.affectedAssets, allowedHypothesisAssets\)/);
});

test("unrelated packet evidence and conflicting-only evidence cannot authorize a receiving asset", () => {
  const allowListStart = runtime.indexOf("const hypothesisAssetEvidenceIds = unique([");
  const allowListEnd = runtime.indexOf("return [{", allowListStart);
  assert.ok(allowListStart >= 0 && allowListEnd > allowListStart);
  const allowList = runtime.slice(allowListStart, allowListEnd);
  assert.doesNotMatch(allowList, /evidenceAgainst/);
  assert.doesNotMatch(allowList, /hypothesisEvidence\.flatMap/);
  assert.match(allowList, /belief\.affected_assets/);
});
