import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const route = source("../app/api/market-intelligence-snapshot/route.ts");
const builder = source("../lib/market-intelligence-snapshot.ts");

test("Power Stack market-intelligence export reads Motion only from the current immutable edition", () => {
  assert.match(route, /getHybridPresenterEditionCandidates/);
  assert.match(route, /buildCanonicalEditionIndex/);
  assert.match(route, /marketMotionFromEditionPayload\(currentEdition\?\.payload\)/);
  assert.doesNotMatch(route, /getCurrentMarketMotion|current_market_motion_items/);
});

test("market-intelligence snapshot exposes promoted Motion as context, not a scoring channel", () => {
  assert.match(builder, /marketMotion: \(MarketMotionEditionAttachment & \{ editionId: string \}\) \| null/);
  assert.match(builder, /marketMotion: marketMotion \? structuredClone\(marketMotion\) : null/);
  assert.match(builder, /may raise portfolio research priority but cannot change company fundamentals or conviction by itself/);
});
