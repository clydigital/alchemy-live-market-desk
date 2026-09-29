import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("core research mandate allows confirming and non-contrarian ideas", () => {
  assert.match(runtime, /The analytical edge may be confirming, convergent, cross-asset, second-order, structural, catalyst-led or divergent/);
  assert.match(runtime, /Discuss an overlooked variable or countercase only when supplied evidence supports it and the current stage calls for it/);
  assert.doesNotMatch(runtime, /distinguish the accepted market view from the overlooked variable/);
  assert.doesNotMatch(runtime, /test the strongest countercase and preserve uncertainty/);
});

test("stage-specific Hypothesis rules still prohibit manufactured novelty", () => {
  assert.match(runtime, /Do not manufacture novelty, contrarianism or an overlooked variable merely to make an idea sound interesting/);
  assert.match(runtime, /A well-supported confirming thesis can be valuable/);
});
