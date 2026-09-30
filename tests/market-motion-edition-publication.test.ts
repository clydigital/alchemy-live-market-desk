import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const runtime = source("../lib/intelligence/runtime.ts");
const canonicalEdition = source("../lib/intelligence/canonical-journey-edition.ts");
const hybrid = source("../app/hybrid-output/page.tsx");

test("canonical base publication freezes promoted Market Motion into the edition", () => {
  assert.match(runtime, /captureMarketMotionEditionAttachment/);
  assert.match(runtime, /marketMotionEditionSourceRefs/);
  assert.match(runtime, /\.\.\.\(marketMotion \? \{ marketMotion \} : \{\}\)/);
  assert.match(runtime, /Market Motion edition snapshot unavailable/);

  assert.match(canonicalEdition, /captureMarketMotionEditionAttachment/);
  assert.match(canonicalEdition, /marketMotionEditionSourceRefs/);
  assert.match(canonicalEdition, /marketMotion,/);
});

test("Dossier composition carries the exact base-edition Motion snapshot forward", () => {
  assert.match(canonicalEdition, /const payload = \{[\s\S]{0,120}\.\.\.base\.payload/);
  assert.doesNotMatch(canonicalEdition, /marketMotion[\s\S]{0,120}PATCH/);
});

test("Hybrid reads Motion from the immutable edition instead of the mutable current view", () => {
  assert.match(hybrid, /marketMotionFromEditionPayload\(currentEdition\?\.payload\)/);
  assert.match(hybrid, /selectMarketMotionEditionContext/);
  assert.doesNotMatch(hybrid, /getCurrentMarketMotion/);
  assert.doesNotMatch(hybrid, /current_market_motion_items/);
});
