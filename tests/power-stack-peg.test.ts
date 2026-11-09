import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePEG, isResearchCandidate } from "../lib/power-stack-peg";

const base = {
  ticker: "TEST", forwardPE: 15, expectedAnnualEpsGrowthPct: 20,
  estimateAsOf: "2026-11-09", estimateHorizon: "FY2027", estimateSource: "issuer consensus",
};
test("PEG uses percentage points and preserves source", () => {
  const result = evaluatePEG(base);
  assert.equal(result.forwardPEG, 0.75);
  assert.equal(result.classification, "below-one");
  assert.equal(result.estimateSource, "issuer consensus");
});
test("nonpositive, missing or nonfinite values are unavailable", () => {
  for (const [forwardPE, expectedAnnualEpsGrowthPct] of [[-3, 20], [15, 0], [15, -20], [null, 20], [15, null], [Infinity, 20]] as const) {
    assert.equal(evaluatePEG({...base,forwardPE,expectedAnnualEpsGrowthPct}).forwardPEG,null);
  }
});
test("low PEG cannot pass without macro, quality and entry gates", () => {
  const result = evaluatePEG(base);
  assert.equal(isResearchCandidate(result, {growthQualityVerified:true,macroAlignmentVerified:false,entryRiskVerified:true}),false);
  assert.equal(isResearchCandidate(result, {growthQualityVerified:true,macroAlignmentVerified:true,entryRiskVerified:true}),true);
  assert.equal(isResearchCandidate(evaluatePEG({...base,estimateSource:null}), {growthQualityVerified:true,macroAlignmentVerified:true,entryRiskVerified:true}),false);
});
