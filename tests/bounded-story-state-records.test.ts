import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const hybrid = fs.readFileSync(path.join(root, "lib", "hybrid-publication.ts"), "utf8");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const journey = fs.readFileSync(path.join(root, "lib", "intelligence", "canonical-journey-edition.ts"), "utf8");

test("current Story-state capture uses a bounded publication reader", () => {
  const start = hybrid.indexOf("export async function getHybridStoryStateRecords");
  const end = hybrid.indexOf("export async function getHybridPublicationRecords", start);
  assert.ok(start >= 0 && end > start);
  const bounded = hybrid.slice(start, end);

  assert.match(bounded, /story_thesis_versions/);
  assert.match(bounded, /story_events/);
  assert.match(bounded, /optionalIntelligenceStates/);
  assert.doesNotMatch(bounded, /hybrid_publication_snapshots/);
  assert.doesNotMatch(bounded, /getDailyBriefArchive/);
  assert.doesNotMatch(bounded, /current_causal_edges/);
  assert.doesNotMatch(bounded, /current_asset_impacts/);
  assert.doesNotMatch(bounded, /2500/);
});

test("canonical Story-state freezes do not call the full replay/archive loader", () => {
  assert.match(runtime, /getHybridStoryStateRecords\(\{ fresh: true \}\)/);
  assert.doesNotMatch(runtime, /getHybridPublicationRecords\(\{ fresh: true \}\)/);

  const captureStart = journey.indexOf("async function captureCanonicalStoryStates");
  const captureEnd = journey.indexOf("async function persistCanonicalStoryManifest", captureStart);
  assert.ok(captureStart >= 0 && captureEnd > captureStart);
  const capture = journey.slice(captureStart, captureEnd);
  assert.match(capture, /getHybridStoryStateRecords\(\{ fresh: true \}\)/);
  assert.doesNotMatch(capture, /getHybridPublicationRecords/);
});
