import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const runtime = source("../lib/intelligence/runtime.ts");
const canonicalEdition = source("../lib/intelligence/canonical-journey-edition.ts");
const hybrid = source("../app/hybrid-output/page.tsx");
const journey = source("../lib/intelligence/journey-briefing.ts");
const edition = source("../lib/intelligence/edition.ts");

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

test("Journey chronology consumes only the immutable edition Motion snapshot", () => {
  assert.match(runtime, /marketMotion:\s*marketMotion\?\.items \|\| \[\]/);
  assert.match(canonicalEdition, /marketMotion:\s*marketMotion\.items/);
  assert.match(edition, /marketMotion\?: MarketMotionEditionItem\[\]/);
  assert.match(edition, /marketMotion,/);
  assert.match(journey, /lane:\s*"story" \| "market_motion"/);
  assert.match(journey, /marketMotion\.map\(marketMotionChronologyItem\)/);
  assert.match(journey, /motionId:\s*item\.id/);
});

test("Hybrid uses live Motion for current reporting and immutable Motion for historical replay", () => {
  assert.match(hybrid, /getCurrentMarketMotion\(\{ limit: 60 \}\)/);
  assert.match(hybrid, /presenterEditionStatus === "historical"/);
  assert.match(hybrid, /marketMotionFromEditionPayload\(motionEdition\?\.payload\)/);
  assert.match(hybrid, /selectMarketMotionEditionContext/);
  assert.match(hybrid, /liveMotionJourney\.length[\s\S]*liveMotionJourney[\s\S]*editionMotionJourney/);
  assert.doesNotMatch(hybrid, /current_market_motion_items/);
});
