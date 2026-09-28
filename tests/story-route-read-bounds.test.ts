import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const registryPage = fs.readFileSync(path.join(process.cwd(), "app/stories/page.tsx"), "utf8");
const detailPage = fs.readFileSync(path.join(process.cwd(), "app/stories/[slug]/page.tsx"), "utf8");
const dataSource = fs.readFileSync(path.join(process.cwd(), "lib/data.ts"), "utf8");
const recordSource = fs.readFileSync(path.join(process.cwd(), "lib/persistence/read.ts"), "utf8");

test("Story routes no longer depend on the monolithic Desk loader", () => {
  assert.doesNotMatch(registryPage, /getDeskData/);
  assert.doesNotMatch(detailPage, /getDeskData/);
  assert.match(registryPage, /getStoryRegistryData/);
  assert.match(detailPage, /getStoryBySlug/);
  assert.match(detailPage, /getStoryDetailSupport/);
  assert.match(detailPage, /getStoryRecordLayerForStory/);
});

test("Story registry loader is bounded to the datasets the registry renders", () => {
  const start = dataSource.indexOf("async function loadStoryRegistryData");
  const end = dataSource.indexOf("async function loadStoryBySlug");
  const source = dataSource.slice(start, end);
  assert.match(source, /story_updates/);
  assert.match(source, /story_evidence_coverage/);
  assert.match(source, /select=id&is_active=eq.true/);
  assert.doesNotMatch(source, /macro_series_observations|market_series_observations|research_intake_queue|guidance_items|earnings_calls/);
});

test("Story detail support filters Story-owned rows before they reach the page", () => {
  const start = dataSource.indexOf("async function loadStoryDetailSupport");
  const end = dataSource.indexOf("async function loadDeskData");
  const source = dataSource.slice(start, end);
  assert.match(source, /story_id=eq\.\$\{safeStoryId\}/);
  assert.match(source, /slug=eq\.\$\{safeSlug\}/);
  assert.match(source, /limit=80/);
  assert.doesNotMatch(source, /guidance_items|earnings_calls|news_threads|research_source_registry|research_rollout|market_state_ledger/);
});

test("Story detail reads only its own immutable event and thesis history", () => {
  assert.match(recordSource, /getStoryRecordLayerForStory/);
  assert.match(recordSource, /\.eq\("story_id", storyId\)/);
  assert.match(recordSource, /\.limit\(200\)/);
  assert.match(recordSource, /\.limit\(100\)/);
});
