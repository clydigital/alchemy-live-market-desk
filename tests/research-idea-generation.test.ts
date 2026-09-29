import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
const schemas = readFileSync(new URL("../lib/intelligence/schemas.ts", import.meta.url), "utf8");

test("Research Brain does not require divergence before idea generation", () => {
  assert.match(runtime, /A divergence is ONE high-value trigger, not a prerequisite/);
  assert.match(runtime, /CONVERGENCE:/);
  assert.match(runtime, /CROSS_ASSET_TRANSMISSION:/);
  assert.match(runtime, /SECOND_ORDER_EFFECT:/);
  assert.match(runtime, /STRUCTURAL_SHIFT:/);
  assert.match(runtime, /CATALYST_REPRICING:/);
  assert.match(runtime, /Hypothesis generation will continue from material Market Beliefs and converging evidence/);

  assert.doesNotMatch(
    runtime,
    /if \(!divergences\.length\) \{[\s\S]{0,500}persistEarlyEngineCompletion/,
    "zero divergence must not terminate the reasoning cycle",
  );
});

test("Hypothesis contract carries belief identity and optional divergence", () => {
  assert.match(schemas, /required: \["marketBeliefId", "divergenceId"/);
  assert.match(schemas, /marketBeliefId: \{ type: "string" \}/);
  assert.match(schemas, /divergenceId: nullableString/);
  assert.match(schemas, /marketBeliefId: string;\s*divergenceId: string \| null;/);
});

test("belief-led hypotheses persist without fabricating divergence", () => {
  assert.match(runtime, /divergence_id: divergence\?\.id \?\? null/);
  assert.match(runtime, /market_belief: belief\.statement/);
  assert.match(runtime, /divergence_summary: divergence\?\.observed_change \?\? null/);
  assert.match(runtime, /const marketBeliefId = hypothesis\.marketBeliefId \|\| divergence\?\.market_belief_id \|\| null/);
});
