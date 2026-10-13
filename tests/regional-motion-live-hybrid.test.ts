import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  combineMarketRegions,
  matchesMarketRegion,
  resolveMarketRegions,
} from "../lib/market-regions.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Live, Hybrid and degraded Hybrid use the same source-first regional classifier", () => {
  const live = source("../app/page.tsx");
  const hybrid = source("../app/hybrid-output/page.tsx");
  assert.match(live, /resolveMarketRegions\(\{[\s\S]*?headline: item\.headline,[\s\S]*?primaryRegion: item\.metadata\?\.primary_region/);
  assert.match(hybrid, /const sourceOnly = [\s\S]*?resolveMarketRegions\(\{[\s\S]*?primaryRegion: item\.metadata\?\.primary_region/);
  assert.match(hybrid, /const liveMotionJourney = [\s\S]*?resolveMarketRegions\(\{[\s\S]*?primaryRegion: item\.metadata\?\.primary_region/);
  assert.match(hybrid, /const editionMotionJourney = [\s\S]*?resolveMarketRegions\(\{ headline: item\.headline \}\)/);
});

test("historical Hybrid selects only frozen edition motion, never current live source pool", () => {
  const hybrid = source("../app/hybrid-output/page.tsx");
  const start = hybrid.indexOf("const editionMotionJourney = selectMarketMotionEditionContext");
  const finish = hybrid.indexOf("const liveMotionRows = presenterEditionStatus", start);
  assert.ok(start >= 0 && finish > start);
  const historicalMapping = hybrid.slice(start, finish);
  assert.match(historicalMapping, /resolveMarketRegions\(\{ headline: item\.headline \}\)/);
  assert.doesNotMatch(historicalMapping, /item\.metadata|getCurrentMarketMotion|\.from\(/);
  assert.match(hybrid, /const liveMotionRows = presenterEditionStatus === "current"/);
  assert.match(hybrid, /const motionJourney = presenterEditionStatus === "historical"\s*\? editionMotionJourney/);
  assert.match(hybrid, /const visibleMotionJourney = presenterEditionStatus === "historical"\s*\? motionJourney/);
});

test("regional filtering is client-only and cannot change Dossier judgements or Motion selection", () => {
  const motion = source("../components/live-desk/MarketMotionOverview.tsx");
  assert.match(motion, /^"use client";/);
  assert.match(motion, /const visibleItems = items\.filter\(\(item\) => matchesMarketRegion/);
  assert.match(motion, /buildMarketMotionRegimeRollup\(visibleItems\)/);
  assert.match(motion, /aria-pressed=\{region === option\}/);
  assert.match(motion, /visibleItems\.filter\(\(item\) => item\.attentionTier === "PRIMARY"\)/);
  assert.doesNotMatch(motion, /persistMarketMotion|createSupabaseAdminClient|story_thesis_versions|executeDossier/);
});

test("foreign affected region filtering leaves primary region and event identity unchanged", () => {
  const item = resolveMarketRegions({
    headline: "Broadcom CEO discusses AI capex",
    primaryRegion: "US",
    affectedRegions: ["US", "Asia", "Europe"],
  });
  const before = JSON.stringify(item);
  assert.equal(matchesMarketRegion(item, "Asia"), true);
  assert.equal(matchesMarketRegion(item, "Europe"), true);
  assert.equal(matchesMarketRegion(item, "Other"), false);
  assert.equal(JSON.stringify(item), before);
});

test("legacy frozen headlines can be classified without enriching a historical edition", () => {
  const historical = [
    { id: "historical-motion-a", headline: "Japan chip orders accelerate" },
    { id: "historical-motion-b", headline: "European financing and US debt rules diverge" },
  ];
  const regions = historical.map((item) => ({
    ...item,
    ...resolveMarketRegions({ headline: item.headline }),
  }));
  assert.deepEqual(regions.map((item) => item.id), historical.map((item) => item.id));
  assert.deepEqual(regions.map((item) => item.primaryRegion), ["Asia", "Other"]);
  assert.equal(matchesMarketRegion(regions[1], "Europe"), true);
  assert.equal(matchesMarketRegion(regions[1], "US"), true);
  assert.deepEqual(combineMarketRegions(regions).affectedRegions, ["Asia", "Europe", "US"]);
});
